import { fileURLToPath } from "node:url";

import { createLinter, loadTextlintrc } from "textlint";
import { match } from "ts-pattern";

import { MORPHOLOGY_RULES } from "./morphology-rules.ts";

const CONFIG_PATH = fileURLToPath(new URL("../../.textlintrc.json", import.meta.url));

// textlintのseverityの値(@textlint/typesのTextlintRuleSeverityLevel)
const WARNING_SEVERITY = 1;

const ERROR_SEVERITY = 2;

const RESPONSE_FILE_NAME = "response.md";

// 設定のseverityを反映しない形式で報告するため、severityに関係なく判定が必要な指摘とする規則
const NEEDS_JUDGMENT_RULE_IDS = new Set(["@textlint-ja/ai-writing/ai-tech-writing-guideline"]);

interface TextlintMessage {
  ruleId: string;
  message: string;
  severity: number;
  loc: { start: { line: number; }; };
}

type LintResponse = (response: string) => Promise<TextlintFinding[]>;

// confirmedは書き換えが必要と確定した指摘、needs-judgmentは文章の査読で違反かを判定する指摘
export type Certainty = "confirmed" | "needs-judgment";

export interface TextlintFinding {
  certainty: Certainty;
  line: number;
  lineText: string;
  ruleId: string;
  message: string;
}

const certaintyOf = (
  { severity, ruleId }: TextlintMessage,
): Certainty[] => match(severity)
  .with(ERROR_SEVERITY, (): Certainty[] => [NEEDS_JUDGMENT_RULE_IDS.has(ruleId) ? "needs-judgment" : "confirmed"])
  .with(WARNING_SEVERITY, (): Certainty[] => ["needs-judgment"])
  // severityがinfo・offの指摘は対象外
  .otherwise(() => []);

const toTextlintFindings = (
  messages: TextlintMessage[],
  text: string,
): TextlintFinding[] => {
  const lines = text.split("\n");

  return messages.flatMap((message) => certaintyOf(message)
    .map((certainty) => ({
      certainty,
      line: message.loc.start.line,
      lineText: lines[message.loc.start.line - 1] ?? "",
      ruleId: message.ruleId,
      message: message.message,
    })));
};

export const createResponseLinter = async (): Promise<LintResponse> => {
  const descriptor = await loadTextlintrc({ configFilePath: CONFIG_PATH });
  const linter = createLinter({
    descriptor: descriptor.shallowMerge({
      rules: [...descriptor.rule.toKernelRulesFormat(), ...MORPHOLOGY_RULES],
    }),
  });

  return async (
    response: string,
  ): Promise<TextlintFinding[]> => toTextlintFindings(
    (await linter.lintText(response, RESPONSE_FILE_NAME)).messages,
    response,
  );
};

export const findingsOf = (
  findings: TextlintFinding[],
  certainty: Certainty,
): TextlintFinding[] => findings.filter(
  (finding) => finding.certainty === certainty,
);

export const describeTextlintFinding = ({ line, lineText, ruleId, message }: TextlintFinding): string => `- line ${line} "${lineText}": ${message} (${ruleId})`;
