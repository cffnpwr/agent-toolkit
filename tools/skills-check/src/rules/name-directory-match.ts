import type { Rule, Skill } from "../types.ts";

/**
 * フロントマターの`name`をNFKC正規化して返す。
 * ルールが受け取るスキルはスキーマ検査を通っているため、`name`は空でない文字列である。
 */
const normalizedName = (skill: Skill): string => String(skill.frontmatter.name).normalize("NFKC");

/** `name`がディレクトリ名と一致することを確かめる。 */
export const nameDirectoryMatchRule: Rule = (skill) => {
  const name = normalizedName(skill);
  if (skill.name.normalize("NFKC") === name) return [];

  return [{
    code: "name-dir-mismatch",
    source: "spec",
    level: "must",
    message: `\`name\`をディレクトリ名と同じにしてください（ディレクトリ名は\`${skill.name}\`、\`name\`は\`${name}\`）。`,
  }];
};
