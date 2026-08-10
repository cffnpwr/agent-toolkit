import { encode } from "gpt-tokenizer/model/gpt-4o";

import type { Rule } from "../types.ts";

const RECOMMENDED_MAX_TOKENS = 5000;

/** Agent Skills仕様はベンダ中立でトークナイザを規定していないため、この数値は近似である。 */
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
