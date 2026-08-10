import type { Rule } from "../types.ts";

const RECOMMENDED_MAX_LINES = 500;

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
