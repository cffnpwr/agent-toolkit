// コマンド文字列内のcdによる有効CWD移動を解決する共通エンジン(cd-fold)の公開API。
//
// 各hookはunbashでパースしたAST(parse(command).commands)を渡し、collectコールバックで
// simple commandごとに「その呼び出しが実際に実行される有効CWD」を受け取る。
// unbashのランタイム依存(parse)は各hook側に残し、ここは型のみ(import type、実行時に消える)を使う。
// これによりnode_modulesを持たないsharedでも解決できる(tscの型解決は各hook tsconfigのpathsで補う)。

import type { Statement } from "unbash";

import type { Collect, Cwd, Env } from "./types.ts";

import { foldSequence } from "./fold.ts";

export type { Collect, Cwd } from "./types.ts";

/**
 * パース済みのStatement列(parse(command).commands)を実行順に走査し、
 * 各simple commandをその有効CWDとともにcollectへ渡す。
 * baseCwdはコマンド先頭のcd実行前の基準CWD(null不可の通常呼び出しではstring)。
 */
export const foldCwd = (commands: Statement[], baseCwd: Cwd, collect: Collect): void => {
  const env: Env = new Map();
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string") env.set(k, v);
  }
  foldSequence(commands, { cwd: baseCwd, env }, collect);
};

/**
 * hook起動時の基準CWDを解決する。input.cwd → CLAUDE_PROJECT_DIR → process.cwd() の順。
 */
export const resolveBaseCwd = (inputCwd: unknown): string => {
  if (typeof inputCwd === "string" && inputCwd.length > 0) return inputCwd;
  const projectDir = process.env.CLAUDE_PROJECT_DIR;
  if (typeof projectDir === "string" && projectDir.length > 0) return projectDir;
  return process.cwd();
};
