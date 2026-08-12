import type { Rule } from "../types.ts";

import { declaredSchema } from "../skill-md.ts";

/** `declaredSchema`はインデックスシグネチャを持たないため、`props`は宣言済みキーだけを返す。 */
export const SPEC_FIELDS: readonly string[] = declaredSchema.props.map((prop) => prop.key);

/**
 * 仕様外フィールドの扱いは処理系ごとに異なる。拒否することが確認できているのは、
 * claude.aiへのアップロード・Skills API・anthropics/skillsの
 * skills/skill-creator/scripts/package_skill.pyの3経路
 * （`Unexpected key(s) in SKILL.md frontmatter`として拒否される）。
 * 出典: https://code.claude.com/docs/en/skills#using-skill-frontmatter-outside-claude-code
 *
 * 一方、次の2処理系は仕様外フィールドを拒否せず黙って無視することが確認できている。
 * - OpenAI Codex: `SkillFrontmatter`に`deny_unknown_fields`を付けておらず、
 *   `name`・`description`・`metadata.short-description`だけを読む。
 *   出典: https://github.com/openai/codex/blob/d109393270432531ac0010542ae7973801e0d9d7/codex-rs/skills/src/parser.rs#L6-L20
 * - opencode: `Frontmatter`をEffectの`Schema.Struct`として定義し
 *   `Schema.decodeUnknownOption`で読む。既定の`onExcessProperty`が`"ignore"`
 *   のため追加プロパティは捨てられる（opencode自身も仕様外の`slash`フィールドを
 *   読んでいる）。
 *   出典: https://github.com/anomalyco/opencode/blob/550d1ffd24718454925c4636e937878f0274de48/packages/core/src/skill.ts#L33-L38、
 *   https://effect.website/docs/schema/getting-started/
 *
 * 拒否する経路と無視する経路の両方があるため、メッセージでは処理系を限定しない。
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
      + "受け入れるかは処理系ごとに異なり拒否する配布経路があるため、仕様が定めるフィールドのみを使用することが推奨されます。",
  }];
};
