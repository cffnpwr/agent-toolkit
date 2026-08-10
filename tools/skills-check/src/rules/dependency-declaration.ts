import type { Rule } from "../types.ts";

const REQUIREMENTS_PATTERN = /^##[ \t]+Requirements[ \t]*$/m;

/**
 * 依存宣言の2か所の対応を確かめる。
 * `compatibility`フィールドと本文の`## Requirements`節は内容を一致させる
 * （docs/design-doc/skills.md）。ここでは機械的に照合できる
 * 「両方そろっているか、どちらもないか」だけを見る。
 */
export const dependencyDeclarationRule: Rule = (skill) => {
  const hasCompatibility = "compatibility" in skill.frontmatter;
  const hasRequirements = REQUIREMENTS_PATTERN.test(skill.content);

  if (hasCompatibility && !hasRequirements) {
    return [{
      code: "compatibility-without-requirements",
      source: "repo",
      level: "must",
      message: "`compatibility`を宣言しているので、本文に`## Requirements`節を書いて内容を揃えてください。",
    }];
  }

  if (hasRequirements && !hasCompatibility) {
    return [{
      code: "requirements-without-compatibility",
      source: "repo",
      level: "must",
      message: "`## Requirements`節があるので、フロントマターに`compatibility`を書いて内容を揃えてください。",
    }];
  }

  return [];
};
