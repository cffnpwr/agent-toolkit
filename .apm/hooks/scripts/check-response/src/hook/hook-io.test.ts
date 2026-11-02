import { describe, expect, it } from "bun:test";

import { type } from "arktype";

import { hookInput } from "./hook-io.ts";

describe("hookInput", () => {
  it("[positive] CodexのStopの入力を受け付ける", () => {
    const input = {
      session_id: "01a16e57-dda3-7db1-b944-35032e54250c",
      turn_id: "01a16e57-e294-7bf3-a7d3-2e12f766f51c",
      transcript_path: null,
      cwd: "/work",
      hook_event_name: "Stop" as const,
      model: "gpt-6",
      permission_mode: "default",
      stop_hook_active: false,
      last_assistant_message: null,
    };

    const parsed = hookInput(JSON.stringify(input));

    expect(parsed).toEqual(input);
  });

  it("[positive] Claude CodeのStopの入力を受け付ける", () => {
    const input = {
      session_id: "abc123",
      transcript_path: "/home/u/.claude/projects/p/abc123.jsonl",
      cwd: "/work",
      permission_mode: "default",
      hook_event_name: "Stop" as const,
      stop_hook_active: true,
      last_assistant_message: "完了しました。",
      background_tasks: [],
      session_crons: [],
    };

    const parsed = hookInput(JSON.stringify(input));

    expect(parsed).toEqual(input);
  });

  it.each([
    { name: "session_idが親ディレクトリを指す", input: { hook_event_name: "Stop", session_id: "..", stop_hook_active: false } },
    { name: "session_idがパスの区切りを含む", input: { hook_event_name: "Stop", session_id: "a/b", stop_hook_active: false } },
    { name: "stop_hook_activeが無い", input: { hook_event_name: "Stop", session_id: "s1" } },
    { name: "PostToolUseのイベント", input: { hook_event_name: "PostToolUse", session_id: "s1", tool_name: "Write", tool_input: { file_path: "/a.md" } } },
    { name: "対象外のイベント", input: { hook_event_name: "PreToolUse", session_id: "s1", stop_hook_active: false } },
  ])("[negative] $nameとき検証エラーを返す", ({ input }) => {
    const parsed = hookInput(JSON.stringify(input));

    expect(parsed).toBeInstanceOf(type.errors);
  });
});
