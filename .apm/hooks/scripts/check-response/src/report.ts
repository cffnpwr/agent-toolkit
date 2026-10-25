import { match } from "ts-pattern";

import type { HookOutput } from "./hook/hook-io.ts";
import type { Finding } from "./llm-review/findings.ts";
import type { FindingGroup } from "./recheck.ts";
import type { TextlintFinding } from "./textlint/textlint.ts";

import { EXIT_CODE, OUTPUT_PREFIX, PASS_OUTPUT } from "./hook/hook-io.ts";
import { MAX_BLOCKS_PER_TURN } from "./recheck.ts";
import { describeTextlintFinding } from "./textlint/textlint.ts";

export const STOP_INSTRUCTION = "your last response breaks the Japanese writing rules or reports work that is not verified. "
  + "Fix every item below, then send the corrected response again. "
  + "For verification items, run the missing checks before you answer.";

export const BLOCK_LIMIT_NOTICE = `the response was sent back ${MAX_BLOCKS_PER_TURN} times in this turn, so it is not sent back again. `
  + "These items remain:";

const NON_BLOCKING_SUFFIX = " (new findings after the previous block; not sent back)";

interface ReportContent {
  // 書き換えが必要と確定したtextlintの指摘
  textlint: TextlintFinding[];
  blocking: FindingGroup[];
  nonBlocking: FindingGroup[];
  warnings: string[];
  canBlock: boolean;
}

export const describeFinding = ({ rule, quote, reason, suggestion }: Finding): string => `- ${rule}: "${quote}" -- ${reason} Suggested fix: ${suggestion}`;

const textlintBlocks = (
  findings: TextlintFinding[],
): string[] => match(findings)
  .with([], () => [])
  .otherwise(() => [`textlint (Japanese style rules):\n${findings.map(describeTextlintFinding).join("\n")}`]);

const groupBlock = (
  { title, findings }: FindingGroup,
  suffix = "",
): string => `${title}${suffix}:\n${findings.map(describeFinding).join("\n")}`;

const warningBlocks = (warnings: string[]): string[] => match(warnings)
  .with([], () => [])
  .otherwise(() => [`The check could not finish:\n${warnings.map((warning) => `- ${warning}`).join("\n")}`]);

export const buildReport = ({
  textlint,
  blocking,
  nonBlocking,
  warnings,
  canBlock,
}: ReportContent): HookOutput => {
  const violations = [
    ...textlintBlocks(textlint),
    ...blocking.map((group) => groupBlock(group)),
  ];
  const rest = [
    ...nonBlocking.map((group) => groupBlock(group, NON_BLOCKING_SUFFIX)),
    ...warningBlocks(warnings),
  ];

  return match({
    hasViolations: violations.length > 0,
    canBlock,
    hasRest: rest.length > 0,
  })
    .with({ hasViolations: true, canBlock: true }, (): HookOutput => ({
      exitCode: EXIT_CODE.block,
      message: `${OUTPUT_PREFIX}${STOP_INSTRUCTION}\n\n${[...violations, ...rest].join("\n\n")}`,
    }))
    .with({ hasViolations: true, canBlock: false }, (): HookOutput => ({
      exitCode: EXIT_CODE.warning,
      message: `${OUTPUT_PREFIX}${BLOCK_LIMIT_NOTICE}\n\n${[...violations, ...rest].join("\n\n")}`,
    }))
    .with({ hasRest: true }, (): HookOutput => ({
      exitCode: EXIT_CODE.warning,
      message: `${OUTPUT_PREFIX}${rest.join("\n\n")}`,
    }))
    .otherwise(() => PASS_OUTPUT);
};
