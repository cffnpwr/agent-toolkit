import { describe, expect, it } from "bun:test";

import { parseCodexRollout } from "./codex.ts";

describe("parseCodexRollout", () => {
  it("[positive] 最後のユーザーの発言以降の発言・ツール呼び出しと結果・応答を発生順に取り出し、前のターンの発言と応答を履歴にする", () => {
    const content = [
      { type: "session_meta", payload: { id: "s1" } },
      { type: "event_msg", payload: { type: "item_completed", item: { type: "UserMessage", content: [{ type: "text", text: "前の依頼" }] } } },
      { type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "前の応答" }] } },
      { type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "<environment_context>...</environment_context>" }] } },
      { type: "event_msg", payload: { type: "item_completed", item: { type: "UserMessage", content: [{ type: "text", text: "テストを実行して" }] } } },
      { type: "response_item", payload: { type: "function_call", name: "shell", arguments: "{\"command\":[\"bun\",\"test\"]}", call_id: "c1" } },
      { type: "response_item", payload: { type: "function_call_output", call_id: "c1", output: "3 pass" } },
      { type: "response_item", payload: { type: "custom_tool_call", name: "exec", input: "await tools.exec_command({cmd:\"ls\"})", call_id: "c2" } },
      {
        type: "response_item",
        payload: { type: "custom_tool_call_output", call_id: "c2", output: [{ type: "input_text", text: "Script completed" }, { type: "input_image", image_url: "data:" }, { type: "input_text", text: "a.txt" }] },
      },
      { type: "response_item", payload: { type: "local_shell_call", call_id: "c3", status: "completed", action: { type: "exec", command: ["ls"] } } },
      { type: "response_item", payload: { type: "function_call_output", call_id: "c3", output: "a.txt" } },
      { type: "response_item", payload: { type: "local_shell_call", call_id: null, status: "completed", action: { type: "exec", command: ["pwd"] } } },
      { type: "response_item", payload: { type: "reasoning", summary: [] } },
      { type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "3件成功しました。" }] } },
    ].map((entry) => JSON.stringify(entry)).join("\n");

    const conversation = parseCodexRollout(content);

    expect(conversation).toEqual({
      kind: "after-user-message",
      instructionFiles: [],
      userMessageLine: 4,
      history: [{ kind: "user-message", text: "前の依頼" }, { kind: "response", text: "前の応答" }],
      previousToolCalls: [],
      events: [
        { kind: "user-message", text: "テストを実行して" },
        { kind: "tool-call", callId: "c1", name: "shell", input: "{\"command\":[\"bun\",\"test\"]}", result: "3 pass" },
        { kind: "tool-call", callId: "c2", name: "exec", input: "await tools.exec_command({cmd:\"ls\"})", result: "Script completed\na.txt" },
        { kind: "tool-call", callId: "c3", name: "local_shell", input: "{\"type\":\"exec\",\"command\":[\"ls\"]}", result: "a.txt" },
        { kind: "tool-call", callId: undefined, name: "local_shell", input: "{\"type\":\"exec\",\"command\":[\"pwd\"]}", result: undefined },
        { kind: "response", text: "3件成功しました。" },
      ],
    });
  });

  it("[positive] このhookのStopの差し戻し(HookPrompt)だけを取り出す", () => {
    const content = [
      { type: "event_msg", payload: { type: "item_completed", item: { type: "UserMessage", content: [{ type: "text", text: "依頼" }] } } },
      {
        type: "event_msg",
        payload: {
          type: "item_completed",
          item: { type: "HookPrompt", fragments: [{ text: "check-response: your last response breaks the rules.", hookRunId: "stop:1" }, { text: "other hook: continue", hookRunId: "stop:2" }] },
        },
      },
      {
        type: "response_item",
        payload: { type: "message", role: "user", content: [{ type: "input_text", text: "<hook_prompt hook_run_id=\"stop:1\">check-response: your last response breaks the rules.</hook_prompt>" }] },
      },
    ].map((entry) => JSON.stringify(entry)).join("\n");

    const conversation = parseCodexRollout(content);

    expect(conversation).toEqual({
      kind: "after-user-message",
      instructionFiles: [],
      userMessageLine: 0,
      history: [],
      previousToolCalls: [],
      events: [
        { kind: "user-message", text: "依頼" },
        { kind: "hook-feedback", text: "check-response: your last response breaks the rules." },
      ],
    });
  });

  it("[negative] 本文が空白だけの応答・書き込み途中の行は取り出さない", () => {
    const content = [
      JSON.stringify({ type: "event_msg", payload: { type: "item_completed", item: { type: "UserMessage", content: [{ type: "text", text: "依頼" }] } } }),
      JSON.stringify({ type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: " " }] } }),
      "{\"type\":",
    ].join("\n");

    const conversation = parseCodexRollout(content);

    expect(conversation).toEqual({ kind: "after-user-message", instructionFiles: [], userMessageLine: 0, history: [], previousToolCalls: [], events: [{ kind: "user-message", text: "依頼" }] });
  });
});
