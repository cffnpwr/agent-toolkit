import type { Result } from "@cffnpwr/result-ts";

import { Err, Ok } from "@cffnpwr/result-ts";

import type { HookOutput } from "../../shared/src/hook/approval.ts";

import type { HookBypass } from "./detect.ts";
import type { HookInput, HookInputParseError } from "./input.ts";

import { isClaudeCode, toApprovalOutput } from "../../shared/src/hook/approval.ts";

import { findHookBypasses } from "./detect.ts";
import { parseHookInput } from "./input.ts";

const DISABLE_VARIABLE = "GIT_HOOK_BYPASS_GUARD_DISABLE";

const PASS: HookOutput = { exitCode: 0, stdout: "", stderr: "" };

class StdinReadError extends Error {
  override readonly name = "StdinReadError" as const;

  constructor(options?: ErrorOptions) {
    super("Failed to read the hook input from stdin.", options);
  }
}

const readStdin = async (): Promise<Result<string, StdinReadError>> => {
  try {
    return Ok(await Bun.stdin.text());
  } catch (error) {
    return Err(new StdinReadError({ cause: error }));
  }
};

const toFailureOutput = (
  error: HookInputParseError | StdinReadError,
): HookOutput => ({
  exitCode: 1,
  stdout: "",
  stderr: "git-hook-bypass-guard: could not check the command for skipped git hooks: "
    + `${error.message} (${String(error.cause)})\n`,
});

const buildReason = (bypasses: readonly HookBypass[]): string => {
  const lines = bypasses
    .map(({ snippet, reason }) => `  ${snippet}: ${reason}`)
    .join("\n");

  return "git-hook-bypass-guard: this command skips git hooks, "
    + `so it needs the user's approval:\n${lines}`;
};

const decide = (input: HookInput): HookOutput => {
  if (input.command === undefined) {
    return PASS;
  }

  const isCalledByClaudeCode = isClaudeCode(
    process.env.CLAUDE_CODE_SESSION_ID,
    input.sessionId,
  );
  // Claude Codeでは承認を求められるため、前置代入による無効化を使わない
  const bypasses = findHookBypasses(
    input.command,
    isCalledByClaudeCode ? undefined : DISABLE_VARIABLE,
  );
  if (bypasses.length === 0) {
    return PASS;
  }

  return toApprovalOutput({
    reason: buildReason(bypasses),
    isCalledByClaudeCode,
    disableVariable: DISABLE_VARIABLE,
  });
};

const run = async (): Promise<HookOutput> => {
  const text = await readStdin();
  if (text.isErr()) {
    return toFailureOutput(text.unwrapErr());
  }
  const input = parseHookInput(text.unwrap());
  if (input.isErr()) {
    return toFailureOutput(input.unwrapErr());
  }

  return decide(input.unwrap());
};

const output = await run();
process.stdout.write(output.stdout);
process.stderr.write(output.stderr);
process.exit(output.exitCode);
