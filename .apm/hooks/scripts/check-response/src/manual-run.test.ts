import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import * as fsPromises from "node:fs/promises";
import * as os from "node:os";

import * as textlint from "textlint";

import { checkText, scanTranscripts } from "./manual-run.ts";

const unexpectedCall = (() => {
  throw new Error("unexpected call");
}) as never;

type LintText = (
  text: string,
  filePath: string,
) => Promise<{ messages: unknown[]; }>;

const mockLinter = (lintText: LintText): void => {
  spyOn(textlint, "loadTextlintrc").mockResolvedValue({ rule: { toKernelRulesFormat: () => [] }, shallowMerge: () => ({}) } as never);
  spyOn(textlint, "createLinter").mockReturnValue({ lintText } as never);
};

const savedHarness = process.env.CHECK_RESPONSE_HARNESS;

beforeEach(() => {
  delete process.env.CHECK_RESPONSE_HARNESS;
});

afterEach(() => {
  mock.restore();
  if (savedHarness === undefined) {
    delete process.env.CHECK_RESPONSE_HARNESS;
  } else {
    process.env.CHECK_RESPONSE_HARNESS = savedHarness;
  }
});

describe("checkText", () => {
  it("[positive] 文章の査読を実行するとき、確定した指摘・判定が必要な指摘・査読の指摘を分けて出力し、exit 1にする", async () => {
    process.env.CHECK_RESPONSE_HARNESS = "claude";
    spyOn(os, "tmpdir").mockReturnValue("/tmp");
    spyOn(fsPromises, "mkdtemp").mockResolvedValue("/tmp/w");
    spyOn(fsPromises, "rm").mockResolvedValue(undefined);
    const spawn = spyOn(Bun, "spawn").mockImplementation((() => ({
      stdout: new Response(JSON.stringify({ structured_output: { findings: [{ rule: "personify", quote: "処理が走る", reason: "擬人化", suggestion: "処理を実行する" }] } })).body,
      stderr: new Response("").body,
      exited: Promise.resolve(0),
    })) as never);
    mockLinter(async () => ({
      messages: [
        { ruleId: "morphology", message: "足し => 追加する", severity: 2, loc: { start: { line: 1 } } },
        { ruleId: "morphology-needs-judgment", message: "が走る => 候補", severity: 1, loc: { start: { line: 2 } } },
      ],
    }));

    const output = await checkText({ text: "設定を足した。\n処理が走る。", llm: true });

    expect(output).toEqual({
      exitCode: 1,
      stdout: [
        "Confirmed (textlint):",
        "- line 1 \"設定を足した。\": 足し => 追加する (morphology)",
        "",
        "Needs judgment (textlint):",
        "- line 2 \"処理が走る。\": が走る => 候補 (morphology-needs-judgment)",
        "",
        "Prose review:",
        "- personify: \"処理が走る\" -- 擬人化 Suggested fix: 処理を実行する",
        "",
      ].join("\n"),
      stderr: "",
    });
    expect(spawn.mock.calls.length).toBe(1);
  });

  it("[negative] --no-llmで判定が必要な指摘だけがあるとき、査読を実行せずexit 0にする", async () => {
    const spawn = spyOn(Bun, "spawn").mockImplementation(unexpectedCall);
    mockLinter(async () => ({ messages: [{ ruleId: "prh", message: "候補", severity: 1, loc: { start: { line: 1 } } }] }));

    const output = await checkText({ text: "要するに完了です。", llm: false });

    expect(output).toEqual({
      exitCode: 0,
      stdout: "Needs judgment (textlint):\n- line 1 \"要するに完了です。\": 候補 (prh)\n",
      stderr: "",
    });
    expect(spawn.mock.calls).toEqual([]);
  });

  it("[negative] harnessを判定できないとき、査読を実行せず理由をstderrに出力する", async () => {
    spyOn(os, "platform").mockReturnValue("win32");
    const spawn = spyOn(Bun, "spawn").mockImplementation(unexpectedCall);
    mockLinter(async () => ({ messages: [] }));

    const output = await checkText({ text: "完了です。", llm: true });

    expect(output).toEqual({
      exitCode: 0,
      stdout: "",
      stderr: "The prose review was skipped: Cannot tell whether Claude Code or Codex runs this hook: reading the process tree on win32 is not supported, and CHECK_RESPONSE_HARNESS is not set.\n",
    });
    expect(spawn.mock.calls).toEqual([]);
  });

  it("[negative] 査読が失敗したとき、失敗の理由をstderrに出力する", async () => {
    process.env.CHECK_RESPONSE_HARNESS = "claude";
    spyOn(os, "tmpdir").mockReturnValue("/tmp");
    spyOn(fsPromises, "mkdtemp").mockResolvedValue("/tmp/w");
    spyOn(fsPromises, "rm").mockResolvedValue(undefined);
    spyOn(Bun, "spawn").mockImplementation((() => ({
      stdout: new Response("").body,
      stderr: new Response("not logged in").body,
      exited: Promise.resolve(1),
    })) as never);
    mockLinter(async () => ({ messages: [] }));

    const output = await checkText({ text: "完了です。", llm: true });

    expect(output).toEqual({ exitCode: 0, stdout: "", stderr: "`claude -p` failed: exit code 1: not logged in\n" });
  });
});

describe("scanTranscripts", () => {
  it("[positive] すべてのtranscriptの日本語の応答を検査し、規則ごとの件数を多い順に例を3件まで添えて出力する", async () => {
    const files = new Map([
      ["/a.jsonl", [
        { type: "user", origin: { kind: "human" }, message: { role: "user", content: "依頼" } },
        { type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "応答1" }] } },
        { type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "English only." }] } },
        { type: "user", origin: { kind: "human" }, message: { role: "user", content: "次の依頼" } },
        { type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "応答2" }] } },
      ].map((entry) => JSON.stringify(entry)).join("\n")],
      ["/b.jsonl", JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "応答3" }] } })],
    ]);
    const readFile = spyOn(fsPromises, "readFile").mockImplementation((async (path: string) => files.get(path)) as never);
    const lintText = mock(async (_text: string, _filePath: string) => ({
      messages: [
        { ruleId: "morphology", message: "足し => 追加する", severity: 2, loc: { start: { line: 1 } } },
        { ruleId: "prh", message: "候補", severity: 1, loc: { start: { line: 1 } } },
      ],
    }));
    lintText.mockImplementationOnce(async () => ({ messages: [{ ruleId: "prh", message: "候補", severity: 1, loc: { start: { line: 1 } } }] }));
    mockLinter(lintText);

    const output = await scanTranscripts({ transcripts: ["/a.jsonl", "/b.jsonl"], harness: "claude" });

    expect(output).toEqual({
      exitCode: 0,
      stdout: [
        "responses: 3",
        "    3 prh (needs judgment)",
        "        応答1 -- 候補",
        "        応答2 -- 候補",
        "        応答3 -- 候補",
        "    2 morphology",
        "        応答2 -- 足し => 追加する",
        "        応答3 -- 足し => 追加する",
        "",
      ].join("\n"),
      stderr: "",
    });
    expect(readFile.mock.calls).toEqual([["/a.jsonl", "utf8"], ["/b.jsonl", "utf8"]]);
    expect(lintText.mock.calls).toEqual([["応答1", "response.md"], ["応答2", "response.md"], ["応答3", "response.md"]]);
  });

  it("[negative] --harnessが無くharnessを判定できないとき、transcriptを読まずにexit 1にする", async () => {
    spyOn(os, "platform").mockReturnValue("win32");
    const readFile = spyOn(fsPromises, "readFile").mockImplementation(unexpectedCall);

    const output = await scanTranscripts({ transcripts: ["/a.jsonl"], harness: undefined });

    expect(output).toEqual({
      exitCode: 1,
      stdout: "",
      stderr: "Cannot tell whether Claude Code or Codex runs this hook: reading the process tree on win32 is not supported, and CHECK_RESPONSE_HARNESS is not set. Set it with --harness.\n",
    });
    expect(readFile.mock.calls).toEqual([]);
  });
});
