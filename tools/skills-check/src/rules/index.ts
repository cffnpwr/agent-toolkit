import type { Rule } from "../types.ts";

import { bodyLineCountRule } from "./body-line-count.ts";
import { bodyTokenCountRule } from "./body-token-count.ts";
import { dependencyDeclarationRule } from "./dependency-declaration.ts";
import { extraFieldsRule } from "./extra-fields.ts";
import { nameDirectoryMatchRule } from "./name-directory-match.ts";
import { referenceDepthRule } from "./reference-depth.ts";

/** フロントマターの必須項目・型・文字数・書式は`skill-md.ts`のゲートが担う。 */
export const RULES: readonly Rule[] = [
  nameDirectoryMatchRule,
  extraFieldsRule,
  bodyLineCountRule,
  bodyTokenCountRule,
  referenceDepthRule,
  dependencyDeclarationRule,
];
