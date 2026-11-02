import { type } from "arktype";
import { match, P } from "ts-pattern";

import type { Conversation, TranscriptItem } from "./conversation.ts";

import { OUTPUT_PREFIX } from "../hook/hook-io.ts";

import { conversationFromJsonl } from "./conversation.ts";

const LOCAL_SHELL_TOOL_NAME = "local_shell";

const textPart = type({ type: "string", "text?": "string" });

const userMessageItem = type({
  type: "'event_msg'",
  payload: { type: "'item_completed'", item: { type: "'UserMessage'", content: textPart.array() } },
});

const hookPromptItem = type({
  type: "'event_msg'",
  payload: { type: "'item_completed'", item: { type: "'HookPrompt'", fragments: type({ text: "string" }).array() } },
});

const assistantMessage = type({
  type: "'response_item'",
  payload: { type: "'message'", role: "'assistant'", content: textPart.array() },
});

const functionCall = type({
  type: "'response_item'",
  payload: { type: "'function_call'", call_id: "string", name: "string", arguments: "string" },
});

const customToolCall = type({
  type: "'response_item'",
  payload: { type: "'custom_tool_call'", call_id: "string", name: "string", input: "string" },
});

const localShellCall = type({
  type: "'response_item'",
  payload: { type: "'local_shell_call'", call_id: "string | null", action: "unknown" },
});

const toolCallOutput = type({
  type: "'response_item'",
  payload: {
    type: "'function_call_output' | 'custom_tool_call_output'",
    call_id: "string",
    output: type("string").or(textPart.array()),
  },
});

const joinText = (
  parts: (typeof textPart.infer)[],
  partType: string,
): string => parts
  .filter((part) => part.type === partType)
  .map((part) => part.text ?? "")
  .join("\n");

const responseItems = (text: string): TranscriptItem[] => (text.trim() === "" ? [] : [{ kind: "response", text }]);

const outputText = (
  output: typeof toolCallOutput.infer.payload.output,
): string => match(output)
  .with(P.string, (text) => text)
  .otherwise((parts) => joinText(parts, "input_text"));

const itemsOf = (
  entry: unknown,
): TranscriptItem[] => match<unknown, TranscriptItem[]>(entry)
  .when(userMessageItem.allows, ({ payload }) => [{ kind: "user-message", text: joinText(payload.item.content, "text") }])
  .when(hookPromptItem.allows, ({ payload }) => payload.item.fragments
    .filter((fragment) => fragment.text.startsWith(OUTPUT_PREFIX))
    .map((fragment) => ({ kind: "hook-feedback", text: fragment.text })))
  .when(assistantMessage.allows, ({ payload }) => responseItems(joinText(payload.content, "output_text")))
  .when(functionCall.allows, ({ payload }) => [{ kind: "tool-call", callId: payload.call_id, name: payload.name, input: payload.arguments, result: undefined }])
  .when(customToolCall.allows, ({ payload }) => [{ kind: "tool-call", callId: payload.call_id, name: payload.name, input: payload.input, result: undefined }])
  .when(localShellCall.allows, ({ payload }) => [{
    kind: "tool-call",
    callId: payload.call_id ?? undefined,
    name: LOCAL_SHELL_TOOL_NAME,
    input: JSON.stringify(payload.action),
    result: undefined,
  }])
  .when(toolCallOutput.allows, ({ payload }) => [{ kind: "tool-result", callId: payload.call_id, text: outputText(payload.output) }])
  .otherwise(() => []);

export const parseCodexRollout = (
  content: string,
): Conversation => conversationFromJsonl(content, itemsOf);
