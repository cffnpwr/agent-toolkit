import { type } from "arktype";

// transcriptからこのhookの差し戻しを見分けるための、全出力の先頭の文字列
export const OUTPUT_PREFIX = "check-response: ";

export const EXIT_CODE = { pass: 0, warning: 1, block: 2 } as const;

// 記録のファイル名に使うため、`/`・`..`は拒否
const sessionId = type(/^[\w-][\w.-]*$/);

const stopInput = type({
  hook_event_name: "'Stop'",
  session_id: sessionId,
  "transcript_path?": "string | null",
  stop_hook_active: "boolean",
  "last_assistant_message?": "string | null",
});

export const hookInput = type("string.json.parse").to(stopInput);

export const PASS_OUTPUT: HookOutput = { exitCode: EXIT_CODE.pass };

export type StopInput = typeof stopInput.infer;

export type HookOutput = { exitCode: typeof EXIT_CODE.pass; }
  | {
    exitCode: typeof EXIT_CODE.warning | typeof EXIT_CODE.block;
    message: string;
  };
