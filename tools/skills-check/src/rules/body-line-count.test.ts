import { describe, expect, test } from "bun:test";

import { codesOf, skillOf } from "../test-fixtures.ts";

import { bodyLineCountRule, RECOMMENDED_MAX_LINES } from "./body-line-count.ts";

describe("bodyLineCountRule", () => {
  test.each([
    ["[positive] 推奨行数より少ない", RECOMMENDED_MAX_LINES - 2, []],
    ["[positive] 推奨行数ちょうど", RECOMMENDED_MAX_LINES - 1, []],
    ["[negative] 推奨行数を1行超える", RECOMMENDED_MAX_LINES, ["body-too-many-lines"]],
  ])("%s", (_label, repeats, expected) => {
    // Given: 末尾の改行により行数は repeats + 1 になる
    const content = "a\n".repeat(repeats);

    // When
    const findings = bodyLineCountRule(skillOf({ content }));

    // Then
    expect(codesOf(findings)).toEqual(expected);
  });

  test("[negative] 現在の行数をメッセージに含めて推奨として報告する", () => {
    // Given
    const content = "a\n".repeat(RECOMMENDED_MAX_LINES + 9);

    // When
    const findings = bodyLineCountRule(skillOf({ content }));

    // Then
    expect(findings[0]?.message).toContain(String(RECOMMENDED_MAX_LINES + 10));
    expect(findings[0]?.source).toBe("spec");
    expect(findings[0]?.level).toBe("should");
  });
});
