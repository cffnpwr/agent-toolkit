import { readdirSync } from "node:fs";
import { join } from "node:path";

import type { Problem } from "./types.ts";

import { loadSkillLocation, skillNameOf } from "./loader.ts";
import { readSkillMd } from "./skill-md.ts";
import { validate } from "./validator.ts";

/**
 * スキルディレクトリ1つを検査する。
 *
 * 1. ファイル構成を確かめる（`loader.ts`）
 * 2. `SKILL.md`を読み、フロントマターのスキーマを確かめる（`skill-md.ts`）
 * 3. 残りのルールを実行する（`validator.ts`）
 *
 * 1と2はゲートで、失敗したらそこで打ち切る。
 */
export const checkSkill = (inputDir: string): Problem[] => {
  const skill = skillNameOf(inputDir);

  const location = loadSkillLocation(inputDir);
  if (location.isErr()) return [{ skill, ...location.unwrapErr() }];

  const loaded = readSkillMd(location.unwrap());
  if (loaded.isErr()) return loaded.unwrapErr().map((finding) => ({ skill, ...finding }));

  return validate(loaded.unwrap()).map((finding) => ({ skill, ...finding }));
};

/** スキルを収めたディレクトリ配下の各スキルを検査する。 */
export const checkSkillsRoot = (root: string): Problem[] => readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()
  .flatMap((name) => checkSkill(join(root, name)));
