import { describe, expect, it } from "bun:test";

import { type } from "arktype";

import type { Mode } from "./cli-args.ts";

import { CliArgsError, parseCliArgs } from "./cli-args.ts";

describe("parseCliArgs", () => {
  it.each<{ name: string; args: string[]; want: Mode; }>([
    { name: "引数が無い", args: [], want: { kind: "hook" } },
    { name: "--textだけがある", args: ["--text", "a.md"], want: { kind: "text", path: "a.md", llm: true } },
    { name: "--textに標準入力を指定し--no-llmがある", args: ["--text", "-", "--no-llm"], want: { kind: "text", path: "-", llm: false } },
    { name: "--scanとtranscriptがある", args: ["--scan", "a.jsonl", "b.jsonl"], want: { kind: "scan", transcripts: ["a.jsonl", "b.jsonl"], harness: undefined } },
    { name: "--scanと--harnessがある", args: ["--scan", "--harness", "codex", "a.jsonl"], want: { kind: "scan", transcripts: ["a.jsonl"], harness: "codex" } },
  ])("[positive] $nameとき、起動方法を返す", ({ args, want }) => {
    const parsed = parseCliArgs(args);

    expect(parsed.unwrap()).toEqual(want);
  });

  it.each<{ name: string; args: string[]; }>([
    { name: "未定義のオプションがある", args: ["--bogus"] },
    { name: "--textに値が無い", args: ["--text"] },
  ])("[negative] $nameとき、parseArgsの例外を原因とするCliArgsErrorを返す", ({ args }) => {
    const parsed = parseCliArgs(args);

    expect(parsed.unwrapErr()).toBeInstanceOf(CliArgsError);
    expect(parsed.unwrapErr().cause).toBeInstanceOf(TypeError);
  });

  it.each<{ name: string; args: string[]; }>([
    { name: "--textにtranscriptが続く", args: ["--text", "a.md", "b.md"] },
    { name: "--textと--scanがある", args: ["--text", "a.md", "--scan", "a.jsonl"] },
    { name: "--scanにtranscriptが無い", args: ["--scan"] },
    { name: "--scanと--no-llmがある", args: ["--scan", "--no-llm", "a.jsonl"] },
    { name: "--harnessが不正な値", args: ["--scan", "--harness", "gemini", "a.jsonl"] },
    { name: "--harnessだけがある", args: ["--harness", "claude"] },
    { name: "--no-llmだけがある", args: ["--no-llm"] },
    { name: "オプションの無いファイルがある", args: ["a.md"] },
  ])("[negative] $nameとき、検証エラーを原因とするCliArgsErrorを返す", ({ args }) => {
    const parsed = parseCliArgs(args);

    expect(parsed.unwrapErr()).toBeInstanceOf(CliArgsError);
    expect(parsed.unwrapErr().cause).toBeInstanceOf(type.errors);
  });
});
