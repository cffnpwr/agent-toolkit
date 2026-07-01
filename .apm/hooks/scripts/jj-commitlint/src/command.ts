import type { Target } from "./types.ts";

// 引用符を考慮した最小トークナイザ。
// 必要なのはフラグとrevsetだけなので、厳密なシェル解析でなく近似分割で機能的に十分。
export const tokenize = (command: string): string[] => {
  const tokens: string[] = [];
  let cur = "";
  let i = 0;
  let has = false;
  const push = () => {
    if (has) tokens.push(cur);
    cur = "";
    has = false;
  };
  while (i < command.length) {
    const ch = command[i];
    if (ch === "'") {
      has = true;
      i++;
      while (i < command.length && command[i] !== "'") cur += command[i++];
      i++;
    } else if (ch === "\"") {
      has = true;
      i++;
      while (i < command.length && command[i] !== "\"") {
        if (command[i] === "\\" && i + 1 < command.length) {
          i++;
          cur += command[i++];
        } else {
          cur += command[i++];
        }
      }
      i++;
    } else if (ch === "\\" && i + 1 < command.length) {
      has = true;
      i++;
      cur += command[i++];
    } else if ((/\s/).test(ch)) {
      push();
      i++;
    } else {
      has = true;
      cur += ch;
      i++;
    }
  }
  push();
  return tokens;
};

// 値を取る(次トークンを消費する)フラグ。
// 値をrevsetと誤認しないために列挙する。
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
 * コマンド文字列を区切り(&&, ||, ;, |)で分割する。
 * 各セグメントからjj describe/commit呼び出しを抽出して対象revを解決する。
 */
export const parseTargets = (command: string): Target[] => {
  const tokens = tokenize(command);
  const segments: string[][] = [[]];
  for (const t of tokens) {
    if (t === "&&" || t === "||" || t === ";" || t === "|") {
      segments.push([]);
    } else {
      segments[segments.length - 1].push(t);
    }
  }

  const targets: Target[] = [];
  for (const seg of segments) {
    // jjバイナリトークンの直後にサブコマンドが来る形を探す。
    const jjIdx = seg.findIndex((t) => t === "jj" || t.endsWith("/jj"));
    if (jjIdx < 0) continue;
    // jjの後ろで最初に現れる非グローバルフラグをサブコマンドとみなす。
    let subIdx = -1;
    for (let k = jjIdx + 1; k < seg.length; k++) {
      const t = seg[k];
      if (t.startsWith("-")) {
        if (VALUE_FLAGS.has(t)) k++;
        continue;
      }
      subIdx = k;
      break;
    }
    if (subIdx < 0) continue;
    const sub = seg[subIdx];
    if (sub === "commit" || sub === "ci") {
      // commitは常に@に作用し、説明は直後の@-に乗る。
      targets.push({ subcommand: "commit", revs: ["@-"] });
    } else if (sub === "describe" || sub === "desc") {
      const revs: string[] = [];
      for (let k = subIdx + 1; k < seg.length; k++) {
        const t = seg[k];
        if (t === "-r" || t === "--revision") {
          if (k + 1 < seg.length) revs.push(seg[++k]);
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
      targets.push({ subcommand: "describe", revs: revs.length ? revs : ["@"] });
    }
  }
  return targets;
};
