import type {
  AndOr,
  Command,
  DoubleQuotedChild,
  Node,
  Statement,
  Word,
  WordPart,
} from "unbash";

import { parse } from "unbash";

import type { ChainAnalysis, ChainViolation } from "./types.ts";

const CD_ALLOWED_FLAGS = new Set(["-L", "-P"]);

// 走査中に積み上げる可変な状態。1回の解析につき1個生成する。
interface Context {
  source: string;
  violations: ChainViolation[];
  // トップレベル(Script直下のStatementリスト、またはその唯一のStatementのAndOr)を違反にしたか。
  // 分割案を作れる形かの判定に使う。
  topLevelViolated: boolean;
}

// walkが辿る対象。Statementの並び(CompoundList/Script共通の判定単位)と、
// Wordの各部(command/process substitution内部を辿るため)もNodeと同じ経路で扱う。
type Target = Node | Statement[] | Word | undefined;

const wordValue = (w: Word | undefined): string | undefined => w?.value;

// cd例外の先頭セグメント: `cd <dir>`(フラグは-L/-Pのみ許容、非フラグ引数はちょうど1個)。
const isCdHead = (cmd: Command): boolean => {
  if (wordValue(cmd.name) !== "cd") return false;
  let dirArgs = 0;
  for (const w of cmd.suffix) {
    if (CD_ALLOWED_FLAGS.has(w.value)) continue;
    if (w.value.startsWith("-")) return false;
    dirArgs++;
  }
  return dirArgs === 1;
};

// cd例外: 全演算子が&&・セグメント2個・先頭がcd単体呼び出し。
const isCdException = (node: AndOr): boolean => {
  if (node.commands.length !== 2 || !node.operators.every((op) => op === "&&")) return false;
  const head = node.commands[0];
  return head?.type === "Command" && isCdHead(head);
};

/**
 * コマンド文字列のAST(Node)・Statementの並び・Wordの各部を再帰的に辿り、
 * 連結違反(ChainViolation)を集める。到達可能な全ての複合構文(サブシェル・if・for・while・
 * function・case等)の内部、およびcommand/process substitutionの内部まで対象にする。
 */
const walk = (target: Target, ctx: Context, topLevel = false): void => {
  if (target === undefined) return;

  if (Array.isArray(target)) {
    // Statementの並び。`&`(バックグラウンド)だけで繋がれた並びはbanされた3演算子に含まれないため対象外にする。
    // 直前のStatementがbackgroundでない箇所が1つでもあれば、そこは`;`・改行区切りとして違反にする。
    const hasNonBackgroundJunction = target
      .slice(0, -1)
      .some((stmt) => !stmt.background);
    const first = target[0];
    const last = target[target.length - 1];
    if (target.length > 1 && hasNonBackgroundJunction && first !== undefined && last !== undefined) {
      ctx.violations.push({
        label: "; or newline",
        snippet: ctx.source.slice(first.pos, last.end),
      });
      if (topLevel) ctx.topLevelViolated = true;
    }
    // 並びが1個のときだけ、その中身もトップレベルの連結として扱う。
    for (const stmt of target) walk(stmt, ctx, topLevel && target.length === 1);
    return;
  }

  if (!("type" in target)) {
    // Word: command/process substitution・パラメータ展開の内部を辿る。
    const parts: (DoubleQuotedChild | WordPart)[] = target.parts ? [...target.parts] : [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part === undefined) continue;
      switch (part.type) {
        case "CommandExpansion":
        case "ProcessSubstitution":
          walk(part.script?.commands ?? [], ctx);
          break;
        case "DoubleQuoted":
        case "LocaleString":
          parts.push(...part.parts);
          break;
        case "ParameterExpansion":
          walk(part.operand, ctx);
          walk(part.slice?.offset, ctx);
          walk(part.slice?.length, ctx);
          walk(part.replace?.pattern, ctx);
          walk(part.replace?.replacement, ctx);
          break;
        default:
          break;
      }
    }
    return;
  }

  switch (target.type) {
    case "Statement":
      walk(target.command, ctx, topLevel);
      break;
    case "AndOr": {
      if (!isCdException(target)) {
        ctx.violations.push({
          label: [...new Set(target.operators)].join("/"),
          snippet: ctx.source.slice(target.pos, target.end),
        });
        if (topLevel) ctx.topLevelViolated = true;
      }
      for (const child of target.commands) walk(child, ctx);
      break;
    }
    case "Pipeline":
      for (const child of target.commands) walk(child, ctx);
      break;
    case "Subshell":
    case "BraceGroup":
      walk(target.body.commands, ctx);
      break;
    case "If": {
      walk(target.clause.commands, ctx);
      walk(target.then.commands, ctx);
      const elseBranch = target.else;
      if (elseBranch) {
        if (elseBranch.type === "If") walk(elseBranch, ctx);
        else walk(elseBranch.commands, ctx);
      }
      break;
    }
    case "For":
    case "ArithmeticFor":
    case "Select":
      walk(target.body.commands, ctx);
      break;
    case "While":
      walk(target.clause.commands, ctx);
      walk(target.body.commands, ctx);
      break;
    case "Function":
    case "Coproc":
      walk(target.body, ctx);
      break;
    case "Case":
      for (const item of target.items) walk(item.body.commands, ctx);
      break;
    case "Command": {
      const heldWords: (Word | undefined)[] = [target.name, ...target.suffix];
      for (const assign of target.prefix) heldWords.push(assign.value);
      for (const redirect of target.redirects) heldWords.push(redirect.target, redirect.body);
      for (const word of heldWords) walk(word, ctx);
      break;
    }
    default:
      break;
  }
};

// 1呼び出しずつに分けられるセグメント。複合構文はそれ自体が複数コマンドを含むため対象外にする。
const isSplittableSegment = (node: Node): boolean => node.type === "Command" || node.type === "Pipeline";

/**
 * トップレベルの連結を、1呼び出しずつのコマンド列へ分ける。
 * セグメントに複合構文が混じる場合は分けられないためundefinedを返す。
 * `cd <dir> &&`で始まる&&連鎖は、cwdが呼び出しごとにリセットされるharnessでも各項が成立するよう、
 * `cd <dir>`を各項へ再前置する。
 */
const buildSplitPlan = (statements: Statement[], source: string): string[] | undefined => {
  const slice = (node: { end: number; pos: number; }): string => source.slice(node.pos, node.end);

  if (statements.length > 1) {
    if (!statements.every((stmt) => isSplittableSegment(stmt.command))) return undefined;
    return statements.map(slice);
  }

  const only = statements[0]?.command;
  if (only?.type !== "AndOr") return undefined;
  const segments = only.commands;
  if (!segments.every(isSplittableSegment)) return undefined;

  const head = segments[0];
  if (head?.type === "Command" && isCdHead(head) && only.operators.every((op) => op === "&&")) {
    const prefix = slice(head);
    return segments.slice(1).map((segment) => `${prefix} && ${slice(segment)}`);
  }
  return segments.map(slice);
};

/**
 * コマンド文字列をパースし、`&&`・`||`・`;`(改行含む)による連結を検知する。
 * 検知が1件かつそれがトップレベルの連結のときだけ、分割案(split)を添える。
 * 2件以上あるときは、より深い階層にも連結があり機械的に分けられないため添えない。
 */
export const analyzeChain = (command: string): ChainAnalysis => {
  const script = parse(command);
  const ctx: Context = { source: command, violations: [], topLevelViolated: false };
  walk(script.commands, ctx, true);

  const splittable = ctx.violations.length === 1 && ctx.topLevelViolated;
  return {
    violations: ctx.violations,
    split: splittable ? buildSplitPlan(script.commands, command) : undefined,
  };
};
