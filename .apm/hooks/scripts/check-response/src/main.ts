import { type } from "arktype";
import { match } from "ts-pattern";

import type { HookOutput } from "./hook/hook-io.ts";
import type { ManualRunOutput } from "./manual-run.ts";

import { parseCliArgs, USAGE } from "./cli-args.ts";
import { EXIT_CODE, hookInput, PASS_OUTPUT } from "./hook/hook-io.ts";
import { checkText, scanTranscripts } from "./manual-run.ts";
import { runStop } from "./stop.ts";

const USAGE_ERROR_EXIT_CODE = 2;

const runHook = async (): Promise<HookOutput> => {
  const input = hookInput(await Bun.stdin.text());
  if (input instanceof type.errors) {
    return PASS_OUTPUT;
  }

  return runStop(input);
};

const writeHookOutput = (output: HookOutput): never => {
  match(output)
    .with({ exitCode: EXIT_CODE.pass }, () => undefined)
    .otherwise(({ message }) => process.stderr.write(`${message}\n`));

  return process.exit(output.exitCode);
};

const writeManualRunOutput = (
  { exitCode, stdout, stderr }: ManualRunOutput,
): never => {
  process.stdout.write(stdout);
  process.stderr.write(stderr);

  return process.exit(exitCode);
};

const readText = async (path: string): Promise<string> => (path === "-" ? Bun.stdin.text() : Bun.file(path).text());

const main = async (): Promise<never> => {
  const parsed = parseCliArgs(process.argv.slice(2));
  if (parsed.isErr()) {
    process.stderr.write(`${parsed.unwrapErr().message}\n\n${USAGE}\n`);

    return process.exit(USAGE_ERROR_EXIT_CODE);
  }

  return match(parsed.unwrap())
    .with({ kind: "hook" }, async () => writeHookOutput(await runHook()))
    .with({ kind: "text" }, async ({ path, llm }) => writeManualRunOutput(await checkText({ text: await readText(path), llm })))
    .with({ kind: "scan" }, async (options) => writeManualRunOutput(await scanTranscripts(options)))
    .exhaustive();
};

main().catch((error: unknown) => {
  process.stderr.write(`check-response: the check failed: ${String(error)}\n`);
  process.exit(EXIT_CODE.warning);
});
