import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import * as fsPromises from "node:fs/promises";
import * as os from "node:os";

import { Err, Ok } from "@cffnpwr/result-ts";
import { type } from "arktype";

import { HarnessDetectionError } from "../hook/harness.ts";

import { reviewOutputJsonSchema } from "./findings.ts";
import prosePrompt from "./prompts/prose.md" with { type: "text" };
import verificationPrompt from "./prompts/verification.md" with { type: "text" };
import { review, ReviewerCommandError, ReviewerOutputError, reviewProse, reviewResponses } from "./reviewer.ts";

describe("review", () => {
  afterEach(() => {
    mock.restore();
  });

  it("[positive] Claude Codeのとき、一時ディレクトリでclaude -pを起動し構造化出力から指摘を返す", async () => {
    spyOn(os, "tmpdir").mockReturnValue("/tmp");
    const mkdtemp = spyOn(fsPromises, "mkdtemp").mockResolvedValue("/tmp/w");
    const writeFile = spyOn(fsPromises, "writeFile").mockResolvedValue(undefined);
    const rm = spyOn(fsPromises, "rm").mockResolvedValue(undefined);
    const spawn = spyOn(Bun, "spawn").mockImplementation((() => ({
      stdout: new Response("{\"structured_output\":{\"findings\":[{\"rule\":\"calque\",\"quote\":\"安全側に倒す\",\"reason\":\"直訳\",\"suggestion\":\"安全を優先する\"}]}}").body,
      stderr: new Response("").body,
      exited: Promise.resolve(0),
    })) as never);

    const findings = await review("claude", { prompt: "査読する", input: "<conversation>本文</conversation>" });

    expect(findings.unwrap()).toEqual([{ rule: "calque", quote: "安全側に倒す", reason: "直訳", suggestion: "安全を優先する" }]);
    expect(mkdtemp.mock.calls).toEqual([["/tmp/check-response-"]]);
    expect(writeFile.mock.calls).toEqual([]);
    expect(spawn.mock.calls).toEqual([[
      [
        "claude", "-p",
        "--model", "haiku",
        "--system-prompt", "査読する",
        "--settings", "{\"disableAllHooks\":true}",
        "--setting-sources", "",
        "--no-session-persistence",
        "--disable-slash-commands",
        "--tools", "",
        "--output-format", "json",
        "--json-schema", reviewOutputJsonSchema,
      ],
      {
        cwd: "/tmp/w",
        env: { ...process.env, CHECK_RESPONSE_DISABLE: "1", CLAUDE_CODE_DISABLE_CLAUDE_MDS: "1" },
        stdin: new TextEncoder().encode("<conversation>本文</conversation>"),
        stdout: "pipe",
        stderr: "pipe",
      },
    ]]);
    expect(rm.mock.calls).toEqual([["/tmp/w", { recursive: true, force: true }]]);
    expect(spawn.mock.invocationCallOrder[0]).toBeLessThan(
      rm.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("[positive] Codexのとき、スキーマを書き出してからcodex execを起動し出力から指摘を返す", async () => {
    spyOn(os, "tmpdir").mockReturnValue("/tmp");
    const mkdtemp = spyOn(fsPromises, "mkdtemp").mockResolvedValue("/tmp/w");
    const writeFile = spyOn(fsPromises, "writeFile").mockResolvedValue(undefined);
    const rm = spyOn(fsPromises, "rm").mockResolvedValue(undefined);
    const spawn = spyOn(Bun, "spawn").mockImplementation((() => ({
      stdout: new Response("{\"findings\":[{\"rule\":\"calque\",\"quote\":\"安全側に倒す\",\"reason\":\"直訳\",\"suggestion\":\"安全を優先する\"}]}").body,
      stderr: new Response("").body,
      exited: Promise.resolve(0),
    })) as never);

    const findings = await review("codex", { prompt: "査読する", input: "<conversation>本文</conversation>" });

    expect(findings.unwrap()).toEqual([{ rule: "calque", quote: "安全側に倒す", reason: "直訳", suggestion: "安全を優先する" }]);
    expect(mkdtemp.mock.calls).toEqual([["/tmp/check-response-"]]);
    expect(writeFile.mock.calls).toEqual([["/tmp/w/schema.json", reviewOutputJsonSchema]]);
    expect(spawn.mock.calls).toEqual([[
      [
        "codex", "exec",
        "-m", "gpt-6-luna",
        "--disable", "hooks",
        "--ephemeral",
        "--output-schema", "/tmp/w/schema.json",
        "--sandbox", "read-only",
        "--skip-git-repo-check",
      ],
      {
        cwd: "/tmp/w",
        env: { ...process.env, CHECK_RESPONSE_DISABLE: "1" },
        stdin: new TextEncoder().encode("査読する\n\n<conversation>本文</conversation>"),
        stdout: "pipe",
        stderr: "pipe",
      },
    ]]);
    expect(rm.mock.calls).toEqual([["/tmp/w", { recursive: true, force: true }]]);
    expect(writeFile.mock.invocationCallOrder[0]).toBeLessThan(
      spawn.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("[negative] コマンドを起動できないときReviewerCommandErrorを返し、一時ディレクトリを消す", async () => {
    spyOn(os, "tmpdir").mockReturnValue("/tmp");
    const mkdtemp = spyOn(fsPromises, "mkdtemp").mockResolvedValue("/tmp/w");
    const writeFile = spyOn(fsPromises, "writeFile").mockResolvedValue(undefined);
    const rm = spyOn(fsPromises, "rm").mockResolvedValue(undefined);
    const spawn = spyOn(Bun, "spawn").mockImplementation((() => {
      throw new Error("ENOENT");
    }) as never);

    const findings = await review("claude", { prompt: "査読する", input: "本文" });

    expect(findings.unwrapErr()).toBeInstanceOf(ReviewerCommandError);
    expect(mkdtemp.mock.calls).toEqual([["/tmp/check-response-"]]);
    expect(writeFile.mock.calls).toEqual([]);
    expect(spawn.mock.calls).toEqual([[
      [
        "claude", "-p",
        "--model", "haiku",
        "--system-prompt", "査読する",
        "--settings", "{\"disableAllHooks\":true}",
        "--setting-sources", "",
        "--no-session-persistence",
        "--disable-slash-commands",
        "--tools", "",
        "--output-format", "json",
        "--json-schema", reviewOutputJsonSchema,
      ],
      {
        cwd: "/tmp/w",
        env: { ...process.env, CHECK_RESPONSE_DISABLE: "1", CLAUDE_CODE_DISABLE_CLAUDE_MDS: "1" },
        stdin: new TextEncoder().encode("本文"),
        stdout: "pipe",
        stderr: "pipe",
      },
    ]]);
    expect(rm.mock.calls).toEqual([["/tmp/w", { recursive: true, force: true }]]);
  });

  it.each([
    { name: "終了コードが0以外", stdout: "", exitCode: 1, want: ReviewerCommandError },
    { name: "出力がJSONでない", stdout: "tokens used", exitCode: 0, want: ReviewerOutputError },
    { name: "指摘に未宣言のキーを含む", stdout: "{\"findings\":[{\"rule\":\"r\",\"quote\":\"q\",\"reason\":\"r\",\"suggestion\":\"s\",\"extra\":1}]}", exitCode: 0, want: ReviewerOutputError },
    { name: "最上位に未宣言のキーを含む", stdout: "{\"findings\":[],\"extra\":1}", exitCode: 0, want: ReviewerOutputError },
  ])("[negative] codex execの$nameとき、エラーを返す", async ({ stdout, exitCode, want }) => {
    spyOn(os, "tmpdir").mockReturnValue("/tmp");
    const mkdtemp = spyOn(fsPromises, "mkdtemp").mockResolvedValue("/tmp/w");
    const writeFile = spyOn(fsPromises, "writeFile").mockResolvedValue(undefined);
    const rm = spyOn(fsPromises, "rm").mockResolvedValue(undefined);
    const spawn = spyOn(Bun, "spawn").mockImplementation((() => ({
      stdout: new Response(stdout).body,
      stderr: new Response("Error: not logged in").body,
      exited: Promise.resolve(exitCode),
    })) as never);

    const findings = await review("codex", { prompt: "査読する", input: "本文" });

    expect(findings.unwrapErr()).toBeInstanceOf(want);
    expect(mkdtemp.mock.calls).toEqual([["/tmp/check-response-"]]);
    expect(writeFile.mock.calls).toEqual([["/tmp/w/schema.json", reviewOutputJsonSchema]]);
    expect(spawn.mock.calls).toEqual([[
      [
        "codex", "exec",
        "-m", "gpt-6-luna",
        "--disable", "hooks",
        "--ephemeral",
        "--output-schema", "/tmp/w/schema.json",
        "--sandbox", "read-only",
        "--skip-git-repo-check",
      ],
      {
        cwd: "/tmp/w",
        env: { ...process.env, CHECK_RESPONSE_DISABLE: "1" },
        stdin: new TextEncoder().encode("査読する\n\n本文"),
        stdout: "pipe",
        stderr: "pipe",
      },
    ]]);
    expect(rm.mock.calls).toEqual([["/tmp/w", { recursive: true, force: true }]]);
  });

  it("[negative] claude -pの出力にstructured_outputが無いとき、検証エラーをcauseに持つReviewerOutputErrorを返す", async () => {
    spyOn(os, "tmpdir").mockReturnValue("/tmp");
    const mkdtemp = spyOn(fsPromises, "mkdtemp").mockResolvedValue("/tmp/w");
    const writeFile = spyOn(fsPromises, "writeFile").mockResolvedValue(undefined);
    const rm = spyOn(fsPromises, "rm").mockResolvedValue(undefined);
    const spawn = spyOn(Bun, "spawn").mockImplementation((() => ({
      stdout: new Response("{\"result\":\"{}\"}").body,
      stderr: new Response("").body,
      exited: Promise.resolve(0),
    })) as never);

    const findings = await review("claude", { prompt: "査読する", input: "本文" });

    expect(findings.unwrapErr()).toBeInstanceOf(ReviewerOutputError);
    expect(findings.unwrapErr().cause).toBeInstanceOf(type.errors);
    expect(mkdtemp.mock.calls).toEqual([["/tmp/check-response-"]]);
    expect(writeFile.mock.calls).toEqual([]);
    expect(spawn.mock.calls).toEqual([[
      [
        "claude", "-p",
        "--model", "haiku",
        "--system-prompt", "査読する",
        "--settings", "{\"disableAllHooks\":true}",
        "--setting-sources", "",
        "--no-session-persistence",
        "--disable-slash-commands",
        "--tools", "",
        "--output-format", "json",
        "--json-schema", reviewOutputJsonSchema,
      ],
      {
        cwd: "/tmp/w",
        env: { ...process.env, CHECK_RESPONSE_DISABLE: "1", CLAUDE_CODE_DISABLE_CLAUDE_MDS: "1" },
        stdin: new TextEncoder().encode("本文"),
        stdout: "pipe",
        stderr: "pipe",
      },
    ]]);
    expect(rm.mock.calls).toEqual([["/tmp/w", { recursive: true, force: true }]]);
  });
});

describe("reviewResponses", () => {
  afterEach(() => {
    mock.restore();
  });

  it("[positive] harnessが判定できたとき、文章の査読と未確認事項の検査の結果を題名付きで返す", async () => {
    spyOn(os, "tmpdir").mockReturnValue("/tmp");
    const mkdtemp = spyOn(fsPromises, "mkdtemp").mockResolvedValue("/tmp/w");
    const writeFile = spyOn(fsPromises, "writeFile").mockResolvedValue(undefined);
    const rm = spyOn(fsPromises, "rm").mockResolvedValue(undefined);
    const spawn = spyOn(Bun, "spawn").mockImplementation((() => ({
      stdout: new Response("{\"findings\":[]}").body,
      stderr: new Response("").body,
      exited: Promise.resolve(0),
    })) as never);

    const sections = await reviewResponses(Ok("codex"), {
      conversation: { kind: "after-user-message", userMessageLine: 2, history: [{ kind: "response", text: "前の応答" }], events: [{ kind: "response", text: "本文" }] },
      confirmedFindings: [],
      findingsToJudge: ["- 候補"],
    });

    expect(sections.map(({ title, result }) => ({
      title,
      findings: result.unwrap(),
    }))).toEqual([
      { title: "Prose review", findings: [] },
      { title: "Verification review", findings: [] },
    ]);
    expect(mkdtemp.mock.calls).toEqual([["/tmp/check-response-"], ["/tmp/check-response-"]]);
    expect(writeFile.mock.calls).toEqual([["/tmp/w/schema.json", reviewOutputJsonSchema], ["/tmp/w/schema.json", reviewOutputJsonSchema]]);
    expect(spawn.mock.calls).toEqual([
      {
        prompt: prosePrompt,
        input: "<earlier-turns>\n<response>\n前の応答\n</response>\n</earlier-turns>\n<conversation>\n<response-to-review>\n本文\n</response-to-review>\n</conversation>\n<textlint-findings-already-reported></textlint-findings-already-reported>\n<textlint-findings-to-judge>\n- 候補\n</textlint-findings-to-judge>",
      },
      {
        prompt: verificationPrompt,
        input: "<conversation>\n<reviewed-response>\n前の応答\n</reviewed-response>\n<final-response>\n本文\n</final-response>\n</conversation>\n<textlint-findings-already-reported></textlint-findings-already-reported>",
      },
    ].map(({ prompt, input }) => [
      [
        "codex", "exec",
        "-m", "gpt-6-luna",
        "--disable", "hooks",
        "--ephemeral",
        "--output-schema", "/tmp/w/schema.json",
        "--sandbox", "read-only",
        "--skip-git-repo-check",
      ],
      {
        cwd: "/tmp/w",
        env: { ...process.env, CHECK_RESPONSE_DISABLE: "1" },
        stdin: new TextEncoder().encode(`${prompt}\n\n${input}`),
        stdout: "pipe",
        stderr: "pipe",
      },
    ]));
    expect(rm.mock.calls).toEqual([["/tmp/w", { recursive: true, force: true }], ["/tmp/w", { recursive: true, force: true }]]);
  });

  it("[negative] harnessを判定できなかったとき、CLIを起動せず空の配列を返す", async () => {
    const mkdtemp = spyOn(fsPromises, "mkdtemp").mockImplementation((() => {
      throw new Error("unexpected call");
    }) as never);
    const spawn = spyOn(Bun, "spawn").mockImplementation((() => {
      throw new Error("unexpected call");
    }) as never);

    const sections = await reviewResponses(Err(new HarnessDetectionError("no ancestor")), { conversation: { kind: "no-user-message", events: [{ kind: "response", text: "本文" }] }, confirmedFindings: [], findingsToJudge: [] });

    expect(sections).toEqual([]);
    expect(mkdtemp.mock.calls).toEqual([]);
    expect(spawn.mock.calls).toEqual([]);
  });
});

describe("reviewProse", () => {
  afterEach(() => {
    mock.restore();
  });

  it("[positive] harnessが判定できたとき、文章の査読だけを実行して結果を返す", async () => {
    spyOn(os, "tmpdir").mockReturnValue("/tmp");
    spyOn(fsPromises, "mkdtemp").mockResolvedValue("/tmp/w");
    spyOn(fsPromises, "writeFile").mockResolvedValue(undefined);
    spyOn(fsPromises, "rm").mockResolvedValue(undefined);
    const spawn = spyOn(Bun, "spawn").mockImplementation((() => ({
      stdout: new Response("{\"structured_output\":{\"findings\":[]}}").body,
      stderr: new Response("").body,
      exited: Promise.resolve(0),
    })) as never);

    const sections = await reviewProse(Ok("claude"), { conversation: { kind: "no-user-message", events: [{ kind: "response", text: "本文" }] }, confirmedFindings: [], findingsToJudge: [] });

    expect(sections.map(({ title, result }) => ({ title, findings: result.unwrap() }))).toEqual([{ title: "Prose review", findings: [] }]);
    expect(spawn.mock.calls).toEqual([[
      [
        "claude", "-p",
        "--model", "haiku",
        "--system-prompt", prosePrompt,
        "--settings", "{\"disableAllHooks\":true}",
        "--setting-sources", "",
        "--no-session-persistence",
        "--disable-slash-commands",
        "--tools", "",
        "--output-format", "json",
        "--json-schema", reviewOutputJsonSchema,
      ],
      {
        cwd: "/tmp/w",
        env: { ...process.env, CHECK_RESPONSE_DISABLE: "1", CLAUDE_CODE_DISABLE_CLAUDE_MDS: "1" },
        stdin: new TextEncoder().encode("<conversation>\n<response-to-review>\n本文\n</response-to-review>\n</conversation>\n<textlint-findings-already-reported></textlint-findings-already-reported>\n<textlint-findings-to-judge></textlint-findings-to-judge>"),
        stdout: "pipe",
        stderr: "pipe",
      },
    ]]);
  });

  it("[negative] harnessを判定できなかったとき、CLIを起動せず空の配列を返す", async () => {
    const spawn = spyOn(Bun, "spawn").mockImplementation((() => {
      throw new Error("unexpected call");
    }) as never);

    const sections = await reviewProse(Err(new HarnessDetectionError("no ancestor")), { conversation: { kind: "no-user-message", events: [{ kind: "response", text: "本文" }] }, confirmedFindings: [], findingsToJudge: [] });

    expect(sections).toEqual([]);
    expect(spawn.mock.calls).toEqual([]);
  });
});
