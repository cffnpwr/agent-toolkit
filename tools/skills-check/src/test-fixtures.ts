import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { stringify as stringifyYaml } from "yaml";

import type { Skill } from "./types.ts";

export const VALID_DESCRIPTION = "何をするスキルで、いつ使うかを述べる説明。";

/** ファイルシステムを見ないルールの検査に使う。 */
export const skillOf = (overrides: Partial<Skill> = {}): Skill => ({
  name: "sample-skill",
  dir: "/nowhere/sample-skill",
  skillMdPath: "/nowhere/sample-skill/SKILL.md",
  content: "本文\n",
  frontmatter: { name: "sample-skill", description: VALID_DESCRIPTION },
  ...overrides,
});

/**
 * 値をYAMLの文字列に直接書き下す代わりに`yaml`パッケージでシリアライズし、
 * `parseFrontmatter`が読む形（パース結果）と対応させる。
 */
export const frontmatterYamlOf = (fields: Record<string, unknown>, body = "本文\n"): string => `---\n${stringifyYaml(fields)}---\n\n${body}`;

export const skillMdOf = (name: string, body = "本文\n"): string => frontmatterYamlOf({ name, description: VALID_DESCRIPTION }, body);

export type TempWorkspace = {
  /** 使い捨てディレクトリの絶対パス。 */
  readonly root: string;
  /** 作ったスキルディレクトリの絶対パスを返す。 */
  readonly makeSkillDir: (name: string, files: Record<string, string>) => string;
  readonly makeSkill: (name: string, files: Record<string, string>) => Skill;
  readonly cleanup: () => void;
};

export const createTempWorkspace = (): TempWorkspace => {
  const root = mkdtempSync(join(tmpdir(), "skills-check-"));

  const makeSkillDir = (name: string, files: Record<string, string>): string => {
    const dir = join(root, name);
    mkdirSync(dir, { recursive: true });
    for (const [relativePath, content] of Object.entries(files)) {
      const path = join(dir, relativePath);
      mkdirSync(join(path, ".."), { recursive: true });
      writeFileSync(path, content, "utf8");
    }

    return dir;
  };

  const makeSkill = (name: string, files: Record<string, string>): Skill => {
    const dir = makeSkillDir(name, files);

    return {
      name,
      dir,
      skillMdPath: join(dir, "SKILL.md"),
      content: files["SKILL.md"] ?? "",
      frontmatter: { name, description: VALID_DESCRIPTION },
    };
  };

  return {
    root,
    makeSkillDir,
    makeSkill,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
};
