import type { Command } from "unbash";

import { expandWord } from "../expand.ts";

// git-configのbooleanの偽値
const FALSE_VALUES = new Set(["", "0", "false", "no", "off"]);

// 前置代入でvariableに真値を代入したコマンドかを返す
export const isDisabledByPrefix = (
  cmd: Command,
  variable: string,
): boolean => cmd.prefix.some((assignment) => {
  if (assignment.name !== variable) {
    return false;
  }
  const value = assignment.value === undefined
    ? ""
    : expandWord(assignment.value, new Map());

  // 値が静的に決まらない代入は無効化とみなさない
  return value !== null && !FALSE_VALUES.has(value.toLowerCase());
});
