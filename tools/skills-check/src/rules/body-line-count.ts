import type { Rule } from "../types.ts";

/** 仕様が推奨する`SKILL.md`の行数上限。 */
export const RECOMMENDED_MAX_LINES = 500;

/** `SKILL.md`が推奨の行数に収まることを確かめる。 */
export const bodyLineCountRule: Rule = (skill) => {
  const lines = skill.content.split("\n").length;
  if (lines <= RECOMMENDED_MAX_LINES) return [];

  return [{
    code: "body-too-many-lines",
    source: "spec",
    level: "should",
    message: `SKILL.mdを推奨の${RECOMMENDED_MAX_LINES}行以内にしてください（現在${lines}行）。`,
  }];
};
