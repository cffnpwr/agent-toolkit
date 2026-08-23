import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import type { TempWorkspace } from "./test-fixtures.ts";

import { loadSkillLocation, skillNameOf } from "./loader.ts";
import { createTempWorkspace, skillMdOf } from "./test-fixtures.ts";

let workspace: TempWorkspace;

beforeEach(() => {
  workspace = createTempWorkspace();
});

afterEach(() => {
  workspace.cleanup();
});

describe("skillNameOf", () => {
  test.each([
    ["[positive] 絶対パスを渡すとディレクトリ名を取る", "/a/b/sample-skill", "sample-skill"],
    ["[positive] 末尾にスラッシュがあってもディレクトリ名を取る", "/a/b/sample-skill/", "sample-skill"],
  ])("%s", (_label, input, expected) => {
    // Given / When / Then
    expect(skillNameOf(input)).toBe(expected);
  });
});

describe("loadSkillLocation", () => {
  test("[positive] 有効なスキルディレクトリを渡すとスキルの位置を返す", () => {
    // Given
    const dir = workspace.makeSkillDir("sample-skill", { "SKILL.md": skillMdOf("sample-skill") });

    // When
    const result = loadSkillLocation(dir);

    // Then
    expect(result.isOk()).toBeTrue();
    const value = result.unwrap();
    expect(value).toEqual({
      name: "sample-skill",
      dir,
      skillMdPath: join(dir, "SKILL.md"),
    });
  });

  test("[positive] 相対パスを渡すと絶対パスに解決したdirを返す", () => {
    // Given
    workspace.makeSkillDir("sample-skill", { "SKILL.md": skillMdOf("sample-skill") });
    const previousCwd = process.cwd();
    process.chdir(workspace.root);

    // When
    const result = loadSkillLocation("./sample-skill");
    process.chdir(previousCwd);

    // Then
    expect(result.isOk()).toBeTrue();
    const value = result.unwrap();
    expect(value.dir.startsWith("/")).toBe(true);
  });

  test("[negative] ディレクトリでないパスを渡すとnot-a-directoryエラーをパスとともに返す", () => {
    // Given
    const path = join(workspace.root, "not-a-dir");
    writeFileSync(path, "", "utf8");

    // When
    const result = loadSkillLocation(path);

    // Then
    expect(result.isErr()).toBeTrue();
    const value = result.unwrapErr();
    expect(value).toMatchObject({ code: "not-a-directory", source: "spec", level: "must" });
    expect(value.message).toContain(path);
  });

  test("[negative] 存在しないパスを渡すとnot-a-directoryエラーを返す", () => {
    // Given / When
    const result = loadSkillLocation(join(workspace.root, "missing"));

    // Then
    expect(result.isErr()).toBeTrue();
    const value = result.unwrapErr();
    expect(value).toMatchObject({ code: "not-a-directory", source: "spec", level: "must" });
  });

  test("[negative] SKILL.mdがないディレクトリを渡すとmissing-skill-mdエラーをパスとともに返す", () => {
    // Given
    const dir = workspace.makeSkillDir("sample-skill", {});

    // When
    const result = loadSkillLocation(dir);

    // Then
    expect(result.isErr()).toBeTrue();
    const value = result.unwrapErr();
    expect(value).toMatchObject({ code: "missing-skill-md", source: "spec", level: "must" });
    expect(value.message).toContain(dir);
  });
});
