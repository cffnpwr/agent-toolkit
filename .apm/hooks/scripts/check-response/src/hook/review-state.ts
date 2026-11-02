import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { type } from "arktype";
import { match } from "ts-pattern";

import type { Conversation } from "../conversation/conversation.ts";
import type { Finding } from "../llm-review/findings.ts";

import { responsesOf } from "../conversation/conversation.ts";
import { finding } from "../llm-review/findings.ts";

import { appDirOf } from "./xdg.ts";

const reviewRecord = type({
  // 最後に検査した応答。最後の発言の行と、その後の応答の数で表現
  "reviewed?": { userMessageLine: "number.integer >= 0", responseCount: "number.integer >= 0" },
  // 最後に差し戻したターン。blockを持たない以前の形式の記録も読み込むため、省略可能
  "block?": {
    // ユーザーの発言が無い会話はnull
    userMessageLine: "number.integer >= 0 | null",
    // そのターンで差し戻した回数
    count: "number.integer >= 1",
    // 最後の差し戻しで報告した査読の指摘
    findings: finding.array(),
  },
});

const parseRecord = type("string.json.parse").to(reviewRecord);

type ReviewRecord = typeof reviewRecord.infer;

type BlockRecord = NonNullable<ReviewRecord["block"]>;

// 検査しているターンで、このhookが差し戻した回数と、最後の差し戻しで報告した査読の指摘
export interface BlockState {
  count: number;
  findings: Finding[];
}

export const recordPathOf = (sessionId: string): string => join(appDirOf("XDG_CACHE_HOME", ".cache"), sessionId);

// 記録が無い場合は、検査済みの応答無し
export const loadRecord = async (path: string): Promise<ReviewRecord> => {
  const text = await readFile(path, "utf8").catch(() => undefined);
  if (text === undefined) {
    return {};
  }
  const record = parseRecord(text);

  return record instanceof type.errors ? {} : record;
};

export const saveRecord = async (
  path: string,
  record: ReviewRecord,
): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(record)}\n`);
};

const turnOf = (
  conversation: Conversation,
): number | null => match(conversation)
  .with({ kind: "after-user-message" }, ({ userMessageLine }) => userMessageLine)
  .with({ kind: "no-user-message" }, () => null)
  .exhaustive();

const reviewedCountOf = (
  conversation: Conversation,
  record: ReviewRecord,
): number => {
  const turn = turnOf(conversation);

  return turn !== null && record.reviewed?.userMessageLine === turn
    ? record.reviewed.responseCount
    : 0;
};

export const withoutReviewed = (
  conversation: Conversation,
  record: ReviewRecord,
): Conversation => {
  const reviewedCount = reviewedCountOf(conversation, record);
  let responseIndex = 0;
  const events = conversation.events.filter((event) => {
    if (event.kind !== "response") {
      return true;
    }
    responseIndex++;

    return responseIndex > reviewedCount;
  });

  return { ...conversation, events };
};

export const blockStateOf = (
  conversation: Conversation,
  record: ReviewRecord,
  stopHookActive: boolean,
): BlockState | undefined => {
  const turn = turnOf(conversation);
  const { block } = record;
  if (
    block?.userMessageLine !== turn
    // ユーザーの発言が無い会話はターンを行で見分けられないため、差し戻しを受けて応答を続けている場合のみ同じターン扱い
    || (turn === null && !stopHookActive)
  ) {
    return undefined;
  }

  return { count: block.count, findings: block.findings };
};

// 記録の作成元は、検査済みの応答を除く前の会話
export const nextRecord = (
  conversation: Conversation,
  blockState: BlockState | undefined,
): ReviewRecord => {
  const turn = turnOf(conversation);
  const block: BlockRecord | undefined = blockState === undefined
    ? undefined
    : { userMessageLine: turn, ...blockState };

  return {
    reviewed: turn === null
      ? undefined
      : {
        userMessageLine: turn,
        responseCount: responsesOf(conversation.events).length,
      },
    block,
  };
};
