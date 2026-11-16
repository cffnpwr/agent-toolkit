export interface HookOutput {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ApprovalRequest {
  reason: string;
  isCalledByClaudeCode: boolean;
  // 承認を得たコマンドの前置代入で、そのコマンドだけhookを無効化する環境変数名
  disableVariable: string;
}

// Claude Codeはhook入力のsession_idと同じ値をCLAUDE_CODE_SESSION_IDに設定する
export const isClaudeCode = (
  envSessionId: string | undefined,
  inputSessionId: string | undefined,
): boolean => envSessionId !== undefined
  && envSessionId !== ""
  && envSessionId === inputSessionId;

const toRetryInstruction = (disableVariable: string): string => [
  "This hook can ask for approval only in Claude Code, so it blocked the command.",
  "Ask the user for approval in your response.",
  `Only if the user approves, run the command again with ${disableVariable}=1 `
  + "placed right before each git command listed above.",
].join("\n");

// Claude Codeでは承認を求め、それ以外のharnessでは実行をブロックする
export const toApprovalOutput = (request: ApprovalRequest): HookOutput => {
  const { reason, isCalledByClaudeCode, disableVariable } = request;
  if (!isCalledByClaudeCode) {
    return {
      exitCode: 2,
      stdout: "",
      stderr: `${reason}\n${toRetryInstruction(disableVariable)}\n`,
    };
  }
  const decision = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: reason,
    },
  };

  return { exitCode: 0, stdout: `${JSON.stringify(decision)}\n`, stderr: "" };
};
