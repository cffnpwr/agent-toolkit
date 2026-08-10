/**
 * 検査ルールの出自。
 *
 * - `spec`: [Agent Skills仕様](https://agentskills.io/specification)
 * - `repo`: 本リポジトリのdesign doc
 */
export type Source = "repo" | "spec";

/**
 * 規範の強さ。出自とは独立した軸で、同じ出自の中に両方がある。
 *
 * - `must`: 満たさないものは適合しない
 * - `should`: 推奨。満たさなくても適合する
 */
export type Level = "must" | "should";

/** 出力上の重大度。`level`から導出する。 */
export type Severity = "error" | "warning";

export const severityOf = (level: Level): Severity => (level === "must" ? "error" : "warning");

/** 検出した問題。種別と、その出自・規範の強さを報告側が持つ。 */
export type Finding = {
  readonly code: string;
  readonly source: Source;
  readonly level: Level;
  readonly message: string;
};

/** どのスキルで検出したかを伴う問題。 */
export type Problem = Finding & {
  readonly skill: string;
};

/** 読み込みとスキーマ検査を通ったスキル。ルールはこれだけを受け取る。 */
export type Skill = {
  /** スキル名。ディレクトリ名から取る。 */
  readonly name: string;
  /** スキルディレクトリの絶対パス。 */
  readonly dir: string;
  /** `SKILL.md`の絶対パス。 */
  readonly skillMdPath: string;
  /** `SKILL.md`の全文。 */
  readonly content: string;
  /** 解析済みのフロントマター。 */
  readonly frontmatter: Record<string, unknown>;
};

/** ルール。スキルを受け取り、見つけた問題を返す。 */
export type Rule = (skill: Skill) => Finding[];
