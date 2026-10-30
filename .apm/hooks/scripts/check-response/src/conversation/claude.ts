import { type } from "arktype";
import { match, P } from "ts-pattern";

import type { Conversation, TranscriptItem } from "./conversation.ts";

import { OUTPUT_PREFIX } from "../hook/hook-io.ts";

import { conversationFromJsonl } from "./conversation.ts";

const STOP_FEEDBACK_LABEL = "Stop hook feedback:";

const textBlock = type({ type: "'text'", text: "string" });

const toolUseBlock = type({ type: "'tool_use'", id: "string", name: "string", input: "unknown" });

const toolResultBlock = type({ type: "'tool_result'", tool_use_id: "string", "content?": "string | unknown[]" });

const messageContent = type("string").or(type("unknown[]"));

const humanPrompt = type({
  type: "'user'",
  origin: { kind: "'human'" },
  message: { content: messageContent },
});

const sdkPrompt = type({
  type: "'user'",
  promptSource: "'sdk'",
  message: { content: messageContent },
});

const stopFeedback = type({
  type: "'user'",
  isMeta: "true",
  message: { content: type("string").narrow((text) => text.startsWith(STOP_FEEDBACK_LABEL)) },
});

const assistantMessage = type({
  type: "'assistant'",
  message: { content: "unknown[]" },
});

const toolResultMessage = type({
  type: "'user'",
  message: { content: "unknown[]" },
});

// 質問文をキー、回答を値とするAskUserQuestionの結果
const userAnswerMessage = type({
  type: "'user'",
  message: { content: "unknown[]" },
  toolUseResult: { answers: "Record<string, string>" },
});

const additionalUserMessage = type({
  type: "'attachment'",
  attachment: { type: "'queued_command'", prompt: "string", origin: { kind: "'human'" } },
});

const instructionsAttachment = type({
  type: "'attachment'",
  attachment: { type: "'instructions'", files: type({ path: "string", content: "string" }).array() },
});

const textOf = (value: string | unknown[]): string => match(value)
  .with(P.string, (text) => text)
  .otherwise((blocks) => blocks.flatMap((block) => (textBlock.allows(block) ? [block.text] : [])).join("\n"));

// 他のhookの出力も含まれうるため、このhookのメッセージのみを抽出
const ownFeedback = (
  text: string,
): TranscriptItem[] => match(text.indexOf(OUTPUT_PREFIX))
  .with(-1, () => [])
  .otherwise((start) => [{ kind: "hook-feedback", text: text.slice(start) }]);

const assistantItems = (
  blocks: unknown[],
): TranscriptItem[] => blocks
  .flatMap((block) => match<unknown, TranscriptItem[]>(block)
    .when(textBlock.allows, ({ text }) => (text.trim() === "" ? [] : [{ kind: "response", text }]))
    .when(toolUseBlock.allows, ({ id, name, input }) => [{ kind: "tool-call", callId: id, name, input: JSON.stringify(input), result: undefined }])
    .otherwise(() => []));

const toolResultItems = (
  blocks: unknown[],
): TranscriptItem[] => blocks
  .flatMap((block) => match<unknown, TranscriptItem[]>(block)
    .when(toolResultBlock.allows, ({ tool_use_id, content }) => [{ kind: "tool-result", callId: tool_use_id, text: textOf(content ?? "") }])
    .otherwise(() => []));

const userAnswerText = (
  answers: Record<string, string>,
): string => Object.entries(answers)
  .map(([question, answer]) => `${question}: ${answer}`)
  .join("\n");

const itemsOf = (
  entry: unknown,
): TranscriptItem[] => match<unknown, TranscriptItem[]>(entry)
  .when(humanPrompt.allows, ({ message }) => [{ kind: "user-message", text: textOf(message.content) }])
  .when(sdkPrompt.allows, ({ message }) => [{ kind: "user-message", text: textOf(message.content) }])
  .when(stopFeedback.allows, ({ message }) => ownFeedback(message.content))
  .when(
    assistantMessage.allows,
    ({ message }) => assistantItems(message.content),
  )
  .when(userAnswerMessage.allows, ({ message, toolUseResult }) => [
    ...toolResultItems(message.content),
    { kind: "user-answer", text: userAnswerText(toolUseResult.answers) },
  ])
  .when(additionalUserMessage.allows, ({ attachment }) => [{ kind: "additional-user-message", text: attachment.prompt }])
  .when(instructionsAttachment.allows, ({ attachment }) => [{
    kind: "instruction-files",
    files: attachment.files.map(({ path, content }) => ({ path, content })),
  }])
  .when(
    toolResultMessage.allows,
    ({ message }) => toolResultItems(message.content),
  )
  .otherwise(() => []);

export const parseClaudeTranscript = (
  content: string,
): Conversation => conversationFromJsonl(content, itemsOf);
