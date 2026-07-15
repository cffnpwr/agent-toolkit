// cd-foldテストの補助。unbashのparse結果から対象Node/Wordを取り出し、foldを走らせて採取列を返す。

import type { Command, Statement, Word } from "unbash";

import { parse } from "unbash";

import type { Collect, Cwd, Env } from "./types.ts";

import { foldSequence } from "./fold.ts";

// srcをパースしてStatement列(foldSequence/foldCwdの入力)を返す。
export const parseCommands = (src: string): Statement[] => parse(src).commands;

// 先頭Statementを返す(cdTarget等のNode入力に使う)。
export const firstStatement = (src: string): Statement => {
  const s = parse(src).commands[0];
  if (s === undefined) throw new Error(`no statement: ${src}`);
  return s;
};

// 先頭のsimple Commandを返す。simple commandでなければ投げる。
export const firstCommand = (src: string): Command => {
  const cmd = firstStatement(src).command;
  if (cmd.type !== "Command") throw new Error(`not a simple command: ${src}`);
  return cmd;
};

// `echo <token>` 形の先頭引数Wordを返す(expandWordの入力に使う)。
export const wordOf = (token: string): Word => {
  const w = firstCommand(`echo ${token}`).suffix[0];
  if (w === undefined) throw new Error(`no word: ${token}`);
  return w;
};

// 採取行: [コマンド名(無名はundefined), 有効CWD]。
export type CollectRow = [string | undefined, Cwd];

// srcをbaseCwd/envで畳み込み、collectされた行を実行順に返す。
export const collectFold = (src: string, baseCwd: Cwd, env: Env = new Map()): CollectRow[] => {
  const out: CollectRow[] = [];
  const collect: Collect = (cmd, cwd) => out.push([cmd.name?.value, cwd]);
  foldSequence(parseCommands(src), { cwd: baseCwd, env }, collect);
  return out;
};
