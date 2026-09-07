import type { Json } from "./types.ts";

export const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null;

// PermissionRequest入力からシェルコマンド文字列を取り出す。
// shell系ツールのtool_inputは{ command: string }。
// 出典: Claude(hooks docs, PermissionRequest input)、Codex(codex-rs/core/src/tools/sandboxing.rs PermissionRequestPayload::bash)。
export const extractCommand = (input: Json): string | undefined => {
  const toolInput = input.tool_input;
  const command = isObject(toolInput) ? toolInput.command : undefined;
  return typeof command === "string" && command.length > 0 ? command : undefined;
};
