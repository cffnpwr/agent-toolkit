import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Result } from "@cffnpwr/result-ts";

import { Err, Ok } from "@cffnpwr/result-ts";
import { type } from "arktype";
import { match } from "ts-pattern";

import type { Harness, HarnessDetectionError } from "../hook/harness.ts";

import type { Finding } from "./findings.ts";
import type { ReviewInputSource } from "./review-input.ts";

import { reviewOutput, reviewOutputJsonSchema } from "./findings.ts";
import prosePrompt from "./prompts/prose.md" with { type: "text" };
import verificationPrompt from "./prompts/verification.md" with { type: "text" };
import { toProseReviewInput, toVerificationReviewInput } from "./review-input.ts";

const CLAUDE_MODEL = "haiku";

const CODEX_MODEL = "gpt-6-luna";

const SCHEMA_FILE_NAME = "schema.json";

const STDERR_TAIL_LENGTH = 500;

const TEMP_DIR_PREFIX = "check-response-";

const PROSE_REVIEW: ReviewKind = { title: "Prose review", prompt: prosePrompt, toInput: toProseReviewInput };

const VERIFICATION_REVIEW: ReviewKind = {
  title: "Verification review",
  prompt: verificationPrompt,
  toInput: toVerificationReviewInput,
};

// 入れ子で起動するCLIでのこのhookの無効化
const NESTED_ENV = { CHECK_RESPONSE_DISABLE: "1" };

const claudeOutput = type("string.json.parse").to({ structured_output: reviewOutput });

const codexOutput = type("string.json.parse").to(reviewOutput);

type ReviewerError = ReviewerCommandError | ReviewerOutputError;

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface ReviewKind {
  title: string;
  prompt: string;
  toInput: (source: ReviewInputSource) => string;
}

interface ReviewRequest {
  prompt: string;
  input: string;
}

interface Command {
  args: string[];
  stdin: string;
  env: Record<string, string>;
  // 起動前に書き出すファイル
  files: { path: string; text: string; }[];
}

export interface ReviewSection {
  title: string;
  result: Result<Finding[], ReviewerError>;
}

export class ReviewerCommandError extends Error {
  override readonly name = "ReviewerCommandError" as const;

  constructor(command: string, detail: string, options?: ErrorOptions) {
    super(`\`${command}\` failed: ${detail}`, options);
  }
}

export class ReviewerOutputError extends Error {
  override readonly name = "ReviewerOutputError" as const;

  constructor(command: string, options?: ErrorOptions) {
    super(`\`${command}\` returned an output that does not match the findings schema.`, options);
  }
}

const buildCommand = (
  harness: Harness,
  request: ReviewRequest,
  schemaPath: string,
): Command => match(harness)
  .with("claude", () => ({
    args: [
      "claude", "-p",
      "--model", CLAUDE_MODEL,
      "--system-prompt", request.prompt,
      "--settings", JSON.stringify({ disableAllHooks: true }),
      // user・project・localの設定(permissions・plugins等)の読み込みを無効化
      "--setting-sources", "",
      "--no-session-persistence",
      "--disable-slash-commands",
      "--tools", "",
      "--output-format", "json",
      "--json-schema", reviewOutputJsonSchema,
    ],
    stdin: request.input,
    env: { ...NESTED_ENV, CLAUDE_CODE_DISABLE_CLAUDE_MDS: "1" },
    files: [],
  }))
  .with("codex", () => ({
    args: [
      "codex", "exec",
      "-m", CODEX_MODEL,
      "--disable", "hooks",
      "--ephemeral",
      "--output-schema", schemaPath,
      "--sandbox", "read-only",
      "--skip-git-repo-check",
    ],
    stdin: `${request.prompt}\n\n${request.input}`,
    env: NESTED_ENV,
    files: [{ path: schemaPath, text: reviewOutputJsonSchema }],
  }))
  .exhaustive();

const parseOutput = (
  harness: Harness,
  stdout: string,
): Result<Finding[], type.errors> => match(harness)
  .with("claude", () => {
    const output = claudeOutput(stdout);

    return output instanceof type.errors
      ? Err(output)
      : Ok(output.structured_output.findings);
  })
  .with("codex", () => {
    const output = codexOutput(stdout);

    return output instanceof type.errors ? Err(output) : Ok(output.findings);
  })
  .exhaustive();

const runCommand = async (
  command: Command,
  workDir: string,
): Promise<Result<CommandResult, unknown>> => {
  try {
    const child = Bun.spawn(command.args, {
      cwd: workDir,
      env: { ...process.env, ...command.env },
      stdin: new TextEncoder().encode(command.stdin),
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      child.stdout.text(),
      child.stderr.text(),
      child.exited,
    ]);

    return Ok({ exitCode, stdout, stderr });
  } catch (error) {
    return Err(error);
  }
};

const runReviewer = async (
  harness: Harness,
  request: ReviewRequest,
  workDir: string,
): Promise<Result<Finding[], ReviewerError>> => {
  const command = buildCommand(
    harness,
    request,
    join(workDir, SCHEMA_FILE_NAME),
  );
  const commandName = command.args.slice(0, 2).join(" ");
  for (const file of command.files) {
    await writeFile(file.path, file.text);
  }
  const result = await runCommand(command, workDir);
  if (result.isErr()) {
    return Err(new ReviewerCommandError(commandName, "the command could not be started", { cause: result.unwrapErr() }));
  }
  const { exitCode, stdout, stderr } = result.unwrap();
  if (exitCode !== 0) {
    return Err(new ReviewerCommandError(commandName, `exit code ${exitCode}: ${stderr.trim().slice(-STDERR_TAIL_LENGTH)}`));
  }

  return parseOutput(harness, stdout).mapErr(
    (errors) => new ReviewerOutputError(commandName, { cause: errors }),
  );
};

export const review = async (
  harness: Harness,
  request: ReviewRequest,
): Promise<Result<Finding[], ReviewerError>> => {
  // 作業中のプロジェクトのCLAUDE.md・AGENTS.mdを読み込まないための一時ディレクトリ
  const workDir = await mkdtemp(join(tmpdir(), TEMP_DIR_PREFIX));
  try {
    return await runReviewer(harness, request, workDir);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
};

const runReviews = async (
  detectedHarness: Result<Harness, HarnessDetectionError>,
  source: ReviewInputSource,
  reviews: ReviewKind[],
): Promise<ReviewSection[]> => {
  if (detectedHarness.isErr()) {
    return [];
  }
  const harness = detectedHarness.unwrap();

  return Promise.all(reviews.map(async ({ title, prompt, toInput }) => ({
    title,
    result: await review(harness, {
      prompt,
      input: toInput(source),
    }),
  })));
};

// harnessが不明な場合は、起動するCLIが決まらないため査読を省略
export const reviewResponses = async (
  detectedHarness: Result<Harness, HarnessDetectionError>,
  source: ReviewInputSource,
): Promise<ReviewSection[]> => runReviews(
  detectedHarness,
  source,
  [PROSE_REVIEW, VERIFICATION_REVIEW],
);

// 手動の検査では作業の記録が無いため、未確認事項の検査は対象外
export const reviewProse = async (
  detectedHarness: Result<Harness, HarnessDetectionError>,
  source: ReviewInputSource,
): Promise<ReviewSection[]> => runReviews(
  detectedHarness,
  source,
  [PROSE_REVIEW],
);
