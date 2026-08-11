import { describe, expect, test } from "bun:test";

import { skillOf, VALID_DESCRIPTION } from "../test-fixtures.ts";

import { nameDirectoryMatchRule } from "./name-directory-match.ts";

describe("nameDirectoryMatchRule", () => {
  test("[positive] 名前がディレクトリ名と一致するとき問題を報告しない", () => {
    // Given / When
    const findings = nameDirectoryMatchRule(
      skillOf({ name: "sample-skill", frontmatter: { name: "sample-skill", description: VALID_DESCRIPTION } }),
    );

    // Then
    expect(findings).toEqual([]);
  });

  test("[positive] 全角の名前をNFKC正規化すると一致するとき問題を報告しない", () => {
    // Given / When
    const findings = nameDirectoryMatchRule(
      skillOf({ name: "sample", frontmatter: { name: "ｓａｍｐｌｅ", description: VALID_DESCRIPTION } }),
    );

    // Then
    expect(findings).toEqual([]);
  });

  test("[negative] 名前がディレクトリ名と異なるとき問題を両方の名前とともに報告する", () => {
    // Given / When
    const findings = nameDirectoryMatchRule(
      skillOf({ name: "sample-skill", frontmatter: { name: "other-skill", description: VALID_DESCRIPTION } }),
    );

    // Then
    expect(findings).toMatchObject([{ code: "name-dir-mismatch", source: "spec", level: "must" }]);
    expect(findings[0]?.message).toContain("sample-skill");
    expect(findings[0]?.message).toContain("other-skill");
  });
});
