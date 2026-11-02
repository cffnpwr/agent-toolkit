import { readFile } from "node:fs/promises";

import type { Result } from "@cffnpwr/result-ts";

import { match, P } from "ts-pattern";

import type { Conversation } from "./conversation/conversation.ts";
import type { Harness, HarnessDetectionError } from "./hook/harness.ts";
import type { HookOutput, StopInput } from "./hook/hook-io.ts";
import type { BlockState } from "./hook/review-state.ts";
import type { ReviewSection } from "./llm-review/reviewer.ts";
import type { TextlintFinding } from "./textlint/textlint.ts";

import { containsJapanese, EMPTY_CONVERSATION, responsesOf, withLastAssistantMessage } from "./conversation/conversation.ts";
import { parseTranscript } from "./conversation/transcript.ts";
import { detectHarness } from "./hook/harness.ts";
import { EXIT_CODE, PASS_OUTPUT } from "./hook/hook-io.ts";
import { appendLog } from "./hook/log.ts";
import { blockStateOf, loadRecord, nextRecord, recordPathOf, saveRecord, withoutReviewed } from "./hook/review-state.ts";
import { reviewResponses } from "./llm-review/reviewer.ts";
import { canBlock, judgeReviews } from "./recheck.ts";
import { buildReport } from "./report.ts";
import { createResponseLinter, describeTextlintFinding, findingsOf } from "./textlint/textlint.ts";

interface CheckLog {
  harness: Result<Harness, HarnessDetectionError>;
  blockState: BlockState | undefined;
  responses: string[];
  textlint: TextlintFinding[];
  reviews: ReviewSection[];
  warnings: string[];
  output: HookOutput | undefined;
}

// harnessが不明な場合の検査対象は、Stopの入力の最後の応答のみ
const conversationOf = (
  detectedHarness: Result<Harness, HarnessDetectionError>,
  transcript: string,
): Conversation => detectedHarness
  .map((harness) => parseTranscript(harness, transcript))
  .unwrapOr(EMPTY_CONVERSATION);

const readTranscript = async (
  path: string | null | undefined,
): Promise<string> => match(path)
  .with(P.nullish, async () => "")
  .with(P.string, async (transcriptPath) => readFile(transcriptPath, "utf8").catch(() => ""))
  .exhaustive();

const outcomeOf = (
  output: HookOutput | undefined,
): string => match(output)
  .with(undefined, () => "skipped")
  .with({ exitCode: EXIT_CODE.pass }, () => "pass")
  .with({ exitCode: EXIT_CODE.warning }, () => "warning")
  .with({ exitCode: EXIT_CODE.block }, () => "block")
  .exhaustive();

const logEntryOf = (
  sessionId: string,
  log: CheckLog,
): Record<string, unknown> => ({
  time: new Date().toISOString(),
  session_id: sessionId,
  harness: log.harness.isOk()
    ? log.harness.unwrap()
    : { error: log.harness.unwrapErr().message },
  block_count: log.blockState?.count ?? 0,
  confirmed: findingsOf(log.textlint, "confirmed"),
  needs_judgment: findingsOf(log.textlint, "needs-judgment"),
  reviews: log.reviews.map(({ title, result }) => (result.isOk()
    ? { title, findings: result.unwrap() }
    : { title, error: result.unwrapErr().message })),
  warnings: log.warnings,
  responses: log.responses,
  outcome: outcomeOf(log.output),
});

const reviewWarningsOf = (
  reviews: ReviewSection[],
): string[] => reviews.flatMap(({ result }) => (result.isErr()
  ? [result.unwrapErr().message]
  : []));

export const runStop = async (input: StopInput): Promise<HookOutput> => {
  const recordPath = recordPathOf(input.session_id);
  const record = await loadRecord(recordPath);

  const detectedHarness = await detectHarness();
  const conversation = withLastAssistantMessage(
    conversationOf(
      detectedHarness,
      await readTranscript(input.transcript_path),
    ),
    input.last_assistant_message,
  );
  const blockState = blockStateOf(conversation, record, input.stop_hook_active);
  const unreviewedConversation = withoutReviewed(conversation, record);
  const responses = responsesOf(unreviewedConversation.events);
  const log: CheckLog = {
    harness: detectedHarness,
    blockState,
    responses,
    textlint: [],
    reviews: [],
    warnings: [],
    output: undefined,
  };
  if (!responses.some(containsJapanese)) {
    await appendLog(logEntryOf(input.session_id, log));

    return PASS_OUTPUT;
  }

  const lintResponse = await createResponseLinter();
  const textlint = (await Promise.all(responses.map(lintResponse))).flat();
  const confirmed = findingsOf(textlint, "confirmed");
  const reviews = await reviewResponses(detectedHarness, {
    conversation: unreviewedConversation,
    confirmedFindings: confirmed.map(describeTextlintFinding),
    findingsToJudge: findingsOf(textlint, "needs-judgment").map(describeTextlintFinding),
  });
  const { blocking, nonBlocking } = judgeReviews(
    reviews,
    blockState,
    responses,
  );
  const warnings = [
    ...detectedHarness.err().map((error) => [error.message]).unwrapOr([]),
    ...reviewWarningsOf(reviews),
  ];
  const output = buildReport({
    textlint: confirmed,
    blocking,
    nonBlocking,
    warnings,
    canBlock: canBlock(blockState),
  });
  const nextBlockState = output.exitCode === EXIT_CODE.block
    ? {
      count: (blockState?.count ?? 0) + 1,
      findings: blocking.flatMap(({ findings }) => findings),
    }
    : blockState;
  await saveRecord(recordPath, nextRecord(conversation, nextBlockState));
  await appendLog(logEntryOf(
    input.session_id,
    { ...log, textlint, reviews, warnings, output },
  ));

  return output;
};
