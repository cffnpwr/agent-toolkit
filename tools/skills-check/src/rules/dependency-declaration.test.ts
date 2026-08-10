import { describe, expect, test } from "bun:test";

import { codesOf, skillOf, VALID_DESCRIPTION } from "../test-fixtures.ts";

import { dependencyDeclarationRule } from "./dependency-declaration.ts";

const BASE = { name: "sample-skill", description: VALID_DESCRIPTION };

describe("dependencyDeclarationRule", () => {
  test.each([
    ["[positive] 両方そろっている", { ...BASE, compatibility: "Requires git" }, "## Requirements\n", []],
    ["[positive] どちらもない", BASE, "本文のみ\n", []],
    [
      "[negative] compatibilityのみ",
      { ...BASE, compatibility: "Requires git" },
      "本文のみ\n",
      ["compatibility-without-requirements"],
    ],
    [
      "[negative] Requirements節のみ",
      BASE,
      "## Requirements\n",
      ["requirements-without-compatibility"],
    ],
  ])("%s", (_label, frontmatter, content, expected) => {
    // Given / When
    const findings = dependencyDeclarationRule(skillOf({ frontmatter, content }));

    // Then
    expect(codesOf(findings)).toEqual(expected);
  });

  test("[positive] 見出しでない Requirements の記述を節と見なさない", () => {
    // Given
    const content = "本文で Requirements について述べる。\n";

    // When
    const findings = dependencyDeclarationRule(skillOf({ frontmatter: BASE, content }));

    // Then
    expect(findings).toEqual([]);
  });

  test("[negative] リポジトリ規約として報告する", () => {
    // Given / When
    const findings = dependencyDeclarationRule(
      skillOf({ frontmatter: { ...BASE, compatibility: "git" }, content: "本文\n" }),
    );

    // Then
    expect(findings[0]?.source).toBe("repo");
    expect(findings[0]?.level).toBe("must");
  });
});
