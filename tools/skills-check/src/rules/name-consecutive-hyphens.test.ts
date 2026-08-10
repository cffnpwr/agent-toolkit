import { describe, expect, test } from "bun:test";

import { skillOf } from "../test-fixtures.ts";

import { nameConsecutiveHyphensRule } from "./name-consecutive-hyphens.ts";

describe("nameConsecutiveHyphensRule", () => {
  test.each([
    ["[positive] ハイフンが1つだけのとき問題を報告しない", "sample-skill", []],
    ["[positive] ハイフンが離れて複数あるとき問題を報告しない", "a-b-c", []],
    [
      "[negative] ハイフンが2つ連続するとき問題を報告する",
      "sample--skill",
      [{ code: "name-consecutive-hyphens", source: "spec", level: "must" }],
    ],
    [
      "[negative] ハイフンが3つ連続するとき問題を報告する",
      "sample---skill",
      [{ code: "name-consecutive-hyphens", source: "spec", level: "must" }],
    ],
  ])("%s", (_label, name, expected) => {
    // Given / When
    const findings = nameConsecutiveHyphensRule(skillOf({ frontmatter: { name } }));

    // Then
    expect(findings).toMatchObject(expected);
  });
});
