import type { Rule } from "../types.ts";

import { declaredSchema } from "../skill-md.ts";

/** `declaredSchema`はインデックスシグネチャを持たないため、`props`は宣言済みキーだけを返す。 */
export const SPEC_FIELDS: readonly string[] = declaredSchema.props.map((prop) => prop.key);

/**
 * 拒否する経路と無視する経路の両方があるため、メッセージでは処理系を限定しない。
 *
 * 仕様は列挙外のフィールドを禁じていないため`should`とする。
 */
export const extraFieldsRule: Rule = (skill) => {
  const extra = Object.keys(skill.frontmatter)
    .filter((key) => !SPEC_FIELDS.includes(key));
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
