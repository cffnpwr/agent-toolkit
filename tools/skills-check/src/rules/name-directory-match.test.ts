import { describe, expect, test } from "bun:test";

import { codesOf, skillOf } from "../test-fixtures.ts";

import { nameDirectoryMatchRule } from "./name-directory-match.ts";

describe("nameDirectoryMatchRule", () => {
  test("[positive] 名前がディレクトリ名と一致する", () => {
    // Given / When
    const findings = nameDirectoryMatchRule(
      skillOf({ name: "sample-skill", frontmatter: { name: "sample-skill" } }),
    );

    // Then
    expect(findings).toEqual([]);
  });

  test("[positive] 全角の名前をNFKC正規化して照合する", () => {
    // Given / When
    const findings = nameDirectoryMatchRule(
      skillOf({ name: "sample", frontmatter: { name: "ｓａｍｐｌｅ" } }),
    );

    // Then
    expect(findings).toEqual([]);
  });

  test("[negative] 名前がディレクトリ名と異なる", () => {
    // Given / When
    const findings = nameDirectoryMatchRule(
      skillOf({ name: "sample-skill", frontmatter: { name: "other-skill" } }),
    );

    // Then
    expect(codesOf(findings)).toEqual(["name-dir-mismatch"]);
  });

  test("[negative] メッセージに両方の名前を含める", () => {
    // Given / When
    const findings = nameDirectoryMatchRule(
      skillOf({ name: "sample-skill", frontmatter: { name: "other-skill" } }),
    );

    // Then
    expect(findings[0]?.message).toContain("sample-skill");
    expect(findings[0]?.message).toContain("other-skill");
    expect(findings[0]?.source).toBe("spec");
    expect(findings[0]?.level).toBe("must");
  });
});
