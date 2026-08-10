import type { Rule } from "../types.ts";

import { normalizedName } from "./skill-name.ts";

/** `name`がディレクトリ名と一致することを確かめる。 */
export const nameDirectoryMatchRule: Rule = (skill) => {
  const name = normalizedName(skill);
  if (skill.name.normalize("NFKC") === name) return [];

  return [{
    code: "name-dir-mismatch",
    source: "spec",
    level: "must",
    message: `\`name\`をディレクトリ名と同じにしてください（ディレクトリ名は\`${skill.name}\`、\`name\`は\`${name}\`）。`,
  }];
};
