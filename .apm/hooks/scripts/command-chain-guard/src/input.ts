import type { Json } from "./types.ts";

export const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null;

// PreToolUse入力からシェルコマンド文字列を取り出す。
// shell系ツールのtool_inputは{ command: string }。
// 出典: Claude(hooks docs, Bashツール)、Codex(codex-rs/hooks/src/events/pre_tool_use.rs)、Gemini(packages/core/src/tools/shell.ts ShellToolParams.command)。
export const extractCommand = (input: Json): string | undefined => {
  const toolInput = input.tool_input;
  const command = isObject(toolInput) ? toolInput.command : undefined;
  return typeof command === "string" && command.length > 0 ? command : undefined;
};
