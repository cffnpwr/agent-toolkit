import { describe, expect, it } from "bun:test";

import { parseClaudeTranscript } from "./claude.ts";

describe("parseClaudeTranscript", () => {
  it("[positive] 最後のユーザーの発言以降の発言・ツール呼び出しと結果・応答を発生順に取り出し、前のターンの発言と応答を履歴にする", () => {
    const content = [
      { type: "user", origin: { kind: "human" }, promptSource: "typed", message: { role: "user", content: "前の依頼" } },
      { type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "前の応答" }] } },
      { type: "user", origin: { kind: "human" }, promptSource: "typed", message: { role: "user", content: "テストを実行して" } },
      { type: "assistant", message: { role: "assistant", content: [{ type: "thinking", thinking: "考え中" }] } },
      { type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", id: "toolu_1", name: "Bash", input: { command: "bun test" } }] } },
      { type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "3 pass" }] } },
      { type: "system", subtype: "stop_hook_summary" },
      { type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "3件成功しました。" }] } },
    ].map((entry) => JSON.stringify(entry)).join("\n");

    const conversation = parseClaudeTranscript(content);

    expect(conversation).toEqual({
      kind: "after-user-message",
      instructionFiles: [],
      userMessageLine: 2,
      history: [{ kind: "user-message", text: "前の依頼" }, { kind: "response", text: "前の応答" }],
      previousToolCalls: [],
      events: [
        { kind: "user-message", text: "テストを実行して" },
        { kind: "tool-call", callId: "toolu_1", name: "Bash", input: "{\"command\":\"bun test\"}", result: "3 pass" },
        { kind: "response", text: "3件成功しました。" },
      ],
    });
  });

  it("[positive] ツールの結果がブロックの配列のときテキストのブロックだけをつなぎ、idの一致する呼び出しに加える", () => {
    const content = [
      { type: "user", origin: { kind: "human" }, message: { role: "user", content: "画面を確認して" } },
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            { type: "tool_use", id: "toolu_1", name: "Read", input: { file_path: "/a.png" } },
            { type: "tool_use", id: "toolu_2", name: "Bash", input: { command: "ls" } },
          ],
        },
      },
      {
        type: "user",
        message: {
          role: "user",
          content: [
            { type: "tool_result", tool_use_id: "toolu_2", content: [{ type: "text", text: "a.png" }, { type: "image", source: {} }, { type: "text", text: "b.png" }] },
            { type: "tool_result", tool_use_id: "toolu_1" },
            { type: "tool_result", tool_use_id: "toolu_other", content: "前の発言より前の呼び出しの結果" },
          ],
        },
      },
    ].map((entry) => JSON.stringify(entry)).join("\n");

    const conversation = parseClaudeTranscript(content);

    expect(conversation).toEqual({
      kind: "after-user-message",
      instructionFiles: [],
      userMessageLine: 0,
      history: [],
      previousToolCalls: [],
      events: [
        { kind: "user-message", text: "画面を確認して" },
        { kind: "tool-call", callId: "toolu_1", name: "Read", input: "{\"file_path\":\"/a.png\"}", result: "" },
        { kind: "tool-call", callId: "toolu_2", name: "Bash", input: "{\"command\":\"ls\"}", result: "a.png\nb.png" },
      ],
    });
  });

  it("[negative] 結果が記録されていない呼び出しは結果をundefinedにする", () => {
    const content = [
      { type: "user", origin: { kind: "human" }, message: { role: "user", content: "依頼" } },
      { type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", id: "toolu_1", name: "Bash", input: { command: "ls" } }] } },
    ].map((entry) => JSON.stringify(entry)).join("\n");

    const conversation = parseClaudeTranscript(content);

    expect(conversation).toEqual({
      kind: "after-user-message",
      instructionFiles: [],
      userMessageLine: 0,
      history: [],
      previousToolCalls: [],
      events: [
        { kind: "user-message", text: "依頼" },
        { kind: "tool-call", callId: "toolu_1", name: "Bash", input: "{\"command\":\"ls\"}", result: undefined },
      ],
    });
  });

  it("[positive] claude -pの入力(promptSource: sdk)をユーザーの発言とする", () => {
    const content = [
      { type: "user", promptSource: "sdk", message: { role: "user", content: "ファイルを作って" } },
      { type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "作りました。" }] } },
    ].map((entry) => JSON.stringify(entry)).join("\n");

    const conversation = parseClaudeTranscript(content);

    expect(conversation).toEqual({
      kind: "after-user-message",
      instructionFiles: [],
      userMessageLine: 0,
      history: [],
      previousToolCalls: [],
      events: [
        { kind: "user-message", text: "ファイルを作って" },
        { kind: "response", text: "作りました。" },
      ],
    });
  });

  it("[positive] 発言の本文がブロックの配列のときテキストのブロックだけをつなぐ", () => {
    const content = JSON.stringify({
      type: "user",
      origin: { kind: "human" },
      message: {
        role: "user",
        content: [{ type: "text", text: "この画像を見て" }, { type: "image", source: {} }, { type: "text", text: "説明して" }],
      },
    });

    const conversation = parseClaudeTranscript(content);

    expect(conversation).toEqual({ kind: "after-user-message", instructionFiles: [], userMessageLine: 0, history: [], previousToolCalls: [], events: [{ kind: "user-message", text: "この画像を見て\n説明して" }] });
  });

  it("[positive] このhookのStopの差し戻しを、hookのコマンドの表記を除いて取り出す", () => {
    const content = [
      { type: "user", origin: { kind: "human" }, message: { role: "user", content: "依頼" } },
      { type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "直しました。" }] } },
      {
        type: "user",
        isMeta: true,
        message: { role: "user", content: "Stop hook feedback:\n[/hooks/check-response.sh]: check-response: your last response breaks the rules." },
      },
    ].map((entry) => JSON.stringify(entry)).join("\n");

    const conversation = parseClaudeTranscript(content);

    expect(conversation).toEqual({
      kind: "after-user-message",
      instructionFiles: [],
      userMessageLine: 0,
      history: [],
      previousToolCalls: [],
      events: [
        { kind: "user-message", text: "依頼" },
        { kind: "response", text: "直しました。" },
        { kind: "hook-feedback", text: "check-response: your last response breaks the rules." },
      ],
    });
  });

  it("[negative] PostToolUseの差し戻し・他のhookの差し戻し・Stop hook feedback以外のmeta・空白だけの応答・タスクの通知は取り出さない", () => {
    const content = [
      { type: "user", origin: { kind: "human" }, message: { role: "user", content: "依頼" } },
      { type: "attachment", attachment: { type: "hook_blocking_error", blockingError: { blockingError: "[/hooks/check-response.sh]: check-response: blocked" } } },
      { type: "user", isMeta: true, message: { role: "user", content: "Stop hook feedback:\n[/hooks/other.sh]: other: blocked" } },
      { type: "user", isMeta: true, origin: { kind: "peer" }, message: { role: "user", content: "[Subagent hand-back] check-response: quoted" } },
      { type: "user", origin: { kind: "task-notification" }, promptSource: "system", message: { role: "user", content: "通知" } },
      { type: "assistant", message: { role: "assistant", content: [{ type: "text", text: " \n" }] } },
    ].map((entry) => JSON.stringify(entry)).join("\n");

    const conversation = parseClaudeTranscript(content);

    expect(conversation).toEqual({ kind: "after-user-message", instructionFiles: [], userMessageLine: 0, history: [], previousToolCalls: [], events: [{ kind: "user-message", text: "依頼" }] });
  });

  it("[positive] AskUserQuestionの結果を呼び出しの結果に加え、質問と回答を回答の出来事として取り出す", () => {
    const content = [
      { type: "user", origin: { kind: "human" }, message: { role: "user", content: "依頼" } },
      { type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", id: "toolu_1", name: "AskUserQuestion", input: {} }] } },
      {
        type: "user",
        message: { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "The user answered" }] },
        toolUseResult: { questions: [], answers: { "pushしますか。": "push済", "方式は。": "A" } },
      },
    ].map((entry) => JSON.stringify(entry)).join("\n");

    const conversation = parseClaudeTranscript(content);

    expect(conversation).toEqual({
      kind: "after-user-message",
      instructionFiles: [],
      userMessageLine: 0,
      history: [],
      previousToolCalls: [],
      events: [
        { kind: "user-message", text: "依頼" },
        { kind: "tool-call", callId: "toolu_1", name: "AskUserQuestion", input: "{}", result: "The user answered" },
        { kind: "user-answer", text: "pushしますか。: push済\n方式は。: A" },
      ],
    });
  });

  it("[positive] 作業中にユーザーが送った発言を、ターンを区切らない発言として取り出す", () => {
    const content = [
      { type: "user", origin: { kind: "human" }, message: { role: "user", content: "PRを作成して" } },
      { type: "attachment", attachment: { type: "queued_command", prompt: "OK", origin: { kind: "human" }, humanTurn: true } },
    ].map((entry) => JSON.stringify(entry)).join("\n");

    const conversation = parseClaudeTranscript(content);

    expect(conversation).toEqual({
      kind: "after-user-message",
      instructionFiles: [],
      userMessageLine: 0,
      history: [],
      previousToolCalls: [],
      events: [{ kind: "user-message", text: "PRを作成して" }, { kind: "additional-user-message", text: "OK" }],
    });
  });

  it("[negative] ユーザー以外が送った作業中のメッセージは取り出さない", () => {
    const content = [
      { type: "user", origin: { kind: "human" }, message: { role: "user", content: "依頼" } },
      { type: "attachment", attachment: { type: "queued_command", prompt: "<task-notification>", commandMode: "task-notification" } },
      { type: "attachment", attachment: { type: "queued_command", prompt: "<agent-message>", origin: { kind: "peer" } } },
    ].map((entry) => JSON.stringify(entry)).join("\n");

    const conversation = parseClaudeTranscript(content);

    expect(conversation).toEqual({ kind: "after-user-message", instructionFiles: [], userMessageLine: 0, history: [], previousToolCalls: [], events: [{ kind: "user-message", text: "依頼" }] });
  });

  it("[positive] 読み込まれた指示ファイルのパスと内容を取り出す", () => {
    const content = [
      { type: "user", origin: { kind: "human" }, message: { role: "user", content: "依頼" } },
      { type: "attachment", attachment: { type: "instructions", files: [{ path: "/repo/CLAUDE.md", type: "Project", content: "指示" }] } },
    ].map((entry) => JSON.stringify(entry)).join("\n");

    const conversation = parseClaudeTranscript(content);

    expect(conversation).toEqual({
      kind: "after-user-message",
      instructionFiles: [{ path: "/repo/CLAUDE.md", content: "指示" }],
      userMessageLine: 0,
      history: [],
      previousToolCalls: [],
      events: [{ kind: "user-message", text: "依頼" }],
    });
  });

  it("[negative] 書き込み途中の行・空行は読み飛ばす", () => {
    const content = [
      JSON.stringify({ type: "user", origin: { kind: "human" }, message: { role: "user", content: "依頼" } }),
      "",
      "{\"type\":\"assistant\"",
    ].join("\n");

    const conversation = parseClaudeTranscript(content);

    expect(conversation).toEqual({ kind: "after-user-message", instructionFiles: [], userMessageLine: 0, history: [], previousToolCalls: [], events: [{ kind: "user-message", text: "依頼" }] });
  });

  it("[negative] ユーザーの発言が無いとき行はundefinedになる", () => {
    const content = JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "応答" }] } });

    const conversation = parseClaudeTranscript(content);

    expect(conversation).toEqual({ kind: "no-user-message", instructionFiles: [], events: [{ kind: "response", text: "応答" }] });
  });
});
