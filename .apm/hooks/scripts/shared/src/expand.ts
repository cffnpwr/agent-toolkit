// Word(コマンド語)を現在の変数環境で展開する。解決不能な要素を含めばnullを返す。

import type { DoubleQuotedChild, Word, WordPart } from "unbash";

import type { Env } from "./types.ts";

// シェルの変数名(識別子)。特殊パラメータ($1・$?等)は解決対象外。
export const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

// 未設定/空時に既定値を採るパラメータ展開の演算子。
const DEFAULT_OPS = new Set([":-", "-", ":=", "="]);

// 変数名を現在のenvで引く。未定義・解決不能・特殊パラメータはnull。
export const lookupVar = (name: string, env: Env): string | null => {
  if (!IDENT.test(name)) return null;
  const v = env.get(name);
  return typeof v === "string" ? v : null;
};

// Wordのpart列を展開して連結する。解決不能なpartを含めばnull。
const expandParts = (
  parts: readonly (DoubleQuotedChild | WordPart)[],
  env: Env,
): string | null => {
  let out = "";
  for (const part of parts) {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define -- expandPartとの相互再帰。実行時呼び出しで全束縛が初期化済みのため未定義参照は起きない
    const piece = expandPart(part, env);
    if (piece === null) return null;
    out += piece;
  }
  return out;
};

// 単一partを展開する。解決不能(コマンド置換・算術・グロブ・未定義変数等)はnull。
const expandPart = (part: DoubleQuotedChild | WordPart, env: Env): string | null => {
  switch (part.type) {
    case "Literal":
    case "SingleQuoted":
    case "AnsiCQuoted":
      return part.value;
    case "DoubleQuoted":
    case "LocaleString":
      return expandParts(part.parts, env);
    case "SimpleExpansion":
      // "$HOME"等。先頭の$を落として変数名にする。
      return lookupVar(part.text.slice(1), env);
    case "ParameterExpansion": {
      const name = part.parameter;
      if (!IDENT.test(name)) return null;
      const val = env.has(name) ? env.get(name) : undefined;
      const op = part.operator;
      if (op === undefined) {
        // ${VAR}
        return typeof val === "string" ? val : null;
      }
      if (DEFAULT_OPS.has(op)) {
        // ${VAR:-def}/${VAR-def}/${VAR:=def}/${VAR=def}
        if (val === null) return null; // 既知だが解決不能 → 既定値を選べない
        const colon = op.startsWith(":");
        if (val === undefined || (colon && val === "")) {
          // eslint-disable-next-line @typescript-eslint/no-use-before-define -- expandWordとの相互再帰。実行時呼び出しで全束縛が初期化済みのため未定義参照は起きない
          return part.operand ? expandWord(part.operand, env) : "";
        }
        return val;
      }
      // その他の演算子(:+・#・%・/等)は解決不能。
      return null;
    }
    case "CommandExpansion":
    case "ProcessSubstitution":
    case "ArithmeticExpansion":
    case "ExtendedGlob":
    case "BraceExpansion":
      return null;
    default: {
      const exhaustive: never = part;
      return exhaustive;
    }
  }
};

// 非クォートの先頭チルダを展開する。~/~/はHOME、~userは解決不能。
const expandTilde = (value: string, env: Env): string | null => {
  if (value === "~" || value.startsWith("~/")) {
    const home = lookupVar("HOME", env);
    if (home === null) return null;
    return value === "~" ? home : home + value.slice(1);
  }
  if (value.startsWith("~")) return null;
  return value;
};

// Wordを現在のenvで展開する。partsが無ければ純リテラル(先頭チルダのみ展開)。
export const expandWord = (word: Word, env: Env): string | null => {
  if (word.parts === undefined) return expandTilde(word.value, env);
  return expandParts(word.parts, env);
};
