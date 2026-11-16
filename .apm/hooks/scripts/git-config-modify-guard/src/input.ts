import type { Result } from "@cffnpwr/result-ts";

import { Err, Ok } from "@cffnpwr/result-ts";
import { z } from "zod";

const HookInputSchema = z.object({
  session_id: z.string().optional().catch(undefined),
  tool_input: z.object({ command: z.string().min(1) })
    .optional()
    .catch(undefined),
});

export interface HookInput {
  command: string | undefined;
  sessionId: string | undefined;
}

export class HookInputParseError extends Error {
  override readonly name = "HookInputParseError" as const;

  constructor(options?: ErrorOptions) {
    super("Failed to parse the hook input as JSON.", options);
  }
}

const parseJson = (text: string): Result<unknown, HookInputParseError> => {
  try {
    return Ok(JSON.parse(text));
  } catch (error) {
    return Err(new HookInputParseError({ cause: error }));
  }
};

// オブジェクト以外のJSONはコマンドとsession_idが無い入力とみなす
export const parseHookInput = (
  text: string,
): Result<HookInput, HookInputParseError> => parseJson(text).map((json) => {
  const result = HookInputSchema.safeParse(json);
  if (!result.success) {
    return { command: undefined, sessionId: undefined };
  }

  return {
    command: result.data.tool_input?.command,
    sessionId: result.data.session_id,
  };
});
