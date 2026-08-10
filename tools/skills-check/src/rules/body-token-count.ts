import { encode } from "gpt-tokenizer/model/gpt-4o";

import type { Rule } from "../types.ts";

/** 仕様が推奨する`SKILL.md`本文のトークン数上限。 */
export const RECOMMENDED_MAX_TOKENS = 5000;

/**
 * `SKILL.md`が推奨のトークン数に収まることを確かめる。
 *
 * Claude 3以降のローカルトークナイザは提供されていないため、この数値は近似である。
 * 詳細は docs/design-doc/skills-check.md を参照。
 */
export const bodyTokenCountRule: Rule = (skill) => {
  const tokens = encode(skill.content).length;
  if (tokens <= RECOMMENDED_MAX_TOKENS) return [];

  return [{
    code: "body-too-many-tokens",
    source: "spec",
    level: "should",
    message: `SKILL.mdを推奨の${RECOMMENDED_MAX_TOKENS}トークン以内にしてください（概算${tokens}トークン）。`,
  }];
};
