import { describe, expect, test } from "bun:test";

import { skillOf, VALID_DESCRIPTION } from "../test-fixtures.ts";

import { extraFieldsRule } from "./extra-fields.ts";

const BASE = { name: "sample-skill", description: VALID_DESCRIPTION };

describe("extraFieldsRule", () => {
  test("[positive] 必須フィールドのみのとき問題を報告しない", () => {
    // Given / When
    const findings = extraFieldsRule(skillOf({ frontmatter: BASE }));

    // Then
    expect(findings).toEqual([]);
  });

  test("[positive] 仕様が定めるフィールドをすべて備えているとき問題を報告しない", () => {
    // Given: 仕様が定める6フィールド（name・description・license・compatibility・metadata・allowed-tools）をすべて持つ
    const frontmatter = {
      name: "sample-skill",
      description: VALID_DESCRIPTION,
      license: "MIT",
      compatibility: "Requires git",
      metadata: { author: "example" },
      "allowed-tools": "Read Grep",
    };

    // When
    const findings = extraFieldsRule(skillOf({ frontmatter }));

    // Then
    expect(findings).toEqual([]);
  });

  test("[negative] 仕様外フィールドがあるとき問題をフィールド名とともに報告する", () => {
    // Given / When
    const findings = extraFieldsRule(
      skillOf({ frontmatter: { ...BASE, "disable-model-invocation": true } }),
    );

    // Then
    expect(findings).toMatchObject([{ code: "extra-fields", source: "spec", level: "should" }]);
    expect(findings[0]?.message).toContain("disable-model-invocation");
  });

  test("[negative] 複数の仕様外フィールドがあるとき宣言順に列挙してメッセージに含める", () => {
    // Given / When
    const findings = extraFieldsRule(skillOf({ frontmatter: { ...BASE, zeta: 1, alpha: 2 } }));

    // Then
    expect(findings).toMatchObject([{ code: "extra-fields", source: "spec", level: "should" }]);
    expect(findings[0]?.message).toContain("zeta, alpha");
  });
});
