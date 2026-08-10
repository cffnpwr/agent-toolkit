import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";

import { parse as parseYaml } from "yaml";

import type { TempWorkspace } from "./test-fixtures.ts";

import { loadSkillLocation } from "./loader.ts";
import {
  checkFrontmatterSchema,
  MAX_COMPATIBILITY_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  parseFrontmatter,
  readSkillMd,
} from "./skill-md.ts";
import { createTempWorkspace, skillMdOf, VALID_DESCRIPTION } from "./test-fixtures.ts";

const VALID = { name: "sample-skill", description: VALID_DESCRIPTION };

let workspace: TempWorkspace;

beforeEach(() => {
  workspace = createTempWorkspace();
});

afterEach(() => {
  workspace.cleanup();
});

describe("parseFrontmatter", () => {
  test("[positive] 折りたたみスカラーを連結して返す", () => {
    // Given
    const content = "---\ndescription: >\n  前半の行\n  後半の行\n---\n\n本文\n";

    // When
    const result = parseFrontmatter(content);

    // Then
    expect(result.isOk()).toBeTrue();
    const value = result.unwrap();
    expect(value).toEqual({ description: "前半の行 後半の行\n" });
  });

  test.each([
    [
      "[negative] フロントマターがないときfrontmatter-missingを返す",
      "本文のみ\n",
      { code: "frontmatter-missing", source: "spec", level: "must" },
    ],
    [
      "[negative] マッピングでない構造のときfrontmatter-not-mappingを返す",
      "---\n- item\n---\n",
      { code: "frontmatter-not-mapping", source: "spec", level: "must" },
    ],
    [
      "[negative] 中身が空のときfrontmatter-not-mappingを返す",
      "---\n\n---\n",
      { code: "frontmatter-not-mapping", source: "spec", level: "must" },
    ],
  ])("%s", (_label, content, expected) => {
    // Given / When
    const result = parseFrontmatter(content);

    // Then
    expect(result.isErr()).toBeTrue();
    const value = result.unwrapErr();
    expect(value).toMatchObject(expected);
  });

  test("[negative] YAMLとして壊れているときパーサのエラー文字列を添えてfrontmatter-invalid-yamlを返す", () => {
    // Given: フロントマター部分は"name: [unclosed"（閉じていないフローシーケンス）
    const inner = "name: [unclosed";
    const content = `---\n${inner}\n---\n`;

    // When
    const result = parseFrontmatter(content);

    // Then
    expect(result.isErr()).toBeTrue();
    const value = result.unwrapErr();
    expect(value).toMatchObject({ code: "frontmatter-invalid-yaml", source: "spec", level: "must" });

    // 本番コードと同じ入力をパーサへ直接渡し、実際のエラー文字列を得る
    let parserError = "";
    try {
      parseYaml(inner);
    } catch (error) {
      parserError = String(error);
    }
    expect(parserError).not.toBe("");
    expect(value.message).toContain(parserError);
  });
});

describe("checkFrontmatterSchema", () => {
  test.each([
    ["[positive] 必須フィールドのみのとき問題を報告しない", VALID],
    ["[positive] 仕様の任意フィールドをすべて備えていても問題を報告しない", {
      ...VALID,
      license: "MIT",
      "allowed-tools": "Read Grep",
      compatibility: "Requires git",
      metadata: { author: "example" },
    }],
    ["[positive] 仕様外フィールドがあっても問題を報告しない", { ...VALID, "disable-model-invocation": true }],
  ])("%s", (_label, frontmatter) => {
    // Given / When
    const findings = checkFrontmatterSchema(frontmatter as Record<string, unknown>);

    // Then
    expect(findings).toEqual([]);
  });

  test("[negative] 必須フィールドが両方欠けているとき両方を報告する", () => {
    // Given / When
    const findings = checkFrontmatterSchema({});

    // Then: 順序に関わらず両方のfindingを報告する
    // 順序は保証されないため、codeで揃えてから照合する
    expect([...findings].sort((a, b) => a.code.localeCompare(b.code))).toMatchObject([
      { code: "description-missing", source: "spec", level: "must" },
      { code: "name-missing", source: "spec", level: "must" },
    ]);
  });

  test.each([
    [
      "[negative] 名前が空文字列のとき文字種の違反を重ねずname-not-stringだけを報告する",
      { ...VALID, name: "" },
      [{ code: "name-not-string", source: "spec", level: "must" }],
    ],
    [
      "[negative] 名前が文字列でないときname-not-stringを報告する",
      { ...VALID, name: 42 },
      [{ code: "name-not-string", source: "spec", level: "must" }],
    ],
    [
      "[negative] 名前が上限文字数を超えるときname-too-longを報告する",
      { ...VALID, name: "a".repeat(MAX_NAME_LENGTH + 1) },
      [{ code: "name-too-long", source: "spec", level: "must" }],
    ],
    [
      "[negative] 名前に大文字を含むときname-invalid-formatを報告する",
      { ...VALID, name: "Sample" },
      [{ code: "name-invalid-format", source: "spec", level: "must" }],
    ],
    [
      "[negative] 名前が全角文字のときname-invalid-formatを報告する",
      { ...VALID, name: "サンプル" },
      [{ code: "name-invalid-format", source: "spec", level: "must" }],
    ],
    [
      "[negative] 名前にアンダースコアを含むときname-invalid-formatを報告する",
      { ...VALID, name: "sample_skill" },
      [{ code: "name-invalid-format", source: "spec", level: "must" }],
    ],
    [
      "[negative] 名前がハイフンで始まるときname-invalid-formatを報告する",
      { ...VALID, name: "-sample" },
      [{ code: "name-invalid-format", source: "spec", level: "must" }],
    ],
    [
      "[negative] 名前がハイフンで終わるときname-invalid-formatを報告する",
      { ...VALID, name: "sample-" },
      [{ code: "name-invalid-format", source: "spec", level: "must" }],
    ],
    [
      "[negative] 名前の先頭と末尾がともにハイフンのときname-invalid-formatを報告する",
      { ...VALID, name: "-sample-" },
      [{ code: "name-invalid-format", source: "spec", level: "must" }],
    ],
    [
      "[negative] 名前にハイフンが2つ連続するときname-invalid-formatを報告する",
      { ...VALID, name: "sample--skill" },
      [{ code: "name-invalid-format", source: "spec", level: "must" }],
    ],
    [
      "[negative] 名前にハイフンが3つ連続するときname-invalid-formatを報告する",
      { ...VALID, name: "sample---skill" },
      [{ code: "name-invalid-format", source: "spec", level: "must" }],
    ],
    [
      "[negative] 説明が空文字列のときdescription-not-stringを報告する",
      { ...VALID, description: "" },
      [{ code: "description-not-string", source: "spec", level: "must" }],
    ],
    [
      "[negative] 説明が空白のみのときdescription-not-stringを報告する",
      { ...VALID, description: "   " },
      [{ code: "description-not-string", source: "spec", level: "must" }],
    ],
    [
      "[negative] 説明が上限文字数を超えるときdescription-too-longを報告する",
      { ...VALID, description: "あ".repeat(MAX_DESCRIPTION_LENGTH + 1) },
      [{ code: "description-too-long", source: "spec", level: "must" }],
    ],
    [
      "[negative] 説明が空白のみで上限文字数も超えるとき長さの違反を重ねずdescription-not-stringだけを報告する",
      { ...VALID, description: " ".repeat(MAX_DESCRIPTION_LENGTH + 1) },
      [{ code: "description-not-string", source: "spec", level: "must" }],
    ],
    [
      "[negative] compatibilityが文字列でないときcompatibility-not-stringを報告する",
      { ...VALID, compatibility: ["git"] },
      [{ code: "compatibility-not-string", source: "spec", level: "must" }],
    ],
    [
      "[negative] compatibilityが上限文字数を超えるときcompatibility-too-longを報告する",
      { ...VALID, compatibility: "a".repeat(MAX_COMPATIBILITY_LENGTH + 1) },
      [{ code: "compatibility-too-long", source: "spec", level: "must" }],
    ],
    [
      "[negative] metadataがマッピングでないときmetadata-not-mappingを報告する",
      { ...VALID, metadata: "plain-string" },
      [{ code: "metadata-not-mapping", source: "spec", level: "must" }],
    ],
    [
      "[negative] metadataの値が文字列でないときmetadata-not-string-mapを報告する",
      { ...VALID, metadata: { version: 1 } },
      [{ code: "metadata-not-string-map", source: "spec", level: "must" }],
    ],
  ])("%s", (_label, frontmatter, expected) => {
    // Given / When
    const findings = checkFrontmatterSchema(frontmatter as Record<string, unknown>);

    // Then
    expect(findings).toMatchObject(expected);
  });

  test("[negative] 文字数はUTF-16符号単位で数えて上限超過を報告する", () => {
    // Given: 非BMP文字はコードポイント1つに対しUTF-16では2つを占める
    const description = "🧑".repeat((MAX_DESCRIPTION_LENGTH / 2) + 1);

    // When
    const findings = checkFrontmatterSchema({ ...VALID, description });

    // Then
    expect([...description].length).toBeLessThanOrEqual(MAX_DESCRIPTION_LENGTH);
    expect(findings).toMatchObject([{ code: "description-too-long", source: "spec", level: "must" }]);
  });
});

describe("readSkillMd", () => {
  test("[positive] 有効なSKILL.mdを読み込むとスキルを返す", () => {
    // Given
    const dir = workspace.makeSkillDir("sample-skill", { "SKILL.md": skillMdOf("sample-skill") });
    const location = loadSkillLocation(dir).unwrap();

    // When
    const result = readSkillMd(location);

    // Then
    expect(result.isOk()).toBeTrue();
    const value = result.unwrap();
    expect(value.frontmatter.name).toBe("sample-skill");
    expect(value.skillMdPath).toBe(join(dir, "SKILL.md"));
  });

  test("[negative] フロントマターを読めないときfrontmatter-missingを1件返す", () => {
    // Given
    const dir = workspace.makeSkillDir("sample-skill", { "SKILL.md": "本文のみ\n" });
    const location = loadSkillLocation(dir).unwrap();

    // When
    const result = readSkillMd(location);

    // Then
    expect(result.isErr()).toBeTrue();
    const value = result.unwrapErr();
    expect(value).toMatchObject([{ code: "frontmatter-missing", source: "spec", level: "must" }]);
  });

  test("[negative] スキーマ違反が複数あるときまとめて返す", () => {
    // Given
    const dir = workspace.makeSkillDir("sample-skill", { "SKILL.md": "---\nlicense: MIT\n---\n" });
    const location = loadSkillLocation(dir).unwrap();

    // When
    const result = readSkillMd(location);

    // Then: 順序に関わらずスキーマ違反をすべて報告する
    expect(result.isErr()).toBeTrue();
    const value = result.unwrapErr();
    // 順序は保証されないため、codeで揃えてから照合する
    expect([...value].sort((a, b) => a.code.localeCompare(b.code))).toMatchObject([
      { code: "description-missing", source: "spec", level: "must" },
      { code: "name-missing", source: "spec", level: "must" },
    ]);
  });
});
