import type { Rule } from "../types.ts";

import { normalizedName } from "./skill-name.ts";

/** `name`にハイフンが連続しないことを確かめる。 */
export const nameConsecutiveHyphensRule: Rule = (skill) => {
  if (!normalizedName(skill).includes("--")) return [];

  return [{
    code: "name-consecutive-hyphens",
    source: "spec",
    level: "must",
    message: "`name`のハイフンを連続させないでください。",
  }];
};
