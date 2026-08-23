import { describe, expect, test } from "bun:test";

import { skillOf, VALID_DESCRIPTION } from "../test-fixtures.ts";

import { dependencyDeclarationRule } from "./dependency-declaration.ts";

const BASE = { name: "sample-skill", description: VALID_DESCRIPTION };

describe("dependencyDeclarationRule", () => {
  test.each([
    [
      "[positive] compatibilityとRequirements節の両方があるとき問題を報告しない",
      { ...BASE, compatibility: "Requires git" },
      "## Requirements\n",
      [],
    ],
    ["[positive] compatibilityとRequirements節のどちらもないとき問題を報告しない", BASE, "本文のみ\n", []],
    [
      "[negative] compatibilityのみでRequirements節がないとき問題を報告する",
      { ...BASE, compatibility: "Requires git" },
      "本文のみ\n",
      [{ code: "dependency-declaration-mismatch", source: "repo", level: "must" }],
    ],
    [
      "[negative] Requirements節のみでcompatibilityがないとき問題を報告する",
      BASE,
      "## Requirements\n",
      [{ code: "dependency-declaration-mismatch", source: "repo", level: "must" }],
    ],
    [
      "[positive] Requirementsが見出しでなく本文中に出てくるだけのとき問題を報告しない",
      BASE,
      "本文で Requirements について述べる。\n",
      [],
    ],
    [
      "[positive] 見出しが最大3つの空白でインデントされているとき問題を報告しない",
      { ...BASE, compatibility: "Requires git" },
      "  ## Requirements\n",
      [],
    ],
    [
      "[positive] 見出しの閉じ側に空白と#の列が続くとき問題を報告しない",
      { ...BASE, compatibility: "Requires git" },
      "## Requirements ##\n",
      [],
    ],
    [
      "[negative] 見出しが4つ以上の空白でインデントされコードブロックとして扱われるとき問題を報告する",
      { ...BASE, compatibility: "Requires git" },
      "    ## Requirements\n",
      [{ code: "dependency-declaration-mismatch", source: "repo", level: "must" }],
    ],
  ])("%s", (_label, frontmatter, content, expected) => {
    // Given / When
    const findings = dependencyDeclarationRule(skillOf({ frontmatter, content }));

    // Then
    expect(findings).toMatchObject(expected);
  });
});
