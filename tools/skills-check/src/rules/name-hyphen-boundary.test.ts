import { describe, expect, test } from "bun:test";

import { skillOf } from "../test-fixtures.ts";

import { nameHyphenBoundaryRule } from "./name-hyphen-boundary.ts";

describe("nameHyphenBoundaryRule", () => {
  test.each([
    ["[positive] ハイフンで始まらず終わらない名前のとき問題を報告しない", "sample-skill", []],
    ["[positive] ハイフンを含まない名前のとき問題を報告しない", "sample", []],
    [
      "[negative] ハイフンで始まる名前のとき問題を報告する",
      "-sample",
      [{ code: "name-hyphen-boundary", source: "spec", level: "must" }],
    ],
    [
      "[negative] ハイフンで終わる名前のとき問題を報告する",
      "sample-",
      [{ code: "name-hyphen-boundary", source: "spec", level: "must" }],
    ],
    [
      "[negative] 前後ともハイフンの名前のとき問題を報告する",
      "-sample-",
      [{ code: "name-hyphen-boundary", source: "spec", level: "must" }],
    ],
  ])("%s", (_label, name, expected) => {
    // Given / When
    const findings = nameHyphenBoundaryRule(skillOf({ frontmatter: { name } }));

    // Then
    expect(findings).toMatchObject(expected);
  });
});
