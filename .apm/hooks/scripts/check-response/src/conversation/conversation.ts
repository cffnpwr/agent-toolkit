import { type } from "arktype";
import { match, P } from "ts-pattern";

const JAPANESE_CHARACTER = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;

const jsonLine = type("string.json.parse");

export const EMPTY_CONVERSATION: Conversation = { kind: "no-user-message", events: [] };

export type ConversationEvent = { kind: "user-message"; text: string; }
  | {
    kind: "tool-call";
    callId: string | undefined;
    name: string;
    input: string;
    // 結果が記録されていない場合はundefined
    result: string | undefined;
  }
  | { kind: "hook-feedback"; text: string; }
  | { kind: "response"; text: string; };

// transcriptの1行から取り出す要素。ツールの結果は対応する呼び出しに追加
export type TranscriptItem = ConversationEvent
  | { kind: "tool-result"; callId: string; text: string; };

export type HistoryEntry = Extract<ConversationEvent, { kind: "user-message" | "response"; }>;

export type PreviousToolCall = Pick<Extract<ConversationEvent, { kind: "tool-call"; }>, "name" | "input">;

// ユーザーの最後の発言以降の応答・ツール呼び出し・hookのフィードバックの一覧
export type Conversation = {
  kind: "after-user-message";
  // 最後の発言があるtranscriptの行(0始まり)
  userMessageLine: number;
  // 最後の発言より前の発言と応答を発生順に並べたもの
  history: HistoryEntry[];
  // 最後の発言の直前のターンのツール呼び出しを発生順に並べたもの
  previousToolCalls: PreviousToolCall[];
  // 発生順に並べた出来事。先頭はユーザーの最後の発言
  events: ConversationEvent[];
} | {
  kind: "no-user-message";
  events: ConversationEvent[];
};

const historyEntriesOf = (
  events: ConversationEvent[],
): HistoryEntry[] => events.filter(
  (event): event is HistoryEntry => event.kind === "user-message" || event.kind === "response",
);

export const historyOf = (
  conversation: Conversation,
): HistoryEntry[] => match(conversation)
  .with({ kind: "after-user-message" }, ({ history }) => history)
  .with({ kind: "no-user-message" }, () => [])
  .exhaustive();

export const previousToolCallsOf = (
  conversation: Conversation,
): PreviousToolCall[] => match(conversation)
  .with({ kind: "after-user-message" }, ({ previousToolCalls }) => previousToolCalls)
  .with({ kind: "no-user-message" }, () => [])
  .exhaustive();

const toolCallsOf = (
  events: ConversationEvent[],
): PreviousToolCall[] => events.flatMap((event) => (event.kind === "tool-call"
  ? [{ name: event.name, input: event.input }]
  : []));

// 査読済みの前のターンの最終応答
export const reviewedResponseOf = (
  conversation: Conversation,
): string | undefined => historyOf(conversation)
  // 応答が無いターンは対象外
  .findLast((entry) => entry.kind === "response")
  ?.text;

const withToolResult = (
  conversation: Conversation,
  callId: string,
  text: string,
): Conversation => ({
  ...conversation,
  events: conversation.events.map((event) => (event.kind === "tool-call" && event.callId === callId
    ? { ...event, result: text }
    : event)),
});

const appendItem = (
  conversation: Conversation,
  item: TranscriptItem,
  line: number,
): Conversation => match(item)
  .with({ kind: "user-message" }, (event): Conversation => ({
    kind: "after-user-message",
    userMessageLine: line,
    history: [
      ...historyOf(conversation),
      ...historyEntriesOf(conversation.events),
    ],
    previousToolCalls: toolCallsOf(conversation.events),
    events: [event],
  }))
  .with({ kind: "tool-result" }, ({ callId, text }) => withToolResult(conversation, callId, text))
  .with({ kind: P.union("tool-call", "hook-feedback", "response") }, (event): Conversation => ({
    ...conversation,
    events: [...conversation.events, event],
  }))
  .exhaustive();

export const conversationFromJsonl = (
  content: string,
  itemsOf: (entry: unknown) => TranscriptItem[],
): Conversation => content
  .split("\n")
  .reduce<Conversation>((conversation, line, index) => {
    const entry = jsonLine(line);
    // 書き込み途中の行・空行
    if (entry instanceof type.errors) {
      return conversation;
    }

    return itemsOf(entry).reduce<Conversation>(
      (current, item) => appendItem(current, item, index),
      conversation,
    );
  }, EMPTY_CONVERSATION);

export const withLastAssistantMessage = (
  conversation: Conversation,
  message: string | null | undefined,
): Conversation => {
  if (message === null || message === undefined || message.trim() === "") {
    return conversation;
  }
  const lastResponse = conversation.events.findLast((event) => event.kind === "response");
  if (lastResponse?.text.trim() === message.trim()) {
    return conversation;
  }

  return { ...conversation, events: [...conversation.events, { kind: "response", text: message }] };
};

export const responsesOf = (events: ConversationEvent[]): string[] => events
  .flatMap((event) => (event.kind === "response" ? [event.text] : []));

export const containsJapanese = (
  text: string,
): boolean => JAPANESE_CHARACTER.test(text);
