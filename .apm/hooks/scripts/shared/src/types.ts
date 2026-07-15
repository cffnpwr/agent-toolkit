// cd-foldエンジンが引き回すスコープ状態の型定義。

import type { Command } from "unbash";

// 有効CWD。null=静的に解決不能(不明)。
export type Cwd = string | null;

// 変数環境。値string=既知、値null=既知だが解決不能、キー不在=未定義。
export type Env = Map<string, string | null>;

// foldの引き回すスコープ状態。cwd(有効CWD)とenv(変数環境)を同一シェル内で共有する。
export interface State {
  cwd: Cwd;
  env: Env;
}

// simple commandごとに、その呼び出しが実行される有効CWDとともに呼ばれる。
// cmdはunbashのCommandノード(name/suffix/prefix/redirectsを持つ)。
export type Collect = (cmd: Command, cwd: Cwd) => void;

export const cloneEnv = (env: Env): Env => new Map(env);
export const cloneState = (s: State): State => ({ cwd: s.cwd, env: new Map(s.env) });
