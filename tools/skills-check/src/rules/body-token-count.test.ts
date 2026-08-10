import { describe, expect, test } from "bun:test";

import { codesOf, skillOf } from "../test-fixtures.ts";

import { bodyTokenCountRule, RECOMMENDED_MAX_TOKENS } from "./body-token-count.ts";

describe("bodyTokenCountRule", () => {
  test("[positive] 推奨トークン数に収まる本文", () => {
    // Given / When
    const findings = bodyTokenCountRule(skillOf({ content: "短い本文\n" }));

    // Then
    expect(findings).toEqual([]);
  });

  test("[negative] 推奨トークン数を超える本文", () => {
    // Given: 1文字あたり1トークン未満にはならないため、上限の2倍の文字数で確実に超える
    const content = "語彙".repeat(RECOMMENDED_MAX_TOKENS * 2);

    // When
    const findings = bodyTokenCountRule(skillOf({ content }));

    // Then
    expect(codesOf(findings)).toEqual(["body-too-many-tokens"]);
    expect(findings[0]?.source).toBe("spec");
    expect(findings[0]?.level).toBe("should");
  });
});
