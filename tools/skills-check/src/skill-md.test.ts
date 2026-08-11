import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";

import { parse as parseYaml } from "yaml";

import type { TempWorkspace } from "./test-fixtures.ts";

import { loadSkillLocation } from "./loader.ts";
import {
  MAX_COMPATIBILITY_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  parseFrontmatter,
  readSkillMd,
} from "./skill-md.ts";
import { createTempWorkspace, frontmatterYamlOf, skillMdOf, VALID_DESCRIPTION } from "./test-fixtures.ts";

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
    const content = "---\nname: sample-skill\ndescription: >\n  前半の行\n  後半の行\n---\n\n本文\n";

    // When
    const result = parseFrontmatter(content);

    // Then
    expect(result.isOk()).toBeTrue();
    const value = result.unwrap();
    expect(value).toEqual({ name: "sample-skill", description: "前半の行 後半の行\n" });
  });

  test("[positive] YAML 1.1タグが付いた値を解決せず文字列として返す", () => {
    // Given: !!timestampを解決すると本来Dateになる
    const content = `---\nname: sample-skill\ndescription: ${VALID_DESCRIPTION}\nlicense: !!timestamp 2001-12-14\n---\n\n本文\n`;

    // When
    const result = parseFrontmatter(content);

    // Then: YAML 1.2 coreスキーマの範囲に収めるため、タグを解決せず文字列のまま返す
    expect(result.isOk()).toBeTrue();
    const value = result.unwrap();
    expect(value).toEqual({ name: "sample-skill", description: VALID_DESCRIPTION, license: "2001-12-14" });
  });

  test.each([
    [
      "[negative] フロントマターがないときfrontmatter-missingを返す",
      "本文のみ\n",
      [{ code: "frontmatter-missing", source: "spec", level: "must" }],
    ],
    [
      "[negative] マッピングでない構造のときfrontmatter-not-mappingを返す",
      "---\n- item\n---\n",
      [{ code: "frontmatter-not-mapping", source: "spec", level: "must" }],
    ],
    [
      "[negative] 中身が空のときfrontmatter-not-mappingを返す",
      "---\n\n---\n",
      [{ code: "frontmatter-not-mapping", source: "spec", level: "must" }],
    ],
  ])("%s", (_label, content, expected) => {
    // Given / When
    const result = parseFrontmatter(content);

    // Then
    expect(result.isErr()).toBeTrue();
    const findings = result.unwrapErr();
    expect(findings).toMatchObject(expected);
  });

  test("[negative] YAMLとして壊れているときパーサのエラー文字列を添えてfrontmatter-invalid-yamlを返す", () => {
    // Given: フロントマター部分は"name: [unclosed"（閉じていないフローシーケンス）
    const inner = "name: [unclosed";
    const content = `---\n${inner}\n---\n`;

    // When
    const result = parseFrontmatter(content);

    // Then
    expect(result.isErr()).toBeTrue();
    const findings = result.unwrapErr();
    expect(findings).toMatchObject([{ code: "frontmatter-invalid-yaml", source: "spec", level: "must" }]);

    let parserError = "";
    try {
      parseYaml(inner);
    } catch (error) {
      parserError = String(error);
    }
    expect(parserError).not.toBe("");
    expect(findings[0]?.message).toContain(parserError);
  });

  test.each([
    ["[positive] 必須フィールドのみのとき検証済みフロントマターを返す", frontmatterYamlOf(VALID)],
    ["[positive] 仕様の任意フィールドをすべて備えていても検証済みフロントマターを返す", frontmatterYamlOf({
      ...VALID,
      license: "MIT",
      "allowed-tools": "Read Grep",
      compatibility: "Requires git",
      metadata: { author: "example" },
    })],
    [
      "[positive] 仕様外フィールドがあっても検証済みフロントマターを返す",
      frontmatterYamlOf({ ...VALID, "disable-model-invocation": true }),
    ],
    [
      "[positive] 仕様外フィールドの値がネストした配列・マッピングでも検証済みフロントマターを返す",
      frontmatterYamlOf({ ...VALID, extra: { list: [1, "two", null, { three: true }] } }),
    ],
  ])("%s", (_label, content) => {
    // Given / When
    const result = parseFrontmatter(content);

    // Then
    expect(result.isOk()).toBeTrue();
  });

  test("[negative] 必須フィールドが両方欠けているとき両方を報告する", () => {
    // Given: nameもdescriptionも持たないフロントマター
    const content = frontmatterYamlOf({});

    // When
    const result = parseFrontmatter(content);

    // Then: 順序に関わらず両方のfindingを報告する
    expect(result.isErr()).toBeTrue();
    const findings = result.unwrapErr();
    // 順序は保証されないため、codeで揃えてから照合する
    expect([...findings].sort((a, b) => a.code.localeCompare(b.code))).toMatchObject([
      { code: "description-missing", source: "spec", level: "must" },
      { code: "name-missing", source: "spec", level: "must" },
    ]);
  });

  test.each([
    [
      "[negative] 名前が空文字列のとき文字種の違反を重ねずname-not-stringだけを報告する",
      frontmatterYamlOf({ ...VALID, name: "" }),
      [{ code: "name-not-string", source: "spec", level: "must" }],
    ],
    [
      "[negative] 名前が文字列でないときname-not-stringを報告する",
      frontmatterYamlOf({ ...VALID, name: 42 }),
      [{ code: "name-not-string", source: "spec", level: "must" }],
    ],
    [
      "[negative] 名前が上限文字数を超えるときname-too-longを報告する",
      frontmatterYamlOf({ ...VALID, name: "a".repeat(MAX_NAME_LENGTH + 1) }),
      [{ code: "name-too-long", source: "spec", level: "must" }],
    ],
    [
      "[negative] 名前に大文字を含むときname-invalid-formatを報告する",
      frontmatterYamlOf({ ...VALID, name: "Sample" }),
      [{ code: "name-invalid-format", source: "spec", level: "must" }],
    ],
    [
      "[negative] 名前が全角文字のときname-invalid-formatを報告する",
      frontmatterYamlOf({ ...VALID, name: "サンプル" }),
      [{ code: "name-invalid-format", source: "spec", level: "must" }],
    ],
    [
      "[negative] 名前にアンダースコアを含むときname-invalid-formatを報告する",
      frontmatterYamlOf({ ...VALID, name: "sample_skill" }),
      [{ code: "name-invalid-format", source: "spec", level: "must" }],
    ],
    [
      "[negative] 名前がハイフンで始まるときname-invalid-formatを報告する",
      frontmatterYamlOf({ ...VALID, name: "-sample" }),
      [{ code: "name-invalid-format", source: "spec", level: "must" }],
    ],
    [
      "[negative] 名前がハイフンで終わるときname-invalid-formatを報告する",
      frontmatterYamlOf({ ...VALID, name: "sample-" }),
      [{ code: "name-invalid-format", source: "spec", level: "must" }],
    ],
    [
      "[negative] 名前の先頭と末尾がともにハイフンのときname-invalid-formatを報告する",
      frontmatterYamlOf({ ...VALID, name: "-sample-" }),
      [{ code: "name-invalid-format", source: "spec", level: "must" }],
    ],
    [
      "[negative] 名前にハイフンが2つ連続するときname-invalid-formatを報告する",
      frontmatterYamlOf({ ...VALID, name: "sample--skill" }),
      [{ code: "name-invalid-format", source: "spec", level: "must" }],
    ],
    [
      "[negative] 名前にハイフンが3つ連続するときname-invalid-formatを報告する",
      frontmatterYamlOf({ ...VALID, name: "sample---skill" }),
      [{ code: "name-invalid-format", source: "spec", level: "must" }],
    ],
    [
      "[negative] 説明が空文字列のときdescription-not-stringを報告する",
      frontmatterYamlOf({ ...VALID, description: "" }),
      [{ code: "description-not-string", source: "spec", level: "must" }],
    ],
    [
      "[negative] 説明が空白のみのときdescription-not-stringを報告する",
      frontmatterYamlOf({ ...VALID, description: "   " }),
      [{ code: "description-not-string", source: "spec", level: "must" }],
    ],
    [
      "[negative] 説明が上限文字数を超えるときdescription-too-longを報告する",
      frontmatterYamlOf({ ...VALID, description: "あ".repeat(MAX_DESCRIPTION_LENGTH + 1) }),
      [{ code: "description-too-long", source: "spec", level: "must" }],
    ],
    [
      "[negative] 説明が空白のみで上限文字数も超えるとき長さの違反を重ねずdescription-not-stringだけを報告する",
      frontmatterYamlOf({ ...VALID, description: " ".repeat(MAX_DESCRIPTION_LENGTH + 1) }),
      [{ code: "description-not-string", source: "spec", level: "must" }],
    ],
    [
      "[negative] compatibilityが文字列でないときcompatibility-not-stringを報告する",
      frontmatterYamlOf({ ...VALID, compatibility: ["git"] }),
      [{ code: "compatibility-not-string", source: "spec", level: "must" }],
    ],
    [
      "[negative] compatibilityが上限文字数を超えるときcompatibility-too-longを報告する",
      frontmatterYamlOf({ ...VALID, compatibility: "a".repeat(MAX_COMPATIBILITY_LENGTH + 1) }),
      [{ code: "compatibility-too-long", source: "spec", level: "must" }],
    ],
    [
      "[negative] metadataがマッピングでないときmetadata-not-mappingを報告する",
      frontmatterYamlOf({ ...VALID, metadata: "plain-string" }),
      [{ code: "metadata-not-mapping", source: "spec", level: "must" }],
    ],
    [
      "[negative] metadataの値が文字列でないときmetadata-not-string-mapを報告する",
      frontmatterYamlOf({ ...VALID, metadata: { version: 1 } }),
      [{ code: "metadata-not-string-map", source: "spec", level: "must" }],
    ],
    [
      "[negative] licenseが文字列でないときlicense-not-stringを報告する",
      frontmatterYamlOf({ ...VALID, license: 123 }),
      [{ code: "license-not-string", source: "spec", level: "must" }],
    ],
    [
      "[negative] allowed-toolsが文字列でないときallowed-tools-not-stringを報告する",
      frontmatterYamlOf({ ...VALID, "allowed-tools": ["Read", "Grep"] }),
      [{ code: "allowed-tools-not-string", source: "spec", level: "must" }],
    ],
  ])("%s", (_label, content, expected) => {
    // Given / When
    const result = parseFrontmatter(content);

    // Then
    expect(result.isErr()).toBeTrue();
    const findings = result.unwrapErr();
    expect(findings).toMatchObject(expected);
  });

  test("[negative] 文字数はUTF-16符号単位で数えて上限超過を報告する", () => {
    // Given: 非BMP文字はコードポイント1つに対しUTF-16では2つを占める
    const description = "🧑".repeat((MAX_DESCRIPTION_LENGTH / 2) + 1);
    const content = frontmatterYamlOf({ ...VALID, description });

    // When
    const result = parseFrontmatter(content);

    // Then
    expect([...description].length).toBeLessThanOrEqual(MAX_DESCRIPTION_LENGTH);
    expect(result.isErr()).toBeTrue();
    const findings = result.unwrapErr();
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
