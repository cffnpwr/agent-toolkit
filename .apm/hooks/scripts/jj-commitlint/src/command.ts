import { parse } from "unbash";

import type { Cwd } from "../../shared/src/cdfold.ts";

import type { Target } from "./types.ts";

import { foldCwd } from "../../shared/src/cdfold.ts";

// 値を取る(次の語を消費する)フラグ。
// 値をrevisionと誤認しないために列挙する。
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

/**
 * コマンド文字列をパースし、simple commandごとにjj describe/commit呼び出しを抽出して
 * 対象revisionと有効CWDを解決する。
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
    if (sub === "commit" || sub === "ci") {
      // commitは常に@に作用し、説明は直後の@-に乗る。
      targets.push({ subcommand: "commit", revs: ["@-"], cwd });
    } else if (sub === "describe" || sub === "desc") {
      const revs: string[] = [];
      for (let k = subIdx + 1; k < seg.length; k++) {
        const t = seg[k];
        if (t === undefined) continue;
        if (t === "-r" || t === "--revision") {
          const next = seg[k + 1];
          if (next !== undefined) {
            revs.push(next);
            k++;
          }
        } else if (t.startsWith("--revision=")) {
          revs.push(t.slice("--revision=".length));
        } else if (t.startsWith("-r") && !t.startsWith("--")) {
          // 密着形-rVALUE / -r=VALUEに対応する。
          const v = t.slice(2);
          revs.push(v.startsWith("=") ? v.slice(1) : v);
        } else if (t.startsWith("-")) {
          if (VALUE_FLAGS.has(t)) k++;
        } else {
          // 位置引数のrevset。
          revs.push(t);
        }
      }
      targets.push({ subcommand: "describe", revs: revs.length ? revs : ["@"], cwd });
    }
  });
  return targets;
};
