import type { Command } from "unbash";

import { parse } from "unbash";

import type { Cwd } from "../../shared/cdfold.ts";

import type { GitCall } from "./types.ts";

import { foldCwd } from "../../shared/cdfold.ts";

// コマンド単位の一時バイパスに使うenv代入名。
const BYPASS_VAR = "PREFER_JJ_DISABLE";

// boolean環境変数の偽値。git-configのbooleanの偽値に合わせる(大文字小文字無視)。
// これらの値の代入ではバイパスしない。
const FALSE_VALUES = new Set(["", "0", "false", "no", "off"]);

// gitのグローバルフラグのうち、値を次の語で取るもの。
// 値をサブコマンドと誤認しないために列挙する(`--git-dir=<path>`等の=結合形は-始まりの語として自然に読み飛ばされる)。
const GIT_VALUE_FLAGS = new Set([
  "-C",
  "-c",
  "--git-dir",
  "--work-tree",
  "--namespace",
  "--config-env",
  "--attr-source",
]);

// 先頭env代入によるコマンド単位の一時バイパス(PREFER_JJ_DISABLE=1 git ...)を判定する。
// 偽値(空・0・false・no・off)の代入ではバイパスしない。
const hasBypassPrefix = (command: Command): boolean => command.prefix.some(
  (assign) => assign.name === BYPASS_VAR
    && !FALSE_VALUES.has((assign.value?.value ?? "").toLowerCase()),
);

/**
 * コマンド文字列をパースし、simple commandごとにgit呼び出しを抽出して
 * サブコマンド・後続引数・有効CWDを解決する。
 * 有効CWDはコマンド内のcd移動を畳み込んで解決する(cdfold参照)。null=不明。
 * 先頭env代入PREFER_JJ_DISABLE(偽値以外)が付くsimple commandは除外する。
 */
export const parseGitCalls = (command: string, baseCwd: Cwd): GitCall[] => {
  const calls: GitCall[] = [];
  foldCwd(parse(command).commands, baseCwd, (cmd, cwd) => {
    // コマンド名がgitバイナリ(git または .../git)の呼び出しだけを対象にする。
    const name = cmd.name?.value;
    if (name === undefined) return;
    if (name !== "git" && !name.endsWith("/git")) return;
    if (hasBypassPrefix(cmd)) return;

    // gitの後ろで最初に現れる非グローバルフラグをサブコマンドとみなす。
    const words = cmd.suffix.map((word) => word.value);
    let subIdx = -1;
    for (let k = 0; k < words.length; k++) {
      const t = words[k];
      if (t === undefined) continue;
      if (t.startsWith("-")) {
        if (GIT_VALUE_FLAGS.has(t)) k++;
        continue;
      }
      subIdx = k;
      break;
    }
    if (subIdx < 0) return;
    const subcommand = words[subIdx];
    if (subcommand === undefined) return;
    calls.push({ subcommand, args: words.slice(subIdx + 1), cwd });
  });
  return calls;
};
