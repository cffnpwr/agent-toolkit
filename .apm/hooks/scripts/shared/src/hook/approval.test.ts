import { describe, expect, it } from "bun:test";

import { isClaudeCode, toApprovalOutput } from "./approval.ts";

describe("isClaudeCode", () => {
  it("[positive] 環境変数とsession_idが一致するときClaude Codeとみなす", () => {
    expect(isClaudeCode("s1", "s1")).toBe(true);
  });

  it.each<{
    label: string;
    env: string | undefined;
    input: string | undefined;
  }>([
    { label: "環境変数が無い", env: undefined, input: "s1" },
    { label: "環境変数とsession_idが空", env: "", input: "" },
    { label: "環境変数とsession_idが異なる", env: "s1", input: "s2" },
    { label: "session_idが無い", env: "s1", input: undefined },
  ])("[negative] $labelときClaude Codeとみなさない", ({ env, input }) => {
    expect(isClaudeCode(env, input)).toBe(false);
  });
});

describe("toApprovalOutput", () => {
  it("[positive] Claude Codeのときexit 0でaskのJSONを返す", () => {
    const result = toApprovalOutput({
      reason: "reason",
      isCalledByClaudeCode: true,
      disableVariable: "GUARD_DISABLE",
    });

    expect(result).toEqual({
      exitCode: 0,
      stdout: `${JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "ask",
          permissionDecisionReason: "reason",
        },
      })}\n`,
      stderr: "",
    });
  });

  it("[positive] Claude Code以外のときexit 2でstderrに理由と再実行の手順を返す", () => {
    const result = toApprovalOutput({
      reason: "reason",
      isCalledByClaudeCode: false,
      disableVariable: "GUARD_DISABLE",
    });

    expect(result).toEqual({
      exitCode: 2,
      stdout: "",
      stderr: "reason\n"
        + "This hook can ask for approval only in Claude Code, so it blocked the command.\n"
        + "Ask the user for approval in your response.\n"
        + "Only if the user approves, run the command again with GUARD_DISABLE=1 "
        + "placed right before each git command listed above.\n",
    });
  });
});
