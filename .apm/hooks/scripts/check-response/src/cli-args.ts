import { parseArgs } from "node:util";

import type { Result } from "@cffnpwr/result-ts";

import { Err, Ok } from "@cffnpwr/result-ts";
import { type } from "arktype";

import { harness } from "./hook/harness.ts";

export const USAGE = [
  "Usage:",
  "  check-response",
  "      Run as the Stop hook. Reads the hook input JSON from stdin.",
  "  check-response --text <file|-> [--no-llm]",
  "      Check the Japanese text in <file> (\"-\" reads stdin) with textlint and the prose review.",
  "      --no-llm skips the prose review. Exits with 1 if a violation is found, otherwise 0.",
  "  check-response --scan [--harness claude|codex] <transcript.jsonl>...",
  "      Count the textlint findings per rule in every Japanese response of the transcripts.",
  "      --harness selects the transcript format. Without it, the harness is detected as in the hook.",
].join("\n");

const ARGS_OPTIONS = {
  text: { type: "string" },
  "no-llm": { type: "boolean" },
  scan: { type: "boolean" },
  harness: { type: "string" },
} as const;

const hookMode = type({ values: { "+": "reject" }, positionals: "string[] == 0" })
  .pipe(() => ({ kind: "hook" as const }));

const textMode = type({ values: { "+": "reject", text: "string", "no-llm?": "boolean" }, positionals: "string[] == 0" })
  .pipe(({ values }) => ({ kind: "text" as const, path: values.text, llm: values["no-llm"] !== true }));

const scanMode = type({ values: { "+": "reject", scan: "true", "harness?": harness }, positionals: "string[] >= 1" })
  .pipe(({ values, positionals }) => ({ kind: "scan" as const, transcripts: positionals, harness: values.harness }));

// 起動方法ごとのオプションの組のいずれにも一致しない組み合わせは拒否
const mode = hookMode.or(textMode).or(scanMode);

export type Mode = typeof mode.infer;

export class CliArgsError extends Error {
  override readonly name = "CliArgsError" as const;

  constructor(detail: string, options?: ErrorOptions) {
    super(`The arguments do not match any usage: ${detail}`, options);
  }
}

const parseOptions = (args: string[]): Result<unknown, CliArgsError> => {
  try {
    return Ok(parseArgs({
      args,
      options: ARGS_OPTIONS,
      allowPositionals: true,
    }));
  } catch (error) {
    // 未定義のオプション・値の無いオプションで発生するparseArgsの例外
    const detail = error instanceof Error ? error.message : String(error);

    return Err(new CliArgsError(detail, { cause: error }));
  }
};

export const parseCliArgs = (
  args: string[],
): Result<Mode, CliArgsError> => parseOptions(args)
  .andThen((options) => {
    const parsed = mode(options);

    return parsed instanceof type.errors
      ? Err(new CliArgsError(parsed.summary, { cause: parsed }))
      : Ok(parsed);
  });
