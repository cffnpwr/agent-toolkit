import type { TxtNode } from "@textlint/ast-node-types";

import { parse } from "@textlint/markdown-to-ast";
import { match, P } from "ts-pattern";

import type { Conversation, ConversationEvent, HistoryEntry, PreviousToolCall } from "../conversation/conversation.ts";

import { historyOf, previousToolCallsOf, reviewedResponseOf } from "../conversation/conversation.ts";

const MAX_RESULT_LENGTH = 2_000;

const KEPT_EDGE_LENGTH = MAX_RESULT_LENGTH / 2;

// 文章の査読に文脈として渡す前のターンの文字数の上限
const MAX_HISTORY_LENGTH = 12_000;

// 未確認事項の検査に渡す前のターンのツール呼び出しの入力の文字数の上限
const MAX_PREVIOUS_TOOL_CALLS_LENGTH = 12_000;

const CODE_BLOCK_PLACEHOLDER = "[コードブロック省略]";

export interface ReviewInputSource {
  // 応答はすべて未検査のもの
  conversation: Conversation;
  // 書き換えが必要と確定し、差し戻しで報告済みの指摘
  confirmedFindings: string[];
  // 文章の査読で違反かを判定する指摘
  findingsToJudge: string[];
}

// 末尾に出る集計・エラーも残すため、先頭と末尾以外を省略
const truncateToolText = (
  text: string,
): string => (text.length > MAX_RESULT_LENGTH
  ? [
    text.slice(0, KEPT_EDGE_LENGTH),
    `[${text.length - MAX_RESULT_LENGTH} characters omitted]`,
    text.slice(-KEPT_EDGE_LENGTH),
  ].join("\n")
  : text);

const childrenOf = (
  node: TxtNode,
): TxtNode[] => (node as { children?: TxtNode[]; }).children ?? [];

const codeBlockRangesOf = (
  node: TxtNode,
): (readonly [number, number])[] => (node.type === "CodeBlock"
  ? [node.range]
  : childrenOf(node).flatMap(codeBlockRangesOf));

// 文章の査読の対象はコード以外のため、コードブロックを省略の表記に置換
export const withoutCodeBlocks = (
  text: string,
): string => codeBlockRangesOf(parse(text))
  .toReversed()
  .reduce(
    (current, [start, end]) => `${current.slice(0, start)}${CODE_BLOCK_PLACEHOLDER}${current.slice(end)}`,
    text,
  );

const tag = (name: string, text: string): string => `<${name}>\n${text}\n</${name}>`;

const toolCallTag = (
  name: string,
  input: string,
  result: string | undefined,
): string => [
  `<tool-call name="${name}">`,
  tag("input", input),
  ...(result === undefined ? [] : [tag("result", truncateToolText(result))]),
  "</tool-call>",
].join("\n");

const toTag = (
  event: ConversationEvent,
  responseTagName: string,
): string => match(event)
  .with({ kind: "user-message" }, ({ text }) => tag("user-message", text))
  .with({ kind: "tool-call" }, ({ name, input, result }) => toolCallTag(name, input, result))
  .with({ kind: "hook-feedback" }, ({ text }) => tag("hook-feedback", text))
  .with({ kind: "response" }, ({ text }) => tag(responseTagName, text))
  .exhaustive();

const findingsTag = (
  name: string,
  findings: string[],
): string => match(findings.length)
  .with(0, () => `<${name}></${name}>`)
  .otherwise(() => tag(name, findings.join("\n")));

const reviewedResponseTags = (
  reviewedResponse: string | undefined,
): string[] => match(reviewedResponse)
  .with(P.string, (text) => [tag("reviewed-response", text)])
  .with(undefined, () => [])
  .exhaustive();

const historyTextOf = (entry: HistoryEntry): HistoryEntry => match(entry)
  .with({ kind: "user-message" }, (userMessage) => userMessage)
  .with({ kind: "response" }, ({ text }): HistoryEntry => ({ kind: "response", text: withoutCodeBlocks(text) }))
  .exhaustive();

// 新しいものから上限に収まる分だけを選択し、発生順に並べ替え
const newestWithin = <T>(
  items: T[],
  lengthOf: (item: T) => number,
  maxLength: number,
): T[] => {
  const selected: T[] = [];
  let length = 0;
  for (const item of items.toReversed()) {
    length += lengthOf(item);
    if (length > maxLength) {
      break;
    }
    selected.push(item);
  }

  return selected.toReversed();
};

const recentHistory = (history: HistoryEntry[]): HistoryEntry[] => newestWithin(
  history.map(historyTextOf),
  (entry) => entry.text.length,
  MAX_HISTORY_LENGTH,
);

const historyTags = (
  history: HistoryEntry[],
): string[] => match(recentHistory(history))
  .with([], () => [])
  .otherwise((entries) => [tag("earlier-turns", entries.map((entry) => toTag(entry, "response")).join("\n"))]);

const proseEventTags = (
  events: ConversationEvent[],
): string[] => events.flatMap((event) => match(event)
  // ツール呼び出しは文章の査読の対象でも文脈でもないため除外
  .with({ kind: "tool-call" }, () => [])
  .with({ kind: "response" }, ({ text }) => [tag("response-to-review", withoutCodeBlocks(text))])
  .otherwise((other) => [toTag(other, "response-to-review")]));

export const toProseReviewInput = ({
  conversation,
  confirmedFindings,
  findingsToJudge,
}: ReviewInputSource): string => [
  ...historyTags(historyOf(conversation)),
  "<conversation>",
  ...proseEventTags(conversation.events),
  "</conversation>",
  findingsTag("textlint-findings-already-reported", confirmedFindings),
  findingsTag("textlint-findings-to-judge", findingsToJudge),
].join("\n");

// 実行結果は含めず、操作をしたかどうかの裏付けにだけ使う
const previousToolCallTags = (
  toolCalls: PreviousToolCall[],
): string[] => match(newestWithin(
  toolCalls.map(({ name, input }) => ({
    name,
    input: truncateToolText(input),
  })),
  ({ input }) => input.length,
  MAX_PREVIOUS_TOOL_CALLS_LENGTH,
))
  .with([], () => [])
  .otherwise((calls) => [tag(
    "previous-turn-tool-calls",
    calls.map(({ name, input }) => toolCallTag(name, input, undefined)).join("\n"),
  )]);

// 検査の対象は最後の応答のみで、それより前の応答は文脈
export const toVerificationReviewInput = ({
  conversation,
  confirmedFindings,
}: ReviewInputSource): string => {
  const { events } = conversation;
  const finalResponseIndex = events.findLastIndex(
    (event) => event.kind === "response",
  );

  return [
    "<conversation>",
    ...previousToolCallTags(previousToolCallsOf(conversation)),
    ...reviewedResponseTags(reviewedResponseOf(conversation)),
    ...events.map((event, index) => toTag(
      event,
      index === finalResponseIndex ? "final-response" : "response",
    )),
    "</conversation>",
    findingsTag("textlint-findings-already-reported", confirmedFindings),
  ].join("\n");
};
