import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import type { TempWorkspace } from "../test-fixtures.ts";

import { codesOf, createTempWorkspace } from "../test-fixtures.ts";

import { referencedDocumentPaths, referenceDepthRule } from "./reference-depth.ts";

let workspace: TempWorkspace;

beforeEach(() => {
  workspace = createTempWorkspace();
});

afterEach(() => {
  workspace.cleanup();
});

describe("referencedDocumentPaths", () => {
  test("[positive] スキル内の実在するMarkdownを絶対パスで返す", () => {
    // Given
    const skill = workspace.makeSkill("sample-skill", {
      "SKILL.md": "詳細は [手順](references/guide.md) を読む。\n",
      "references/guide.md": "手順\n",
    });

    // When
    const paths = referencedDocumentPaths(skill.skillMdPath, skill.dir);

    // Then
    expect(paths).toEqual([join(skill.dir, "references/guide.md")]);
  });

  test("[positive] アンカーを落として同じ宛先をまとめる", () => {
    // Given
    const skill = workspace.makeSkill("sample-skill", {
      "SKILL.md": "[節](references/guide.md#section) と [全体](references/guide.md)。\n",
      "references/guide.md": "手順\n",
    });

    // When
    const paths = referencedDocumentPaths(skill.skillMdPath, skill.dir);

    // Then
    expect(paths).toEqual([join(skill.dir, "references/guide.md")]);
  });

  test.each([
    ["[negative] 外部URL", "[外部](https://example.com/a.md)"],
    ["[negative] ページ内アンカーのみ", "[節](#section)"],
    ["[negative] Markdown以外のファイル", "[script](scripts/run.sh)"],
    ["[negative] 実在しないファイル", "[無い](references/missing.md)"],
    ["[negative] スキルの外にあるファイル", "[外](../outside.md)"],
  ])("%s は返さない", (_label, link) => {
    // Given
    writeFileSync(join(workspace.root, "outside.md"), "外部\n", "utf8");
    const skill = workspace.makeSkill("sample-skill", {
      "SKILL.md": `${link}\n`,
      "scripts/run.sh": "#!/bin/sh\n",
    });

    // When
    const paths = referencedDocumentPaths(skill.skillMdPath, skill.dir);

    // Then
    expect(paths).toEqual([]);
  });
});

describe("referenceDepthRule", () => {
  test("[positive] 1階層の参照のみ", () => {
    // Given
    const skill = workspace.makeSkill("sample-skill", {
      "SKILL.md": "[手順](references/guide.md)\n",
      "references/guide.md": "手順\n",
    });

    // When
    const findings = referenceDepthRule(skill);

    // Then
    expect(findings).toEqual([]);
  });

  test("[positive] 参照先からSKILL.mdへ戻るリンクは連鎖と見なさない", () => {
    // Given
    const skill = workspace.makeSkill("sample-skill", {
      "SKILL.md": "[手順](references/guide.md)\n",
      "references/guide.md": "[戻る](../SKILL.md)\n",
    });

    // When
    const findings = referenceDepthRule(skill);

    // Then
    expect(findings).toEqual([]);
  });

  test("[positive] SKILL.mdから直接も辿れる参照先は連鎖と見なさない", () => {
    // Given
    const skill = workspace.makeSkill("sample-skill", {
      "SKILL.md": "[一](references/a.md) [二](references/b.md)\n",
      "references/a.md": "[二](b.md)\n",
      "references/b.md": "内容\n",
    });

    // When
    const findings = referenceDepthRule(skill);

    // Then
    expect(findings).toEqual([]);
  });

  test("[negative] 2階層目の参照を報告する", () => {
    // Given
    const skill = workspace.makeSkill("sample-skill", {
      "SKILL.md": "[一](references/a.md)\n",
      "references/a.md": "[二](b.md)\n",
      "references/b.md": "内容\n",
    });

    // When
    const findings = referenceDepthRule(skill);

    // Then
    expect(codesOf(findings)).toEqual(["reference-too-deep"]);
    expect(findings[0]?.message).toContain("references/b.md");
    expect(findings[0]?.source).toBe("spec");
    expect(findings[0]?.level).toBe("should");
  });

  test("[negative] 連鎖が複数あれば件数分を返す", () => {
    // Given
    const skill = workspace.makeSkill("sample-skill", {
      "SKILL.md": "[一](references/a.md)\n",
      "references/a.md": "[二](b.md) [三](c.md)\n",
      "references/b.md": "内容\n",
      "references/c.md": "内容\n",
    });

    // When
    const findings = referenceDepthRule(skill);

    // Then
    expect(codesOf(findings)).toEqual(["reference-too-deep", "reference-too-deep"]);
  });
});
