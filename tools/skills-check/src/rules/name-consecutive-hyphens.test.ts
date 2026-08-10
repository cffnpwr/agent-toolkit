import { describe, expect, test } from "bun:test";

import { codesOf, skillOf } from "../test-fixtures.ts";

import { nameConsecutiveHyphensRule } from "./name-consecutive-hyphens.ts";

describe("nameConsecutiveHyphensRule", () => {
  test.each([
    ["[positive] 単一のハイフン", "sample-skill", []],
    ["[positive] 離れた複数のハイフン", "a-b-c", []],
    ["[negative] 連続するハイフン", "sample--skill", ["name-consecutive-hyphens"]],
    ["[negative] 3つ連続するハイフン", "sample---skill", ["name-consecutive-hyphens"]],
  ])("%s", (_label, name, expected) => {
    // Given / When
    const findings = nameConsecutiveHyphensRule(skillOf({ frontmatter: { name } }));

    // Then
    expect(codesOf(findings)).toEqual(expected);
  });

  test("[negative] 出自と規範の強さを伴って返す", () => {
    // Given / When
    const findings = nameConsecutiveHyphensRule(skillOf({ frontmatter: { name: "a--b" } }));

    // Then
    expect(findings[0]?.source).toBe("spec");
    expect(findings[0]?.level).toBe("must");
  });
});
