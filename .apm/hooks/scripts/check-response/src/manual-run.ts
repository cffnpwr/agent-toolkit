import { readFile } from "node:fs/promises";

import type { Result } from "@cffnpwr/result-ts";

import { Ok } from "@cffnpwr/result-ts";
import { match } from "ts-pattern";

import type { Harness, HarnessDetectionError } from "./hook/harness.ts";
import type { ReviewSection } from "./llm-review/reviewer.ts";
import type { TextlintFinding } from "./textlint/textlint.ts";

import { containsJapanese, historyOf, responsesOf } from "./conversation/conversation.ts";
import { parseTranscript } from "./conversation/transcript.ts";
import { detectHarness } from "./hook/harness.ts";
import { reviewProse } from "./llm-review/reviewer.ts";
import { describeFinding } from "./report.ts";
import { createResponseLinter, describeTextlintFinding, findingsOf } from "./textlint/textlint.ts";

const MAX_EXAMPLES_PER_RULE = 3;

const COUNT_WIDTH = 5;

export interface ManualRunOutput {
  exitCode: 0 | 1;
  stdout: string;
  stderr: string;
}

export interface TextOptions {
  text: string;
  llm: boolean;
}

export interface ScanOptions {
  transcripts: string[];
  // 指定が無い場合は、hookと同じ方法でharnessを判定
  harness: Harness | undefined;
}

const section = (title: string, lines: string[]): string[] => match(lines)
  .with([], () => [])
  .otherwise(() => [`${title}:\n${lines.join("\n")}`]);

const reviewSectionsOf = async (
  text: string,
  textlint: TextlintFinding[],
  llm: boolean,
): Promise<{ reviews: ReviewSection[]; notes: string[]; }> => {
  if (!llm) {
    return { reviews: [], notes: [] };
  }
  const harness = await detectHarness();
  if (harness.isErr()) {
    return { reviews: [], notes: [`The prose review was skipped: ${harness.unwrapErr().message}`] };
  }
  const reviews = await reviewProse(harness, {
    conversation: { kind: "no-user-message", events: [{ kind: "response", text }] },
    confirmedFindings: findingsOf(textlint, "confirmed").map(describeTextlintFinding),
    findingsToJudge: findingsOf(textlint, "needs-judgment").map(describeTextlintFinding),
  });

  return {
    reviews,
    notes: reviews.flatMap(({ result }) => (result.isErr()
      ? [result.unwrapErr().message]
      : [])),
  };
};

export const checkText = async (
  { text, llm }: TextOptions,
): Promise<ManualRunOutput> => {
  const lint = await createResponseLinter();
  const textlint = await lint(text);
  const confirmed = findingsOf(textlint, "confirmed");
  const { reviews, notes } = await reviewSectionsOf(text, textlint, llm);
  const reviewFindings = reviews.flatMap(({ title, result }) => section(
    title,
    result.unwrapOr([]).map(describeFinding),
  ));
  const stdout = [
    ...section("Confirmed (textlint)", confirmed.map(describeTextlintFinding)),
    ...section("Needs judgment (textlint)", findingsOf(textlint, "needs-judgment").map(describeTextlintFinding)),
    ...reviewFindings,
  ].join("\n\n");

  return {
    // 違反として数えるのは、確定した指摘と査読の指摘のみ
    exitCode: confirmed.length > 0 || reviewFindings.length > 0 ? 1 : 0,
    stdout: stdout === "" ? "" : `${stdout}\n`,
    stderr: notes.map((note) => `${note}\n`).join(""),
  };
};

const scanHarnessOf = async (
  harness: Harness | undefined,
): Promise<Result<Harness, HarnessDetectionError>> => (harness === undefined
  ? detectHarness()
  : Ok(harness));

const japaneseResponsesOf = (
  harness: Harness,
  transcript: string,
): string[] => {
  const conversation = parseTranscript(harness, transcript);

  return [
    ...responsesOf(historyOf(conversation)),
    ...responsesOf(conversation.events),
  ].filter(containsJapanese);
};

const ruleKeyOf = ({ ruleId, certainty }: TextlintFinding): string => (certainty === "confirmed" ? ruleId : `${ruleId} (needs judgment)`);

const describeRuleCount = (
  key: string,
  findings: TextlintFinding[],
): string => [
  `${String(findings.length).padStart(COUNT_WIDTH)} ${key}`,
  ...findings.slice(0, MAX_EXAMPLES_PER_RULE).map(({ lineText, message }) => `${" ".repeat(COUNT_WIDTH)}   ${lineText} -- ${message}`),
].join("\n");

// 査読は応答ごとのCLIの起動に時間がかかるため、機械的な検査のみで規則ごとの件数を集計
export const scanTranscripts = async (
  { transcripts, harness }: ScanOptions,
): Promise<ManualRunOutput> => {
  const detectedHarness = await scanHarnessOf(harness);
  if (detectedHarness.isErr()) {
    return { exitCode: 1, stdout: "", stderr: `${detectedHarness.unwrapErr().message} Set it with --harness.\n` };
  }
  const texts = await Promise.all(
    transcripts.map(async (path) => readFile(path, "utf8")),
  );
  const responses = texts.flatMap(
    (text) => japaneseResponsesOf(detectedHarness.unwrap(), text),
  );
  const lint = await createResponseLinter();
  const findings = (await Promise.all(responses.map(lint))).flat();
  const findingsByRule = Map.groupBy(findings, ruleKeyOf);
  const counts = [...findingsByRule.entries()]
    .toSorted(([, a], [, b]) => b.length - a.length)
    .map(([key, findings]) => describeRuleCount(key, findings));

  return {
    exitCode: 0,
    stdout: [`responses: ${responses.length}`, ...counts].map((line) => `${line}\n`).join(""),
    stderr: "",
  };
};
