import { describe, expect, it } from "bun:test";

import { Err, Ok } from "@cffnpwr/result-ts";

import type { BlockState } from "./hook/review-state.ts";

import { ReviewerCommandError } from "./llm-review/reviewer.ts";
import { canBlock, judgeReviews } from "./recheck.ts";

const calque = { rule: "calque", quote: "安全側に倒す", reason: "直訳", suggestion: "安全を優先する" };

const frank = { rule: "frank", quote: "めっちゃ", reason: "くだけた表現", suggestion: "とても" };

const hedge = { rule: "hedge", quote: "可能性があります", reason: "未確認", suggestion: "確認する" };

describe("judgeReviews", () => {
  it("[positive] このターンで差し戻していないとき、指摘のある査読をすべて差し戻しの対象にし、失敗した査読と指摘の無い査読を除く", () => {
    const sections = [
      { title: "Prose review", result: Ok([calque]) },
      { title: "Verification review", result: Ok([]) },
      { title: "Other review", result: Err(new ReviewerCommandError("claude -p", "exit code 1")) },
    ];

    const verdict = judgeReviews(sections, undefined, ["安全側に倒すことにしました。"]);

    expect(verdict).toEqual({ blocking: [{ title: "Prose review", findings: [calque] }], nonBlocking: [] });
  });

  it("[positive] 差し戻し後の検査のとき、前の指摘の引用が残っていればそれだけを差し戻しの対象にし、新しい指摘は差し戻さない", () => {
    const sections = [
      { title: "Prose review", result: Ok([calque, frank]) },
      { title: "Verification review", result: Ok([hedge]) },
    ];

    const verdict = judgeReviews(sections, { count: 1, findings: [calque, hedge, { ...frank, quote: " " }] }, ["途中の応答", "安全側に倒すことにしました。めっちゃ速いです。"]);

    expect(verdict).toEqual({
      blocking: [{ title: "Findings from the previous block that are still in the response", findings: [calque] }],
      nonBlocking: [{ title: "Prose review", findings: [frank] }, { title: "Verification review", findings: [hedge] }],
    });
  });

  it("[negative] 差し戻し後の検査で前の指摘の引用が残っていないとき、差し戻しの対象を空にする", () => {
    const sections = [{ title: "Prose review", result: Ok([frank]) }];

    const verdict = judgeReviews(sections, { count: 2, findings: [calque] }, ["安全を優先しました。めっちゃ速いです。"]);

    expect(verdict).toEqual({ blocking: [], nonBlocking: [{ title: "Prose review", findings: [frank] }] });
  });
});

describe("canBlock", () => {
  it.each<{
    name: string;
    blockState: BlockState | undefined;
    want: boolean;
  }>([
    { name: "差し戻していない", blockState: undefined, want: true },
    { name: "2回差し戻した", blockState: { count: 2, findings: [] }, want: true },
    { name: "3回差し戻した", blockState: { count: 3, findings: [] }, want: false },
  ])("[positive] このターンで$nameとき$wantを返す", ({ blockState, want }) => {
    expect(canBlock(blockState)).toBe(want);
  });
});
