import { describe, expect, it } from "bun:test";

import type { Conversation, ConversationEvent, TranscriptItem } from "./conversation.ts";

import {
  containsJapanese,
  conversationFromJsonl,
  responsesOf,
  reviewedResponseOf,
  withLastAssistantMessage,
} from "./conversation.ts";

describe("conversationFromJsonl", () => {
  const itemsOf = (
    entry: unknown,
  ): TranscriptItem[] => [entry as TranscriptItem];

  it("[positive] 最後の発言より前の発言と応答を発生順に履歴にし、前のターンのツール呼び出しの名前・入力・結果を残す", () => {
    const content = [
      { kind: "response", text: "発言より前の応答" },
      { kind: "user-message", text: "前の依頼" },
      { kind: "response", text: "前の途中の応答" },
      { kind: "tool-call", callId: "c1", name: "Bash", input: "{}", result: "ok" },
      { kind: "hook-feedback", text: "差し戻し" },
      { kind: "response", text: "前の応答" },
      { kind: "user-message", text: "依頼" },
      { kind: "response", text: "応答" },
    ].map((item) => JSON.stringify(item)).join("\n");

    const conversation = conversationFromJsonl(content, itemsOf);

    expect(conversation).toEqual({
      kind: "after-user-message",
      userMessageLine: 6,
      history: [
        { kind: "response", text: "発言より前の応答" },
        { kind: "user-message", text: "前の依頼" },
        { kind: "response", text: "前の途中の応答" },
        { kind: "response", text: "前の応答" },
      ],
      previousToolCalls: [{ name: "Bash", input: "{}", result: "ok" }],
      events: [{ kind: "user-message", text: "依頼" }, { kind: "response", text: "応答" }],
    });
  });

  it("[positive] ツール呼び出しが2つ前のターンにあるとき、前のターンのツール呼び出しに累積して残す", () => {
    const content = [
      { kind: "user-message", text: "1つ目の依頼" },
      { kind: "tool-call", callId: "c1", name: "Bash", input: "{}", result: "ok" },
      { kind: "response", text: "1つ目の応答" },
      { kind: "user-message", text: "2つ目の依頼" },
      { kind: "response", text: "2つ目の応答" },
      { kind: "user-message", text: "3つ目の依頼" },
    ].map((item) => JSON.stringify(item)).join("\n");

    const conversation = conversationFromJsonl(content, itemsOf);

    expect(conversation).toEqual({
      kind: "after-user-message",
      userMessageLine: 5,
      history: [
        { kind: "user-message", text: "1つ目の依頼" },
        { kind: "response", text: "1つ目の応答" },
        { kind: "user-message", text: "2つ目の依頼" },
        { kind: "response", text: "2つ目の応答" },
      ],
      previousToolCalls: [{ name: "Bash", input: "{}", result: "ok" }],
      events: [{ kind: "user-message", text: "3つ目の依頼" }],
    });
  });

  it("[positive] 前のターンに応答が無いとき、発言だけを履歴に加える", () => {
    const content = [
      { kind: "user-message", text: "1つ目の依頼" },
      { kind: "response", text: "1つ目の応答" },
      { kind: "user-message", text: "2つ目の依頼" },
      { kind: "user-message", text: "3つ目の依頼" },
    ].map((item) => JSON.stringify(item)).join("\n");

    const conversation = conversationFromJsonl(content, itemsOf);

    expect(conversation).toEqual({
      kind: "after-user-message",
      userMessageLine: 3,
      history: [
        { kind: "user-message", text: "1つ目の依頼" },
        { kind: "response", text: "1つ目の応答" },
        { kind: "user-message", text: "2つ目の依頼" },
      ],
      previousToolCalls: [],
      events: [{ kind: "user-message", text: "3つ目の依頼" }],
    });
  });

  it("[negative] 前のターンが無いとき、履歴を空にする", () => {
    const content = [
      { kind: "user-message", text: "依頼" },
      { kind: "response", text: "応答" },
    ].map((item) => JSON.stringify(item)).join("\n");

    const conversation = conversationFromJsonl(content, itemsOf);

    expect(conversation).toEqual({
      kind: "after-user-message",
      userMessageLine: 0,
      history: [],
      previousToolCalls: [],
      events: [{ kind: "user-message", text: "依頼" }, { kind: "response", text: "応答" }],
    });
  });
});

describe("reviewedResponseOf", () => {
  it.each<{
    name: string;
    conversation: Conversation;
    want: string | undefined;
  }>([
    {
      name: "履歴の後のターンに応答が無い",
      conversation: {
        kind: "after-user-message",
        userMessageLine: 4,
        history: [{ kind: "response", text: "前の途中の応答" }, { kind: "response", text: "前の応答" }, { kind: "user-message", text: "応答の無い依頼" }],
        previousToolCalls: [],
        events: [{ kind: "user-message", text: "依頼" }],
      },
      want: "前の応答",
    },
    {
      name: "履歴に応答が無い",
      conversation: { kind: "after-user-message", userMessageLine: 0, history: [], previousToolCalls: [], events: [{ kind: "user-message", text: "依頼" }] },
      want: undefined,
    },
    {
      name: "ユーザーの発言が無い",
      conversation: { kind: "no-user-message", events: [{ kind: "response", text: "応答" }] },
      want: undefined,
    },
  ])("[positive] $nameとき、履歴の最後の応答($want)を返す", ({ conversation, want }) => {
    expect(reviewedResponseOf(conversation)).toBe(want);
  });
});

describe("withLastAssistantMessage", () => {
  it("[positive] 最後の応答と異なるとき末尾に応答として加える", () => {
    const conversation: Conversation = {
      kind: "after-user-message",
      userMessageLine: 0,
      history: [{ kind: "response", text: "前の応答" }],
      previousToolCalls: [],
      events: [{ kind: "user-message", text: "依頼" }, { kind: "response", text: "途中の応答" }, { kind: "tool-call", callId: "c1", name: "Bash", input: "{}", result: "ok" }],
    };

    const result = withLastAssistantMessage(conversation, "最後の応答");

    expect(result).toEqual({
      kind: "after-user-message",
      userMessageLine: 0,
      history: [{ kind: "response", text: "前の応答" }],
      previousToolCalls: [],
      events: [
        { kind: "user-message", text: "依頼" },
        { kind: "response", text: "途中の応答" },
        { kind: "tool-call", callId: "c1", name: "Bash", input: "{}", result: "ok" },
        { kind: "response", text: "最後の応答" },
      ],
    });
  });

  it("[positive] 応答がまだ無いとき末尾に応答として加える", () => {
    const conversation: Conversation = { kind: "after-user-message", userMessageLine: 0, history: [], previousToolCalls: [], events: [{ kind: "user-message", text: "依頼" }] };

    const result = withLastAssistantMessage(conversation, "最後の応答");

    expect(result).toEqual({
      kind: "after-user-message",
      userMessageLine: 0,
      history: [],
      previousToolCalls: [],
      events: [{ kind: "user-message", text: "依頼" }, { kind: "response", text: "最後の応答" }],
    });
  });

  it("[negative] 最後の応答と前後の空白を除いて一致するとき加えない", () => {
    const conversation: Conversation = {
      kind: "after-user-message",
      userMessageLine: 0,
      history: [],
      previousToolCalls: [],
      events: [{ kind: "user-message", text: "依頼" }, { kind: "response", text: "途中の応答" }],
    };

    const result = withLastAssistantMessage(conversation, " 途中の応答\n");

    expect(result).toEqual({
      kind: "after-user-message",
      userMessageLine: 0,
      history: [],
      previousToolCalls: [],
      events: [{ kind: "user-message", text: "依頼" }, { kind: "response", text: "途中の応答" }],
    });
  });

  it.each([
    { name: "null", message: null },
    { name: "undefined", message: undefined },
    { name: "空白だけ", message: " \n" },
  ])("[negative] 最後の応答が$nameのとき加えない", ({ message }) => {
    const conversation: Conversation = { kind: "after-user-message", userMessageLine: 0, history: [], previousToolCalls: [], events: [{ kind: "user-message", text: "依頼" }] };

    const result = withLastAssistantMessage(conversation, message);

    expect(result).toEqual({ kind: "after-user-message", userMessageLine: 0, history: [], previousToolCalls: [], events: [{ kind: "user-message", text: "依頼" }] });
  });
});

describe("responsesOf", () => {
  it("[positive] 応答だけを発生順に返す", () => {
    const events: ConversationEvent[] = [
      { kind: "user-message", text: "依頼" },
      { kind: "response", text: "1つ目" },
      { kind: "hook-feedback", text: "差し戻し" },
      { kind: "response", text: "2つ目" },
    ];

    const responses = responsesOf(events);

    expect(responses).toEqual(["1つ目", "2つ目"]);
  });
});

describe("containsJapanese", () => {
  it.each([
    { text: "ひらがな", want: true },
    { text: "カタカナ", want: true },
    { text: "漢字", want: true },
    { text: "ASCII only, ０１２", want: false },
  ])("[positive] 「$text」のとき$wantを返す", ({ text, want }) => {
    expect(containsJapanese(text)).toBe(want);
  });
});
