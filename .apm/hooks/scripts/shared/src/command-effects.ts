// simple commandがスコープ状態へ及ぼす効果を解決する。
// cd移動先の有効CWD算出と、変数代入(単独代入・export形)の環境反映を扱う。

import { resolve } from "node:path";

import type { AssignmentPrefix, Command, Node, Word } from "unbash";

import type { Cwd, Env, State } from "./types.ts";

import { expandWord, IDENT, lookupVar } from "./expand.ts";

// 変数代入を追跡する組み込みコマンド(export VAR=value 形)。
export const EXPORT_LIKE = new Set(["export", "declare", "local", "readonly", "typeset"]);

// ノードを(Statementを剥がして)Commandとして取り出す。cd判定用。
const asCommand = (node: Node): Command | undefined => {
  if (node.type === "Command") return node;
  if (node.type === "Statement" && node.command.type === "Command") return node.command;
  return undefined;
};

// ノードがcd呼び出しなら移動先の有効CWDを返す。cdでなければundefined。
// 解決不能な移動先(cd -・未定義変数・コマンド置換等)はtarget=null。
export const cdTarget = (node: Node, state: State): { target: Cwd; } | undefined => {
  const cmd = asCommand(node);
  if (cmd === undefined || cmd.name?.value !== "cd") return undefined;

  let targetWord: Word | undefined;
  let seenDDash = false;
  for (const w of cmd.suffix) {
    const v = w.value;
    if (!seenDDash) {
      if (v === "--") {
        seenDDash = true;
        continue;
      }
      // cdのオプション(-L/-P/-e/-@)と、未知のフラグ様の語(- 単独を除く)を読み飛ばす。
      if (v.startsWith("-") && v !== "-") continue;
    }
    targetWord = w;
    break;
  }

  if (targetWord === undefined) {
    // 引数無しのcd → HOME。
    return { target: lookupVar("HOME", state.env) };
  }
  if (!seenDDash && targetWord.value === "-") {
    // cd - はOLDPWD。追跡しないため不明。
    return { target: null };
  }
  const expanded = expandWord(targetWord, state.env);
  if (expanded === null) return { target: null };
  if (expanded === "") {
    // cd "" は無操作。CWDは変わらない。
    return { target: state.cwd };
  }
  if (expanded.startsWith("/")) return { target: resolve(expanded) };
  return { target: state.cwd === null ? null : resolve(state.cwd, expanded) };
};

// 単独代入 VAR=value(prefix)を現在のenvへ反映する。
export const applyPrefixAssign = (assign: AssignmentPrefix, env: Env): void => {
  const name = assign.name;
  if (name === undefined || !IDENT.test(name)) return;
  if (assign.array !== undefined) return; // 配列代入はパスに使わないため追跡しない
  if (assign.value === undefined) {
    env.set(name, "");
    return;
  }
  env.set(name, expandWord(assign.value, env));
};

// export VAR=value 形のsuffix語を現在のenvへ反映する。
export const applyExportAssign = (word: Word, env: Env): void => {
  const src = word.value;
  const eq = src.indexOf("=");
  if (eq <= 0) return;
  const name = src.slice(0, eq);
  if (!IDENT.test(name)) return;
  const expanded = expandWord(word, env);
  // 値側が解決不能なら「既知だが不明」として登録する。
  if (expanded === null) {
    env.set(name, null);
    return;
  }
  // 展開結果は "NAME=<値>"。変数名部はリテラルなので先頭のNAME=を落とす。
  env.set(name, expanded.slice(name.length + 1));
};
