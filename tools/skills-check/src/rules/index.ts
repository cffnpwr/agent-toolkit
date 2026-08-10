import type { Rule } from "../types.ts";

import { bodyLineCountRule } from "./body-line-count.ts";
import { bodyTokenCountRule } from "./body-token-count.ts";
import { dependencyDeclarationRule } from "./dependency-declaration.ts";
import { extraFieldsRule } from "./extra-fields.ts";
import { nameConsecutiveHyphensRule } from "./name-consecutive-hyphens.ts";
import { nameDirectoryMatchRule } from "./name-directory-match.ts";
import { nameHyphenBoundaryRule } from "./name-hyphen-boundary.ts";
import { referenceDepthRule } from "./reference-depth.ts";

/**
 * 読み込みとスキーマ検査を通ったスキルに対して実行するルール一覧。
 * フロントマターの必須項目・型・文字数は`skill-md.ts`のゲートが担う。
 */
export const RULES: readonly Rule[] = [
  nameHyphenBoundaryRule,
  nameConsecutiveHyphensRule,
  nameDirectoryMatchRule,
  extraFieldsRule,
  bodyLineCountRule,
  bodyTokenCountRule,
  referenceDepthRule,
  dependencyDeclarationRule,
];
