import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import type { Result } from "@cffnpwr/result-ts";

import { Err, Ok } from "@cffnpwr/result-ts";

import type { Finding } from "./types.ts";

export type SkillLocation = {
  readonly name: string;
  readonly dir: string;
  readonly skillMdPath: string;
};

export const skillNameOf = (inputDir: string): string => {
  const dir = resolve(inputDir);

  return dir.split("/").filter(Boolean).at(-1) ?? dir;
};

export const loadSkillLocation = (inputDir: string): Result<SkillLocation, Finding> => {
  // 参照の照合で相対パスと絶対パスが混ざらないよう、入口で絶対パスへ寄せる。
  const dir = resolve(inputDir);

  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return Err({
      code: "not-a-directory",
      source: "spec",
      level: "must",
      message: `${dir}はディレクトリではありません。`,
    });
  }

  const skillMdPath = join(dir, "SKILL.md");
  if (!existsSync(skillMdPath)) {
    return Err({
      code: "missing-skill-md",
      source: "spec",
      level: "must",
      message: `${dir}内に\`SKILL.md\`が存在しません。`,
    });
  }

  return Ok({ name: skillNameOf(dir), dir, skillMdPath });
};
