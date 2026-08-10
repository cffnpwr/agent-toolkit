import type { Rule } from "../types.ts";

/** Agent Skills仕様が定めるフロントマターフィールド。 */
export const SPEC_FIELDS: readonly string[] = [
  "name",
  "description",
  "license",
  "allowed-tools",
  "metadata",
  "compatibility",
];

/**
 * 仕様が定めていないフィールドの有無を確かめる。
 *
 * 仕様外フィールドの扱いは処理系ごとに異なる。拒否することが確認できているのは、
 * claude.aiへのアップロード・Skills API・anthropics/skillsの
 * skills/skill-creator/scripts/package_skill.pyの3経路
 * （`Unexpected key(s) in SKILL.md frontmatter`として拒否される）。
 * 出典: https://code.claude.com/docs/en/skills#using-skill-frontmatter-outside-claude-code
 * 他の処理系の挙動は未確認のため、メッセージでは処理系を限定しない。
 *
 * 仕様は列挙外のフィールドを禁じていないため`should`とする。
 */
export const extraFieldsRule: Rule = (skill) => {
  const extra = Object.keys(skill.frontmatter)
    .filter((key) => !SPEC_FIELDS.includes(key))
    .sort();
  if (extra.length === 0) return [];

  return [{
    code: "extra-fields",
    source: "spec",
    level: "should",
    message:
      `仕様が定めていないフィールドがあります: ${extra.join(", ")}。`
      + "受け入れるかは処理系ごとに異なり、拒否する配布経路があります。",
  }];
};
