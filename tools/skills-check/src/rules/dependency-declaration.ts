import type { Rule } from "../types.ts";

const REQUIREMENTS_PATTERN = /^ {0,3}##[ \t]+Requirements(?:[ \t]+#+)?[ \t]*$/m;

/**
 * フロントマターの`compatibility`フィールドと本文の`## Requirements`節は、
 * 実行環境の前提条件を宣言する2箇所であり、同時に使う必要がある。
 */
export const dependencyDeclarationRule: Rule = (skill) => {
  const hasCompatibility = "compatibility" in skill.frontmatter;
  const hasRequirements = REQUIREMENTS_PATTERN.test(skill.content);

  if (hasCompatibility === hasRequirements) return [];

  return [{
    code: "dependency-declaration-mismatch",
    source: "repo",
    level: "must",
    message: "`## Requirements`節とフロントマターの`compatibility`フィールドは同時に使用する必要があります。",
  }];
};
