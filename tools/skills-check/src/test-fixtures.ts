import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Finding, Skill } from "./types.ts";

/** テストで使う妥当な`description`。 */
export const VALID_DESCRIPTION = "何をするスキルで、いつ使うかを述べる説明。";

/** `Finding`の配列から種別だけを取り出す。 */
export const codesOf = (findings: readonly Finding[]): string[] => findings.map((finding) => finding.code);

/**
 * ファイルを持たないスキルを組み立てる。
 * ファイルシステムを見ないルールの検査に使う。
 */
export const skillOf = (overrides: Partial<Skill> = {}): Skill => ({
  name: "sample-skill",
  dir: "/nowhere/sample-skill",
  skillMdPath: "/nowhere/sample-skill/SKILL.md",
  content: "本文\n",
  frontmatter: { name: "sample-skill", description: VALID_DESCRIPTION },
  ...overrides,
});

/** フロントマターを組み立てて`SKILL.md`の内容にする。 */
export const skillMdOf = (name: string, body = "本文\n"): string => `---\nname: ${name}\ndescription: ${VALID_DESCRIPTION}\n---\n\n${body}`;

/** テストごとに使い捨てるディレクトリ。 */
export type TempWorkspace = {
  /** ディレクトリの絶対パス。 */
  readonly root: string;
  /** スキルディレクトリを作り、その絶対パスを返す。 */
  readonly makeSkillDir: (name: string, files: Record<string, string>) => string;
  /** ルールへ渡せる形のスキルを作る。 */
  readonly makeSkill: (name: string, files: Record<string, string>) => Skill;
  /** 後始末をする。 */
  readonly cleanup: () => void;
};

/** 使い捨てのディレクトリを用意する。 */
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
