import type { Rule } from "../types.ts";

import { normalizedName } from "./skill-name.ts";

/** `name`の先頭と末尾がハイフンでないことを確かめる。 */
export const nameHyphenBoundaryRule: Rule = (skill) => {
  const name = normalizedName(skill);
  if (!name.startsWith("-") && !name.endsWith("-")) return [];

  return [{
    code: "name-hyphen-boundary",
    source: "spec",
    level: "must",
    message: "`name`の先頭と末尾をハイフン以外にしてください。",
  }];
};
