import { describe, expect, test } from "bun:test";

import { encode } from "gpt-tokenizer/model/gpt-4o";

import { skillOf } from "../test-fixtures.ts";

import { bodyTokenCountRule } from "./body-token-count.ts";

const RECOMMENDED_MAX_TOKENS = 5000;

describe("bodyTokenCountRule", () => {
  test("[positive] 推奨トークン数に収まるとき問題を報告しない", () => {
    // Given / When
    const findings = bodyTokenCountRule(skillOf({ content: "短い本文\n" }));

    // Then
    expect(findings).toEqual([]);
  });

  test("[negative] 推奨トークン数を超えるとき概算トークン数をメッセージに含めて報告する", () => {
    // Given: 1文字あたり1トークン未満にはならないため、上限の2倍の文字数で確実に超える
    const content = "語彙".repeat(RECOMMENDED_MAX_TOKENS * 2);

    // When
    const findings = bodyTokenCountRule(skillOf({ content }));

    // Then: 概算トークン数をメッセージに含めて報告する
    expect(findings).toMatchObject([{ code: "body-too-many-tokens", source: "spec", level: "should" }]);
    expect(findings[0]?.message).toContain(String(encode(content).length));
  });
});
