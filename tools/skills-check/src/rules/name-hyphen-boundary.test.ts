import { describe, expect, test } from "bun:test";

import { codesOf, skillOf } from "../test-fixtures.ts";

import { nameHyphenBoundaryRule } from "./name-hyphen-boundary.ts";

describe("nameHyphenBoundaryRule", () => {
  test.each([
    ["[positive] ハイフンで始まらず終わらない名前", "sample-skill", []],
    ["[positive] ハイフンを含まない名前", "sample", []],
    ["[negative] ハイフンで始まる名前", "-sample", ["name-hyphen-boundary"]],
    ["[negative] ハイフンで終わる名前", "sample-", ["name-hyphen-boundary"]],
    ["[negative] 前後ともハイフンの名前", "-sample-", ["name-hyphen-boundary"]],
  ])("%s", (_label, name, expected) => {
    // Given / When
    const findings = nameHyphenBoundaryRule(skillOf({ frontmatter: { name } }));

    // Then
    expect(codesOf(findings)).toEqual(expected);
  });

  test("[negative] 出自と規範の強さを伴って返す", () => {
    // Given / When
    const findings = nameHyphenBoundaryRule(skillOf({ frontmatter: { name: "-sample" } }));

    // Then
    expect(findings[0]?.source).toBe("spec");
    expect(findings[0]?.level).toBe("must");
  });
});
