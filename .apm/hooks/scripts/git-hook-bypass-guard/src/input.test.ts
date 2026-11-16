import { describe, expect, it } from "bun:test";

import type { HookInput } from "./input.ts";

import { HookInputParseError, parseHookInput } from "./input.ts";

describe("parseHookInput", () => {
  it.each<{ label: string; text: string; want: HookInput; }>([
    {
      label: "commandとsession_idがある",
      text: JSON.stringify({ session_id: "s1", tool_input: { command: "git status" } }),
      want: { command: "git status", sessionId: "s1" },
    },
    {
      label: "session_idが文字列でない",
      text: JSON.stringify({ session_id: 1, tool_input: { command: "git status" } }),
      want: { command: "git status", sessionId: undefined },
    },
    {
      label: "tool_inputが無い",
      text: JSON.stringify({ session_id: "s1" }),
      want: { command: undefined, sessionId: "s1" },
    },
    {
      label: "commandが空文字列",
      text: JSON.stringify({ tool_input: { command: "" } }),
      want: { command: undefined, sessionId: undefined },
    },
    {
      label: "JSONがオブジェクトでない",
      text: "42",
      want: { command: undefined, sessionId: undefined },
    },
  ])("[positive] $labelとき取り出せる値を返す", ({ text, want }) => {
    const result = parseHookInput(text);

    expect(result.unwrap()).toEqual(want);
  });

  it("[negative] JSONとして解析できないときHookInputParseErrorを返す", () => {
    const result = parseHookInput("not json");

    expect(result.unwrapErr()).toBeInstanceOf(HookInputParseError);
  });
});
