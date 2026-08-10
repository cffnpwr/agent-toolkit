import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";

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
import { codesOf, createTempWorkspace, skillMdOf, VALID_DESCRIPTION } from "./test-fixtures.ts";

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
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual({ description: "前半の行 後半の行\n" });
  });

  test.each([
    ["[negative] フロントマターがない", "本文のみ\n", "frontmatter-missing"],
    ["[negative] YAMLとして壊れている", "---\nname: [unclosed\n---\n", "frontmatter-invalid-yaml"],
    ["[negative] マッピングでない", "---\n- item\n---\n", "frontmatter-not-mapping"],
    ["[negative] 中身が空", "---\n\n---\n", "frontmatter-not-mapping"],
  ])("%s 内容は種別付きの Err を返す", (_label, content, expected) => {
    // Given / When
    const result = parseFrontmatter(content);

    // Then
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe(expected);
    expect(result.unwrapErr().level).toBe("must");
  });
});

describe("checkFrontmatterSchema", () => {
  test.each([
    ["[positive] 必須フィールドのみ", VALID],
    ["[positive] 仕様の任意フィールドを備える", {
      ...VALID,
      license: "MIT",
      "allowed-tools": "Read Grep",
      compatibility: "Requires git",
      metadata: { author: "example" },
    }],
    ["[positive] 仕様外フィールドがある", { ...VALID, "disable-model-invocation": true }],
  ])("%s は問題を返さない", (_label, frontmatter) => {
    // Given / When
    const findings = checkFrontmatterSchema(frontmatter as Record<string, unknown>);

    // Then
    expect(findings).toEqual([]);
  });

  test("[negative] 必須フィールドの欠落を両方報告する", () => {
    // Given / When
    const findings = checkFrontmatterSchema({});

    // Then
    expect(codesOf(findings).sort()).toEqual(["description-missing", "name-missing"]);
  });

  test.each([
    ["[negative] 空文字列の名前", { ...VALID, name: "" }, ["name-not-string"]],
    ["[negative] 文字列でない名前", { ...VALID, name: 42 }, ["name-not-string"]],
    [
      "[negative] 上限を超える名前",
      { ...VALID, name: "a".repeat(MAX_NAME_LENGTH + 1) },
      ["name-too-long"],
    ],
    ["[negative] 大文字を含む名前", { ...VALID, name: "Sample" }, ["name-invalid-chars"]],
    ["[negative] 全角文字の名前", { ...VALID, name: "サンプル" }, ["name-invalid-chars"]],
    [
      "[negative] アンダースコアを含む名前",
      { ...VALID, name: "sample_skill" },
      ["name-invalid-chars"],
    ],
    ["[negative] 空文字列の説明", { ...VALID, description: "" }, ["description-not-string"]],
    ["[negative] 空白のみの説明", { ...VALID, description: "   " }, ["description-not-string"]],
    [
      "[negative] 上限を超える説明",
      { ...VALID, description: "あ".repeat(MAX_DESCRIPTION_LENGTH + 1) },
      ["description-too-long"],
    ],
    [
      "[negative] 文字列でないcompatibility",
      { ...VALID, compatibility: ["git"] },
      ["compatibility-not-string"],
    ],
    [
      "[negative] 上限を超えるcompatibility",
      { ...VALID, compatibility: "a".repeat(MAX_COMPATIBILITY_LENGTH + 1) },
      ["compatibility-too-long"],
    ],
    [
      "[negative] マッピングでないmetadata",
      { ...VALID, metadata: "plain-string" },
      ["metadata-not-mapping"],
    ],
    [
      "[negative] 文字列でない値を持つmetadata",
      { ...VALID, metadata: { version: 1 } },
      ["metadata-not-string-map"],
    ],
  ])("%s を種別で報告する", (_label, frontmatter, expected) => {
    // Given / When
    const findings = checkFrontmatterSchema(frontmatter as Record<string, unknown>);

    // Then
    expect(codesOf(findings).sort()).toEqual(expected as string[]);
  });

  test("[negative] 文字数はUTF-16符号単位で数える", () => {
    // Given: 非BMP文字はコードポイント1つに対しUTF-16では2つを占める
    const description = "🧑".repeat((MAX_DESCRIPTION_LENGTH / 2) + 1);

    // When
    const findings = checkFrontmatterSchema({ ...VALID, description });

    // Then
    expect([...description].length).toBeLessThanOrEqual(MAX_DESCRIPTION_LENGTH);
    expect(codesOf(findings)).toEqual(["description-too-long"]);
  });

  test("[negative] 空の名前では文字種と長さの違反を重ねて報告しない", () => {
    // Given / When
    const findings = checkFrontmatterSchema({ ...VALID, name: "" });

    // Then
    expect(codesOf(findings)).toEqual(["name-not-string"]);
  });
});

describe("readSkillMd", () => {
  test("[positive] 読み込んだスキルを返す", () => {
    // Given
    const dir = workspace.makeSkillDir("sample-skill", { "SKILL.md": skillMdOf("sample-skill") });
    const location = loadSkillLocation(dir).unwrap();

    // When
    const result = readSkillMd(location);

    // Then
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().frontmatter.name).toBe("sample-skill");
    expect(result.unwrap().skillMdPath).toBe(join(dir, "SKILL.md"));
  });

  test("[negative] フロントマターを読めない場合は1件返す", () => {
    // Given
    const dir = workspace.makeSkillDir("sample-skill", { "SKILL.md": "本文のみ\n" });
    const location = loadSkillLocation(dir).unwrap();

    // When
    const result = readSkillMd(location);

    // Then
    expect(codesOf(result.unwrapErr())).toEqual(["frontmatter-missing"]);
  });

  test("[negative] スキーマ違反をまとめて返す", () => {
    // Given
    const dir = workspace.makeSkillDir("sample-skill", { "SKILL.md": "---\nlicense: MIT\n---\n" });
    const location = loadSkillLocation(dir).unwrap();

    // When
    const result = readSkillMd(location);

    // Then
    expect(codesOf(result.unwrapErr()).sort()).toEqual(["description-missing", "name-missing"]);
  });
});
