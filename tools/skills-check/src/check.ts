import { readdirSync } from "node:fs";
import { join } from "node:path";

import type { Problem } from "./types.ts";

import { loadSkillLocation, skillNameOf } from "./loader.ts";
import { readSkillMd } from "./skill-md.ts";
import { validate } from "./validator.ts";

export const checkSkill = (inputDir: string): Problem[] => {
  const skillName = skillNameOf(inputDir);

  const location = loadSkillLocation(inputDir);
  if (location.isErr()) return [{ skillName, ...location.unwrapErr() }];

  const loaded = readSkillMd(location.unwrap());
  if (loaded.isErr()) return loaded.unwrapErr().map((finding) => ({ skillName, ...finding }));

  return validate(loaded.unwrap()).map((finding) => ({ skillName, ...finding }));
};

export const checkSkillsRoot = (root: string): Problem[] => readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()
  .flatMap((name) => checkSkill(join(root, name)));
