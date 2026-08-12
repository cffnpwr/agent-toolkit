import type { Rule, Skill } from "../types.ts";

const normalizedName = (skill: Skill): string => skill.frontmatter.name.normalize("NFKC");

export const nameDirectoryMatchRule: Rule = (skill) => {
  const name = normalizedName(skill);
  if (skill.name.normalize("NFKC") === name) return [];

  return [{
    code: "name-dir-mismatch",
    source: "spec",
    level: "must",
    message: `\`name\`はディレクトリ名と同じである必要があります（ディレクトリ名は\`${skill.name}\`、\`name\`は\`${name}\`）。`,
  }];
};
