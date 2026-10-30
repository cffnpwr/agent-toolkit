import { match } from "ts-pattern";

import type { Harness } from "../hook/harness.ts";

import type { Conversation } from "./conversation.ts";

import { parseClaudeTranscript } from "./claude.ts";
import { parseCodexRollout } from "./codex.ts";

export const parseTranscript = (
  harness: Harness,
  transcript: string,
): Conversation => match(harness)
  .with("claude", () => parseClaudeTranscript(transcript))
  .with("codex", () => parseCodexRollout(transcript))
  .exhaustive();
