import { describe, expect, test } from "bun:test";

import { codesOf, skillOf, VALID_DESCRIPTION } from "../test-fixtures.ts";

import { extraFieldsRule, SPEC_FIELDS } from "./extra-fields.ts";

const BASE = { name: "sample-skill", description: VALID_DESCRIPTION };

describe("extraFieldsRule", () => {
  test("[positive] 必須フィールドのみ", () => {
    // Given / When
    const findings = extraFieldsRule(skillOf({ frontmatter: BASE }));

    // Then
    expect(findings).toEqual([]);
  });

  test("[positive] 仕様が定めるフィールドをすべて備える", () => {
    // Given
    const frontmatter = Object.fromEntries(SPEC_FIELDS.map((field) => [field, "value"]));

    // When
    const findings = extraFieldsRule(skillOf({ frontmatter }));

    // Then
    expect(findings).toEqual([]);
  });

  test("[negative] 仕様外フィールドを名前付きで報告する", () => {
    // Given / When
    const findings = extraFieldsRule(
      skillOf({ frontmatter: { ...BASE, "disable-model-invocation": true } }),
    );

    // Then
    expect(codesOf(findings)).toEqual(["extra-fields"]);
    expect(findings[0]?.message).toContain("disable-model-invocation");
  });

  test("[negative] 複数の仕様外フィールドを整列して並べる", () => {
    // Given / When
    const findings = extraFieldsRule(
      skillOf({ frontmatter: { ...BASE, zeta: 1, alpha: 2 } }),
    );

    // Then
    expect(findings[0]?.message).toContain("alpha, zeta");
  });

  test("[negative] 推奨として報告する", () => {
    // Given / When
    const findings = extraFieldsRule(skillOf({ frontmatter: { ...BASE, extra: 1 } }));

    // Then
    expect(findings[0]?.source).toBe("spec");
    expect(findings[0]?.level).toBe("should");
  });
});
