import type { DoubleQuotedChild, Word, WordPart } from "unbash";

import { parse } from "unbash";

import type { Cwd } from "../../shared/src/cdfold.ts";

import type { Target } from "./types.ts";

import { foldCwd } from "../../shared/src/cdfold.ts";

// 値を取る(次の語を消費する)フラグ。
// 値をサブコマンドやメッセージフラグと誤認しないために列挙する。
const VALUE_FLAGS = new Set([
  "-m",
  "--message",
  "-r",
  "--revision",
  "-R",
  "--repository",
  "--tool",
  "--author",
  "--at-operation",
  "--at-op",
  "--config",
  "--config-file",
  "--color",
]);

// -m/--message でコミット説明を設定するサブコマンド(既定エイリアスを含む)。
// jj 0.43の各サブコマンドヘルプで、-m/--messageが説明を設定することを確認済み。
const MESSAGE_SUBCOMMANDS = new Set([
  "describe",
  "desc",
  "commit",
  "ci",
  "new",
  "split",
  "squash",
  "metaedit",
]);

// Wordの構成要素を静的に解決する。展開(変数・コマンド置換・グロブ等)を含めばnull。
const resolvePart = (part: DoubleQuotedChild | WordPart): string | null => {
  switch (part.type) {
    case "Literal":
    case "SingleQuoted":
    case "AnsiCQuoted":
      return part.value;
    case "DoubleQuoted":
    case "LocaleString": {
      let out = "";
      for (const child of part.parts) {
        const v = resolvePart(child);
        if (v === null) return null;
        out += v;
      }
      return out;
    }
    default:
      return null;
  }
};

// Wordを静的に解決する。実行時の環境に依存する要素を含めばnull。
// cdfoldのexpandWordと異なり変数環境を参照しない。
// メッセージはlint結果を左右するため、hookプロセスの環境で推測せず実行時要素は解決不能に倒す。
const resolveStatic = (word: Word): string | null => {
  if (word.parts === undefined) return word.value;
  let out = "";
  for (const part of word.parts) {
    const v = resolvePart(part);
    if (v === null) return null;
    out += v;
  }
  return out;
};

/**
 * コマンド文字列をパースし、simple commandごとに説明を設定するjj呼び出しを抽出して
 * lint対象メッセージ(-m/--message値)と有効CWDを解決する。
 * -mが複数あるときはjjの適用挙動(空行連結)に合わせ"\n\n"でjoinする。
 * メッセージを静的に特定できない呼び出し(-m無し・--stdin・展開を含む値)はmessage: nullとする。
 * 有効CWDはコマンド内のcd移動を畳み込んで解決する(cdfold参照)。null=不明。
 */
export const parseTargets = (command: string, baseCwd: Cwd): Target[] => {
  const targets: Target[] = [];
  foldCwd(parse(command).commands, baseCwd, (cmd, cwd) => {
    // コマンド名がjjバイナリ(jj または .../jj)の呼び出しだけを対象にする。
    const head = cmd.name?.value;
    if (head === undefined) return;
    if (head !== "jj" && !head.endsWith("/jj")) return;

    const seg = cmd.suffix.map((word) => word.value);
    // jjの後ろで最初に現れる非グローバルフラグをサブコマンドとみなす。
    let subIdx = -1;
    for (let k = 0; k < seg.length; k++) {
      const t = seg[k];
      if (t === undefined) continue;
      if (t.startsWith("-")) {
        if (VALUE_FLAGS.has(t)) k++;
        continue;
      }
      subIdx = k;
      break;
    }
    if (subIdx < 0) return;
    const sub = seg[subIdx];
    if (sub === undefined || !MESSAGE_SUBCOMMANDS.has(sub)) return;

    // -m/--message値を出現順に集める。1つでも静的に解決できなければ
    // 連結後のメッセージ全体が確定しないため、呼び出しごとlint対象外にする。
    const values: string[] = [];
    let unresolved = false;
    for (let k = subIdx + 1; k < seg.length; k++) {
      const t = seg[k];
      const word = cmd.suffix[k];
      if (t === undefined || word === undefined) continue;
      if (t === "-m" || t === "--message") {
        const next = cmd.suffix[k + 1];
        if (next === undefined) continue;
        k++;
        const v = resolveStatic(next);
        if (v === null) {
          unresolved = true;
          break;
        }
        values.push(v);
      } else if (t.startsWith("--message=")) {
        const v = resolveStatic(word);
        if (v === null) {
          unresolved = true;
          break;
        }
        values.push(v.slice("--message=".length));
      } else if (t.startsWith("-m") && !t.startsWith("--")) {
        // 密着形-mVALUE / -m=VALUEに対応する。
        const v = resolveStatic(word);
        if (v === null) {
          unresolved = true;
          break;
        }
        const rest = v.slice(2);
        values.push(rest.startsWith("=") ? rest.slice(1) : rest);
      } else if (t === "--stdin") {
        // メッセージがstdin由来になり静的に特定できない。
        unresolved = true;
        break;
      } else if (t.startsWith("-") && VALUE_FLAGS.has(t)) {
        k++;
      }
    }
    const message = unresolved || values.length === 0 ? null : values.join("\n\n");
    targets.push({ message, cwd });
  });
  return targets;
};
