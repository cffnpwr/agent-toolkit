import type { Result } from "@cffnpwr/result-ts";

import { Err, Ok } from "@cffnpwr/result-ts";

import type { HookOutput } from "../../shared/src/hook/approval.ts";

import type { ConfigOverrideFinding } from "./detect.ts";
import type { HookInput, HookInputParseError } from "./input.ts";

import {
  isClaudeCode,
  toApprovalOutput,
} from "../../shared/src/hook/approval.ts";

import { findConfigOverrides, findConfigWrites } from "./detect.ts";
import { parseHookInput } from "./input.ts";

const DISABLE_VARIABLE = "GIT_CONFIG_MODIFY_GUARD_DISABLE";

const UNRESOLVED_OVERRIDE = "a setting whose name cannot be determined";

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
  stderr: "git-config-modify-guard: could not check the command for git config changes: "
    + `${error.message} (${String(error.cause)})\n`,
});

const buildWriteReason = (snippets: readonly string[]): string => {
  const lines = snippets.map((snippet) => `  ${snippet}`).join("\n");

  return "this command changes git config, "
    + `so it needs the user's approval:\n${lines}`;
};

const describeOverrides = (finding: ConfigOverrideFinding): string => {
  const names = finding.overrides
    .map((override) => `${override.option} ${override.name}`);
  if (finding.hasUnresolvedOverride) {
    names.push(UNRESOLVED_OVERRIDE);
  }
  names.push(...finding.environmentVariables.map((name) => `${name} variable`));

  return `  ${finding.snippet} (overrides ${names.join(", ")})`;
};

const buildOverrideReason = (
  findings: readonly ConfigOverrideFinding[],
): string => {
  const lines = findings.map(describeOverrides).join("\n");

  return "this command overrides git config for one command with -c, "
    + `--config-env or GIT_CONFIG_* variables, so it needs the user's approval:\n${lines}`;
};

const buildReason = (
  snippets: readonly string[],
  findings: readonly ConfigOverrideFinding[],
): string => {
  const reasons: string[] = [];
  if (snippets.length > 0) {
    reasons.push(buildWriteReason(snippets));
  }
  if (findings.length > 0) {
    reasons.push(buildOverrideReason(findings));
  }

  return `git-config-modify-guard: ${reasons.join("\n")}`;
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
  const disableVariable = isCalledByClaudeCode ? undefined : DISABLE_VARIABLE;
  const snippets = findConfigWrites(input.command, disableVariable);
  const findings = findConfigOverrides(input.command, disableVariable);
  if (snippets.length === 0 && findings.length === 0) {
    return PASS;
  }

  return toApprovalOutput({
    reason: buildReason(snippets, findings),
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
