import type { frontmatterSchema } from "./skill-md.ts";

/**
 * 検査ルールの出自。
 *
 * - `spec`: [Agent Skills仕様](https://agentskills.io/specification)
 * - `repo`: 本リポジトリが定める追加規約
 */
export type Source = "repo" | "spec";

/**
 * 規範の強さ。出自とは独立した軸で、同じ出自の中に両方がある。
 *
 * - `must`: 必須。満たさないものは適合しない
 * - `should`: 推奨。満たさなくても適合する
 */
export type Level = "must" | "should";

export type Finding = {
  readonly code: string;
  readonly source: Source;
  readonly level: Level;
  readonly message: string;
};

export type Problem = Finding & {
  readonly skillName: string;
};

export type Skill = {
  readonly name: string;
  /** スキルディレクトリの絶対パス。 */
  readonly dir: string;
  /** `SKILL.md`の絶対パス。 */
  readonly skillMdPath: string;
  /** フロントマターを含む`SKILL.md`の全文。 */
  readonly content: string;
  readonly frontmatter: typeof frontmatterSchema.infer;
};

export type Rule = (skill: Skill) => Finding[];
