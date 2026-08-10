import { describe, expect, test } from "bun:test";

import { skillOf } from "../test-fixtures.ts";

import { bodyLineCountRule, RECOMMENDED_MAX_LINES } from "./body-line-count.ts";

describe("bodyLineCountRule", () => {
  test.each([
    ["[positive] 推奨行数より少ないとき問題を報告しない", RECOMMENDED_MAX_LINES - 2],
    ["[positive] 推奨行数ちょうどのとき問題を報告しない", RECOMMENDED_MAX_LINES - 1],
  ])("%s", (_label, repeats) => {
    // Given: 末尾の改行により行数は repeats + 1 になる
    const content = "a\n".repeat(repeats);

    // When
    const findings = bodyLineCountRule(skillOf({ content }));

    // Then
    expect(findings).toEqual([]);
  });

  test("[negative] 推奨行数を1行超えるとき現在の行数をメッセージに含めて報告する", () => {
    // Given: 末尾の改行により行数は repeats + 1 になる
    const repeats = RECOMMENDED_MAX_LINES;
    const content = "a\n".repeat(repeats);

    // When
    const findings = bodyLineCountRule(skillOf({ content }));

    // Then
    expect(findings).toMatchObject([{ code: "body-too-many-lines", source: "spec", level: "should" }]);
    expect(findings[0]?.message).toContain(String(repeats + 1));
  });
});
