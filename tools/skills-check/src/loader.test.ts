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
    ["[positive] 絶対パス", "/a/b/sample-skill", "sample-skill"],
    ["[positive] 末尾のスラッシュ", "/a/b/sample-skill/", "sample-skill"],
  ])("%s からディレクトリ名を取る", (_label, input, expected) => {
    // Given / When / Then
    expect(skillNameOf(input)).toBe(expected);
  });
});

describe("loadSkillLocation", () => {
  test("[positive] スキルの位置を返す", () => {
    // Given
    const dir = workspace.makeSkillDir("sample-skill", { "SKILL.md": skillMdOf("sample-skill") });

    // When
    const result = loadSkillLocation(dir);

    // Then
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual({
      name: "sample-skill",
      dir,
      skillMdPath: join(dir, "SKILL.md"),
    });
  });

  test("[positive] 相対パスを絶対パスへ寄せる", () => {
    // Given
    workspace.makeSkillDir("sample-skill", { "SKILL.md": skillMdOf("sample-skill") });
    const previousCwd = process.cwd();
    process.chdir(workspace.root);

    // When
    const result = loadSkillLocation("./sample-skill");
    process.chdir(previousCwd);

    // Then
    expect(result.unwrap().dir.startsWith("/")).toBe(true);
  });

  test("[negative] ディレクトリでないパス", () => {
    // Given
    const path = join(workspace.root, "not-a-dir");
    writeFileSync(path, "", "utf8");

    // When
    const result = loadSkillLocation(path);

    // Then
    expect(result.unwrapErr().code).toBe("not-a-directory");
    expect(result.unwrapErr().level).toBe("must");
  });

  test("[negative] 存在しないパス", () => {
    // Given / When
    const result = loadSkillLocation(join(workspace.root, "missing"));

    // Then
    expect(result.unwrapErr().code).toBe("not-a-directory");
  });

  test("[negative] SKILL.mdがないディレクトリ", () => {
    // Given
    const dir = workspace.makeSkillDir("sample-skill", {});

    // When
    const result = loadSkillLocation(dir);

    // Then
    expect(result.unwrapErr().code).toBe("missing-skill-md");
  });
});
