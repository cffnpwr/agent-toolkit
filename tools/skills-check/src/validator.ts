import type { Finding, Rule, Skill } from "./types.ts";

import { RULES } from "./rules/index.ts";

export const validate = (skill: Skill, rules: readonly Rule[] = RULES): Finding[] => rules.flatMap((rule) => rule(skill));
