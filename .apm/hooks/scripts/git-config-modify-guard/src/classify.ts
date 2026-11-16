import type { DoubleQuotedChild, Word, WordPart } from "unbash";

import type { ConfigEffect, ConfigOptionSpec } from "./options.ts";

import { expandWord } from "../../shared/src/expand.ts";
import { scanOptions } from "../../shared/src/git/parse-options.ts";

import { LEGACY_OPTIONS, SUBCOMMAND_EFFECTS } from "./options.ts";

const GLOB_CHARS = /[*?[]/;

// 位置引数がこの個数のとき、gitは値の設定として扱う
const IMPLICIT_SET_ARG_COUNTS = new Set([2, 3]);

// unknownは書き込むかを静的に決められない呼び出し
export type ConfigClassification = ConfigEffect | "unknown";

// ダブルクォート内で複数の語に分かれる"$@"・"${a[@]}"
const isSplittingChild = (child: DoubleQuotedChild): boolean => {
  switch (child.type) {
    case "SimpleExpansion":
      return child.text === "$@";
    case "ParameterExpansion":
      return child.parameter === "@" || child.index === "@";
    case "Literal":
    case "CommandExpansion":
    case "ArithmeticExpansion":
      return false;
  }
};

const isSingleFieldPart = (part: WordPart): boolean => {
  switch (part.type) {
    case "Literal":
      return !GLOB_CHARS.test(part.value);
    case "SingleQuoted":
    case "AnsiCQuoted":
      return true;
    case "DoubleQuoted":
    case "LocaleString":
      return !part.parts.some(isSplittingChild);
    case "SimpleExpansion":
    case "ParameterExpansion":
    case "CommandExpansion":
    case "ArithmeticExpansion":
    case "ProcessSubstitution":
    case "ExtendedGlob":
    case "BraceExpansion":
      return false;
  }
};

// 展開後の値が静的に決まらなくても、単語分割で1語のままになる語か
export const isSingleField = (word: Word): boolean => word.parts === undefined
  || word.parts.every(isSingleFieldPart);

const classifyLegacy = (words: readonly Word[]): ConfigClassification => {
  const args = words.map((word) => expandWord(word, new Map()));
  let selectedMode: ConfigOptionSpec | undefined;
  let positionalCount = 0;
  for (const scanned of scanOptions(args, LEGACY_OPTIONS, "stop-at-non-option")) {
    switch (scanned.type) {
      case "unresolved":
      case "unknown-option":
        return "unknown";
      case "positional": {
        const word = words[scanned.index];
        const isUnresolved = args[scanned.index] === null;
        if (isUnresolved && word !== undefined && !isSingleField(word)) {
          return "unknown";
        }
        positionalCount++;
        break;
      }
      case "option":
        if (scanned.spec.mode === undefined) {
          break;
        }
        // gitは異なる動作モードの併用をエラーにする
        if (selectedMode !== undefined && selectedMode !== scanned.spec) {
          return "no-write";
        }
        selectedMode = scanned.spec;
        break;
    }
  }

  if (selectedMode?.mode !== undefined) {
    return selectedMode.mode;
  }

  return IMPLICIT_SET_ARG_COUNTS.has(positionalCount) ? "writes" : "no-write";
};

// wordsは`git config`に続く語
export const classifyConfigArgs = (
  words: readonly Word[],
): ConfigClassification => {
  const first = words[0];
  if (first === undefined) {
    return "no-write";
  }
  const subcommand = expandWord(first, new Map());
  if (subcommand === null) {
    return "unknown";
  }

  return SUBCOMMAND_EFFECTS.get(subcommand) ?? classifyLegacy(words);
};
