import { encode } from "gpt-tokenizer/model/gpt-4o";

import type { Rule } from "../types.ts";

const RECOMMENDED_MAX_TOKENS = 5000;

export const bodyTokenCountRule: Rule = (skill) => {
  // Agent Skills仕様はベンダ中立でトークナイザを規定していないため、この数値は近似値。
  const tokens = encode(skill.content).length;
  if (tokens <= RECOMMENDED_MAX_TOKENS) return [];

  return [{
    code: "body-too-many-tokens",
    source: "spec",
    level: "should",
    message: `\`SKILL.md\`は${RECOMMENDED_MAX_TOKENS}トークン以内に収めることが推奨されます（概算${tokens}トークン）。`,
  }];
};
