import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import type { TempWorkspace } from "./test-fixtures.ts";

import { checkSkill, checkSkillsRoot } from "./check.ts";
import { createTempWorkspace, skillMdOf, VALID_DESCRIPTION } from "./test-fixtures.ts";

let workspace: TempWorkspace;

beforeEach(() => {
  workspace = createTempWorkspace();
});

afterEach(() => {
  workspace.cleanup();
});

describe("checkSkill", () => {
  test("[positive] 仕様と規約を満たすスキルは問題を返さない", () => {
    // Given
    const dir = workspace.makeSkillDir("sample-skill", { "SKILL.md": skillMdOf("sample-skill") });

    // When
    const problems = checkSkill(dir);

    // Then
    expect(problems).toEqual([]);
  });

  test("[negative] ファイル構成の問題で打ち切り、ルールを実行しない", () => {
    // Given: SKILL.md が無いので、後続のルールは実行できない
    const dir = workspace.makeSkillDir("sample-skill", {});

    // When
    const problems = checkSkill(dir);

    // Then
    expect(problems).toEqual([
      {
        skill: "sample-skill",
        code: "missing-skill-md",
        source: "spec",
        level: "must",
        message: problems[0]?.message ?? "",
      },
    ]);
  });

  test("[negative] スキーマ違反で打ち切り、ルールを実行しない", () => {
    // Given: name が無いので、name に関するルールは判定できない
    const content = `---\ndescription: ${VALID_DESCRIPTION}\nextra: 1\n---\n\n本文\n`;
    const dir = workspace.makeSkillDir("sample-skill", { "SKILL.md": content });

    // When
    const problems = checkSkill(dir);

    // Then: extra-fields は後続のルールなので報告されない
    expect(problems.map((problem) => problem.code)).toEqual(["name-missing"]);
  });

  test("[negative] 複数のルールの結果をまとめて返す", () => {
    // Given
    const content = `---\nname: other--name\ndescription: ${VALID_DESCRIPTION}\nextra: 1\n---\n\n本文\n`;
    const dir = workspace.makeSkillDir("sample-skill", { "SKILL.md": content });

    // When
    const problems = checkSkill(dir);

    // Then
    expect(problems.map((problem) => problem.code).sort()).toEqual([
      "extra-fields",
      "name-consecutive-hyphens",
      "name-dir-mismatch",
    ]);
  });

  test("[negative] 問題にスキル名を付けて返す", () => {
    // Given
    const dir = workspace.makeSkillDir("sample-skill", { "SKILL.md": skillMdOf("other-name") });

    // When
    const problems = checkSkill(dir);

    // Then
    expect(problems.every((problem) => problem.skill === "sample-skill")).toBe(true);
  });
});

describe("checkSkillsRoot", () => {
  test("[positive] 配下の各スキルを検査し、ディレクトリ以外を無視する", () => {
    // Given
    workspace.makeSkillDir("valid-skill", { "SKILL.md": skillMdOf("valid-skill") });
    workspace.makeSkillDir("broken-skill", { "SKILL.md": skillMdOf("mismatched") });
    writeFileSync(join(workspace.root, "loose-file.md"), "無視される\n", "utf8");

    // When
    const problems = checkSkillsRoot(workspace.root);

    // Then
    expect(problems.map((problem) => [problem.skill, problem.code])).toEqual([
      ["broken-skill", "name-dir-mismatch"],
    ]);
  });
});
