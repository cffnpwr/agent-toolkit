import { afterEach, beforeEach, describe, expect, it, mock, setSystemTime, spyOn } from "bun:test";
import * as fsPromises from "node:fs/promises";
import * as os from "node:os";

import * as textlint from "textlint";

import { reviewOutputJsonSchema } from "./llm-review/findings.ts";
import prosePrompt from "./llm-review/prompts/prose.md" with { type: "text" };
import verificationPrompt from "./llm-review/prompts/verification.md" with { type: "text" };
import { BLOCK_LIMIT_NOTICE, STOP_INSTRUCTION } from "./report.ts";
import { runStop } from "./stop.ts";

const NOW = new Date("2026-10-25T00:00:00.000Z");

const CLAUDE_ARGS = (prompt: string): string[] => [
  "claude", "-p",
  "--model", "haiku",
  "--system-prompt", prompt,
  "--settings", "{\"disableAllHooks\":true}",
  "--setting-sources", "",
  "--no-session-persistence",
  "--disable-slash-commands",
  "--tools", "",
  "--output-format", "json",
  "--json-schema", reviewOutputJsonSchema,
];

const CODEX_ARGS = [
  "codex", "exec",
  "-m", "gpt-6-luna",
  "--disable", "hooks",
  "--ephemeral",
  "--output-schema", "/tmp/w/schema.json",
  "--sandbox", "read-only",
  "--skip-git-repo-check",
];

const calque = { rule: "calque", quote: "安全側に倒す", reason: "直訳", suggestion: "安全を優先する" };

const frank = { rule: "frank", quote: "めっちゃ", reason: "くだけた表現", suggestion: "とても" };

const jsonl = (entries: unknown[]): string => entries.map((entry) => JSON.stringify(entry)).join("\n");

const unexpectedCall = (() => {
  throw new Error("unexpected call");
}) as never;

const mockReadFile = (files: Map<string, string>): ReturnType<typeof spyOn> => spyOn(fsPromises, "readFile").mockImplementation((async (path: string) => {
  const content = files.get(path);
  if (content === undefined) {
    throw new Error("ENOENT");
  }

  return content;
}) as never);

type LintText = (
  text: string,
  filePath: string,
) => Promise<{ messages: unknown[]; }>;

// 設定ファイルの読み込みを、規則を加える操作だけを持つ記述子に置換
const mockLinter = (lintText: LintText): void => {
  spyOn(textlint, "loadTextlintrc").mockResolvedValue({ rule: { toKernelRulesFormat: () => [] }, shallowMerge: () => ({}) } as never);
  spyOn(textlint, "createLinter").mockReturnValue({ lintText } as never);
};

const mockSpawn = (stdouts: string[]): ReturnType<typeof spyOn> => {
  const remaining = [...stdouts];

  return spyOn(Bun, "spawn").mockImplementation((() => ({
    stdout: new Response(remaining.shift() ?? "").body,
    stderr: new Response("").body,
    exited: Promise.resolve(0),
  })) as never);
};

const logLine = (entry: Record<string, unknown>): string => `${JSON.stringify({ time: NOW.toISOString(), session_id: "s1", ...entry })}\n`;

describe("runStop", () => {
  const savedHarness = process.env.CHECK_RESPONSE_HARNESS;
  const savedCacheHome = process.env.XDG_CACHE_HOME;
  const savedStateHome = process.env.XDG_STATE_HOME;

  beforeEach(() => {
    delete process.env.CHECK_RESPONSE_HARNESS;
    process.env.XDG_CACHE_HOME = "/cache";
    process.env.XDG_STATE_HOME = "/state";
    setSystemTime(NOW);
    spyOn(os, "tmpdir").mockReturnValue("/tmp");
    spyOn(fsPromises, "stat").mockRejectedValue(new Error("ENOENT"));
  });

  afterEach(() => {
    mock.restore();
    setSystemTime();
    for (const [name, value] of [["CHECK_RESPONSE_HARNESS", savedHarness], ["XDG_CACHE_HOME", savedCacheHome], ["XDG_STATE_HOME", savedStateHome]] as const) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  });

  it("[positive] Claude Codeで未検査の応答に確定した違反があるとき、前のターンを文脈にして判定が必要な指摘とともに両方の査読を実行し、差し戻しを記録してexit 2で差し戻す", async () => {
    process.env.CHECK_RESPONSE_HARNESS = "claude";
    const readFile = mockReadFile(new Map([
      ["/t.jsonl", jsonl([
        { type: "user", origin: { kind: "human" }, message: { role: "user", content: "前の依頼" } },
        { type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "前の応答" }] } },
        { type: "user", origin: { kind: "human" }, message: { role: "user", content: "依頼" } },
        { type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "途中です。" }] } },
        { type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", id: "toolu_1", name: "Bash", input: { command: "bun test" } }] } },
        { type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "3 pass" }] } },
      ])],
    ]));
    const mkdir = spyOn(fsPromises, "mkdir").mockResolvedValue(undefined);
    const writeFile = spyOn(fsPromises, "writeFile").mockResolvedValue(undefined);
    const appendFile = spyOn(fsPromises, "appendFile").mockResolvedValue(undefined);
    const mkdtemp = spyOn(fsPromises, "mkdtemp").mockResolvedValue("/tmp/w");
    const rm = spyOn(fsPromises, "rm").mockResolvedValue(undefined);
    const spawn = mockSpawn([
      JSON.stringify({ structured_output: { findings: [calque] } }),
      JSON.stringify({ structured_output: { findings: [] } }),
    ]);
    const lintText = mock(async (text: string, _filePath: string) => ({
      messages: text.includes("要するに")
        ? [
          { ruleId: "morphology", message: "足し => 追加する", severity: 2, loc: { start: { line: 1 } } },
          { ruleId: "prh", message: "要するに => 削除", severity: 1, loc: { start: { line: 1 } } },
        ]
        : [],
    }));
    mockLinter(lintText);

    const output = await runStop({ hook_event_name: "Stop", session_id: "s1", transcript_path: "/t.jsonl", stop_hook_active: false, last_assistant_message: "要するに安全側に倒す設定を足しました。" });

    const lineText = "要するに安全側に倒す設定を足しました。";
    const proseInput = [
      "<earlier-turns>",
      "<user-message>\n前の依頼\n</user-message>",
      "<response>\n前の応答\n</response>",
      "</earlier-turns>",
      "<conversation>",
      "<user-message>\n依頼\n</user-message>",
      "<response-to-review>\n途中です。\n</response-to-review>",
      `<response-to-review>\n${lineText}\n</response-to-review>`,
      "</conversation>",
      `<textlint-findings-already-reported>\n- line 1 "${lineText}": 足し => 追加する (morphology)\n</textlint-findings-already-reported>`,
      `<textlint-findings-to-judge>\n- line 1 "${lineText}": 要するに => 削除 (prh)\n</textlint-findings-to-judge>`,
    ].join("\n");
    const verificationInput = [
      "<conversation>",
      "<reviewed-response>\n前の応答\n</reviewed-response>",
      "<user-message>\n依頼\n</user-message>",
      "<response>\n途中です。\n</response>",
      "<tool-call name=\"Bash\">\n<input>\n{\"command\":\"bun test\"}\n</input>\n<result>\n3 pass\n</result>\n</tool-call>",
      `<final-response>\n${lineText}\n</final-response>`,
      "</conversation>",
      `<textlint-findings-already-reported>\n- line 1 "${lineText}": 足し => 追加する (morphology)\n</textlint-findings-already-reported>`,
    ].join("\n");
    const message = [
      `check-response: ${STOP_INSTRUCTION}`,
      "",
      "textlint (Japanese style rules):",
      `- line 1 "${lineText}": 足し => 追加する (morphology)`,
      "",
      "Prose review:",
      "- calque: \"安全側に倒す\" -- 直訳 Suggested fix: 安全を優先する",
    ].join("\n");
    expect(output).toEqual({ exitCode: 2, message });
    expect(readFile.mock.calls).toEqual([["/cache/check-response/s1", "utf8"], ["/t.jsonl", "utf8"]]);
    expect(lintText.mock.calls).toEqual([["途中です。", "response.md"], [lineText, "response.md"]]);
    expect(spawn.mock.calls).toEqual([
      { prompt: prosePrompt, input: proseInput },
      { prompt: verificationPrompt, input: verificationInput },
    ].map(({ prompt, input }) => [
      CLAUDE_ARGS(prompt),
      {
        cwd: "/tmp/w",
        env: { ...process.env, CHECK_RESPONSE_DISABLE: "1", CLAUDE_CODE_DISABLE_CLAUDE_MDS: "1" },
        stdin: new TextEncoder().encode(input),
        stdout: "pipe",
        stderr: "pipe",
      },
    ]));
    expect(mkdtemp.mock.calls).toEqual([["/tmp/check-response-"], ["/tmp/check-response-"]]);
    expect(rm.mock.calls).toEqual([["/tmp/w", { recursive: true, force: true }], ["/tmp/w", { recursive: true, force: true }]]);
    expect(mkdir.mock.calls).toEqual([["/cache/check-response", { recursive: true }], ["/state/check-response", { recursive: true }]]);
    expect(writeFile.mock.calls).toEqual([[
      "/cache/check-response/s1",
      `${JSON.stringify({ reviewed: { userMessageLine: 2, responseCount: 2 }, block: { userMessageLine: 2, count: 1, findings: [calque] } })}\n`,
    ]]);
    expect(appendFile.mock.calls).toEqual([["/state/check-response/log.jsonl", logLine({
      harness: "claude",
      block_count: 0,
      confirmed: [{ certainty: "confirmed", line: 1, lineText, ruleId: "morphology", message: "足し => 追加する" }],
      needs_judgment: [{ certainty: "needs-judgment", line: 1, lineText, ruleId: "prh", message: "要するに => 削除" }],
      reviews: [{ title: "Prose review", findings: [calque] }, { title: "Verification review", findings: [] }],
      warnings: [],
      responses: ["途中です。", lineText],
      outcome: "block",
    })]]);
  });

  it("[positive] Codexで違反が無いとき、検査済みの応答を記録して通過する", async () => {
    process.env.CHECK_RESPONSE_HARNESS = "codex";
    const readFile = mockReadFile(new Map([
      ["/r.jsonl", jsonl([
        { type: "event_msg", payload: { type: "item_completed", item: { type: "UserMessage", content: [{ type: "text", text: "依頼" }] } } },
        { type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "完了しました。" }] } },
      ])],
    ]));
    spyOn(fsPromises, "mkdir").mockResolvedValue(undefined);
    const writeFile = spyOn(fsPromises, "writeFile").mockResolvedValue(undefined);
    const appendFile = spyOn(fsPromises, "appendFile").mockResolvedValue(undefined);
    spyOn(fsPromises, "mkdtemp").mockResolvedValue("/tmp/w");
    spyOn(fsPromises, "rm").mockResolvedValue(undefined);
    const spawn = mockSpawn(["{\"findings\":[]}", "{\"findings\":[]}"]);
    mockLinter(async () => ({ messages: [] }));

    const output = await runStop({ hook_event_name: "Stop", session_id: "s1", transcript_path: "/r.jsonl", stop_hook_active: false, last_assistant_message: "完了しました。" });

    const proseInput = [
      "<conversation>",
      "<user-message>\n依頼\n</user-message>",
      "<response-to-review>\n完了しました。\n</response-to-review>",
      "</conversation>",
      "<textlint-findings-already-reported></textlint-findings-already-reported>",
      "<textlint-findings-to-judge></textlint-findings-to-judge>",
    ].join("\n");
    const verificationInput = [
      "<conversation>",
      "<user-message>\n依頼\n</user-message>",
      "<final-response>\n完了しました。\n</final-response>",
      "</conversation>",
      "<textlint-findings-already-reported></textlint-findings-already-reported>",
    ].join("\n");
    expect(output).toEqual({ exitCode: 0 });
    expect(readFile.mock.calls).toEqual([["/cache/check-response/s1", "utf8"], ["/r.jsonl", "utf8"]]);
    expect(spawn.mock.calls).toEqual([
      { prompt: prosePrompt, input: proseInput },
      { prompt: verificationPrompt, input: verificationInput },
    ].map(({ prompt, input }) => [
      CODEX_ARGS,
      {
        cwd: "/tmp/w",
        env: { ...process.env, CHECK_RESPONSE_DISABLE: "1" },
        stdin: new TextEncoder().encode(`${prompt}\n\n${input}`),
        stdout: "pipe",
        stderr: "pipe",
      },
    ]));
    expect(writeFile.mock.calls).toEqual([
      ["/tmp/w/schema.json", reviewOutputJsonSchema],
      ["/tmp/w/schema.json", reviewOutputJsonSchema],
      ["/cache/check-response/s1", "{\"reviewed\":{\"userMessageLine\":0,\"responseCount\":1}}\n"],
    ]);
    expect(appendFile.mock.calls).toEqual([["/state/check-response/log.jsonl", logLine({
      harness: "codex",
      block_count: 0,
      confirmed: [],
      needs_judgment: [],
      reviews: [{ title: "Prose review", findings: [] }, { title: "Verification review", findings: [] }],
      warnings: [],
      responses: ["完了しました。"],
      outcome: "pass",
    })]]);
  });

  it("[positive] 差し戻し後の応答に前の指摘の引用が残っているとき、残った指摘だけで差し戻し、新しい指摘は差し戻さない指摘として添え、差し戻しの回数を増やす", async () => {
    process.env.CHECK_RESPONSE_HARNESS = "claude";
    const block = { userMessageLine: 0, count: 1, findings: [calque] };
    mockReadFile(new Map([
      ["/cache/check-response/s1", JSON.stringify({ reviewed: { userMessageLine: 0, responseCount: 1 }, block })],
      ["/t.jsonl", jsonl([
        { type: "user", origin: { kind: "human" }, message: { role: "user", content: "依頼" } },
        { type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "安全側に倒す設定です。" }] } },
        { type: "user", isMeta: true, message: { role: "user", content: "Stop hook feedback:\n[/hooks/check-response.sh]: check-response: 差し戻し" } },
      ])],
    ]));
    spyOn(fsPromises, "mkdir").mockResolvedValue(undefined);
    const writeFile = spyOn(fsPromises, "writeFile").mockResolvedValue(undefined);
    spyOn(fsPromises, "appendFile").mockResolvedValue(undefined);
    spyOn(fsPromises, "mkdtemp").mockResolvedValue("/tmp/w");
    spyOn(fsPromises, "rm").mockResolvedValue(undefined);
    mockSpawn([
      JSON.stringify({ structured_output: { findings: [calque, frank] } }),
      JSON.stringify({ structured_output: { findings: [] } }),
    ]);
    mockLinter(async () => ({ messages: [] }));

    const output = await runStop({ hook_event_name: "Stop", session_id: "s1", transcript_path: "/t.jsonl", stop_hook_active: true, last_assistant_message: "めっちゃ安全側に倒す設定です。" });

    expect(output).toEqual({
      exitCode: 2,
      message: [
        `check-response: ${STOP_INSTRUCTION}`,
        "",
        "Findings from the previous block that are still in the response:",
        "- calque: \"安全側に倒す\" -- 直訳 Suggested fix: 安全を優先する",
        "",
        "Prose review (new findings after the previous block; not sent back):",
        "- frank: \"めっちゃ\" -- くだけた表現 Suggested fix: とても",
      ].join("\n"),
    });
    expect(writeFile.mock.calls).toEqual([[
      "/cache/check-response/s1",
      `${JSON.stringify({ reviewed: { userMessageLine: 0, responseCount: 2 }, block: { userMessageLine: 0, count: 2, findings: [calque] } })}\n`,
    ]]);
  });

  it("[positive] 差し戻し後の応答に新しい指摘だけがあるとき、exit 1で警告し、差し戻しの記録を変えない", async () => {
    process.env.CHECK_RESPONSE_HARNESS = "claude";
    const block = { userMessageLine: 0, count: 1, findings: [calque] };
    mockReadFile(new Map([
      ["/cache/check-response/s1", JSON.stringify({ reviewed: { userMessageLine: 0, responseCount: 1 }, block })],
      ["/t.jsonl", jsonl([
        { type: "user", origin: { kind: "human" }, message: { role: "user", content: "依頼" } },
        { type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "安全側に倒す設定です。" }] } },
      ])],
    ]));
    spyOn(fsPromises, "mkdir").mockResolvedValue(undefined);
    const writeFile = spyOn(fsPromises, "writeFile").mockResolvedValue(undefined);
    spyOn(fsPromises, "appendFile").mockResolvedValue(undefined);
    spyOn(fsPromises, "mkdtemp").mockResolvedValue("/tmp/w");
    spyOn(fsPromises, "rm").mockResolvedValue(undefined);
    mockSpawn([
      JSON.stringify({ structured_output: { findings: [frank] } }),
      JSON.stringify({ structured_output: { findings: [] } }),
    ]);
    mockLinter(async () => ({ messages: [] }));

    const output = await runStop({ hook_event_name: "Stop", session_id: "s1", transcript_path: "/t.jsonl", stop_hook_active: true, last_assistant_message: "めっちゃ安全を優先する設定です。" });

    expect(output).toEqual({
      exitCode: 1,
      message: "check-response: Prose review (new findings after the previous block; not sent back):\n- frank: \"めっちゃ\" -- くだけた表現 Suggested fix: とても",
    });
    expect(writeFile.mock.calls).toEqual([[
      "/cache/check-response/s1",
      `${JSON.stringify({ reviewed: { userMessageLine: 0, responseCount: 2 }, block })}\n`,
    ]]);
  });

  it("[negative] このターンで3回差し戻した後に確定した違反があるとき、差し戻さずにexit 1で警告する", async () => {
    process.env.CHECK_RESPONSE_HARNESS = "claude";
    const block = { userMessageLine: 0, count: 3, findings: [] };
    mockReadFile(new Map([
      ["/cache/check-response/s1", JSON.stringify({ reviewed: { userMessageLine: 0, responseCount: 0 }, block })],
      ["/t.jsonl", jsonl([{ type: "user", origin: { kind: "human" }, message: { role: "user", content: "依頼" } }])],
    ]));
    spyOn(fsPromises, "mkdir").mockResolvedValue(undefined);
    const writeFile = spyOn(fsPromises, "writeFile").mockResolvedValue(undefined);
    spyOn(fsPromises, "appendFile").mockResolvedValue(undefined);
    spyOn(fsPromises, "mkdtemp").mockResolvedValue("/tmp/w");
    spyOn(fsPromises, "rm").mockResolvedValue(undefined);
    const noFindings = JSON.stringify({ structured_output: { findings: [] } });
    mockSpawn([noFindings, noFindings]);
    mockLinter(async () => ({ messages: [{ ruleId: "morphology", message: "足し => 追加する", severity: 2, loc: { start: { line: 1 } } }] }));

    const output = await runStop({ hook_event_name: "Stop", session_id: "s1", transcript_path: "/t.jsonl", stop_hook_active: true, last_assistant_message: "設定を足しました。" });

    expect(output).toEqual({
      exitCode: 1,
      message: `check-response: ${BLOCK_LIMIT_NOTICE}\n\ntextlint (Japanese style rules):\n- line 1 "設定を足しました。": 足し => 追加する (morphology)`,
    });
    expect(writeFile.mock.calls).toEqual([[
      "/cache/check-response/s1",
      `${JSON.stringify({ reviewed: { userMessageLine: 0, responseCount: 1 }, block })}\n`,
    ]]);
  });

  it("[negative] transcriptが無く未検査の応答に日本語が無いとき、記録せずにログだけを書いて通過する", async () => {
    process.env.CHECK_RESPONSE_HARNESS = "claude";
    const readFile = spyOn(fsPromises, "readFile").mockRejectedValue(new Error("ENOENT"));
    spyOn(fsPromises, "mkdir").mockResolvedValue(undefined);
    const writeFile = spyOn(fsPromises, "writeFile").mockImplementation(unexpectedCall);
    const appendFile = spyOn(fsPromises, "appendFile").mockResolvedValue(undefined);
    const spawn = spyOn(Bun, "spawn").mockImplementation(unexpectedCall);
    const createLinter = spyOn(textlint, "createLinter").mockImplementation(unexpectedCall);

    const output = await runStop({ hook_event_name: "Stop", session_id: "s1", transcript_path: null, stop_hook_active: false, last_assistant_message: "Done." });

    expect(output).toEqual({ exitCode: 0 });
    expect(readFile.mock.calls).toEqual([["/cache/check-response/s1", "utf8"]]);
    expect(writeFile.mock.calls).toEqual([]);
    expect(spawn.mock.calls).toEqual([]);
    expect(createLinter.mock.calls).toEqual([]);
    expect(appendFile.mock.calls).toEqual([["/state/check-response/log.jsonl", logLine({
      harness: "claude",
      block_count: 0,
      confirmed: [],
      needs_judgment: [],
      reviews: [],
      warnings: [],
      responses: ["Done."],
      outcome: "skipped",
    })]]);
  });

  it("[negative] harnessを判定できないとき、最後の応答だけをtextlintで検査し、警告付きで差し戻す", async () => {
    spyOn(os, "platform").mockReturnValue("win32");
    const readFile = spyOn(fsPromises, "readFile").mockRejectedValue(new Error("ENOENT"));
    spyOn(fsPromises, "mkdir").mockResolvedValue(undefined);
    const writeFile = spyOn(fsPromises, "writeFile").mockResolvedValue(undefined);
    const appendFile = spyOn(fsPromises, "appendFile").mockResolvedValue(undefined);
    const spawn = spyOn(Bun, "spawn").mockImplementation(unexpectedCall);
    const lintText = mock(async (_text: string, _filePath: string) => ({
      messages: [{ ruleId: "morphology", message: "足し => 追加する", severity: 2, loc: { start: { line: 1 } } }],
    }));
    mockLinter(lintText);

    const output = await runStop({ hook_event_name: "Stop", session_id: "s1", transcript_path: "/t.jsonl", stop_hook_active: false, last_assistant_message: "設定を足した。" });

    const harnessError = "Cannot tell whether Claude Code or Codex runs this hook: reading the process tree on win32 is not supported, and CHECK_RESPONSE_HARNESS is not set.";
    expect(output).toEqual({
      exitCode: 2,
      message: [
        `check-response: ${STOP_INSTRUCTION}`,
        "",
        "textlint (Japanese style rules):",
        "- line 1 \"設定を足した。\": 足し => 追加する (morphology)",
        "",
        "The check could not finish:",
        `- ${harnessError}`,
      ].join("\n"),
    });
    expect(readFile.mock.calls).toEqual([["/cache/check-response/s1", "utf8"], ["/t.jsonl", "utf8"]]);
    expect(lintText.mock.calls).toEqual([["設定を足した。", "response.md"]]);
    expect(spawn.mock.calls).toEqual([]);
    expect(writeFile.mock.calls).toEqual([["/cache/check-response/s1", `${JSON.stringify({ block: { userMessageLine: null, count: 1, findings: [] } })}\n`]]);
    expect(appendFile.mock.calls).toEqual([["/state/check-response/log.jsonl", logLine({
      harness: { error: harnessError },
      block_count: 0,
      confirmed: [{ certainty: "confirmed", line: 1, lineText: "設定を足した。", ruleId: "morphology", message: "足し => 追加する" }],
      needs_judgment: [],
      reviews: [],
      warnings: [harnessError],
      responses: ["設定を足した。"],
      outcome: "block",
    })]]);
  });
});
