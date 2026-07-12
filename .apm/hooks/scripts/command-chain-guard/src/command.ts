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

import type { ChainViolation } from "./types.ts";

const BYPASS_VAR = "COMMAND_CHAIN_GUARD_DISABLE";
const FALSE_VALUES = new Set(["", "0", "false", "no", "off"]);
const CD_ALLOWED_FLAGS = new Set(["-L", "-P"]);

// 走査中に積み上げる可変な状態。1回の解析につき1個生成する。
interface Context {
  source: string;
  violations: ChainViolation[];
  bypassed: boolean;
}

// walkが辿る対象。Statementの並び(CompoundList/Script共通の判定単位)と、
// Wordの各部(command/process substitution内部を辿るため)もNodeと同じ経路で扱う。
type Target = Node | Statement[] | Word | undefined;

const wordValue = (w: Word | undefined): string | undefined => w?.value;

// 先頭env代入にCOMMAND_CHAIN_GUARD_DISABLE(偽値以外)があるかを判定する。
const hasBypassPrefix = (command: Command): boolean => command.prefix.some(
  (assign) => assign.name === BYPASS_VAR
    && !FALSE_VALUES.has((assign.value?.value ?? "").toLowerCase()),
);

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

// command -v例外の先頭セグメント: `command -v <name>`(過不足ない2語のsuffix)。
const isCommandVHead = (cmd: Command): boolean => wordValue(cmd.name) === "command"
  && cmd.suffix.length === 2
  && cmd.suffix[0]?.value === "-v";

// cd例外: 全演算子が&&・セグメント2個・先頭がcd単体呼び出し。
const isCdException = (node: AndOr): boolean => {
  if (node.commands.length !== 2 || !node.operators.every((op) => op === "&&")) return false;
  const head = node.commands[0];
  return head?.type === "Command" && isCdHead(head);
};

// command -v例外: 全演算子が||・セグメント2個・先頭がcommand -v単体呼び出し。
// 一致したときは残りのセグメントのサブツリーを走査しない(呼び出し側の責務)。
const isCommandVException = (node: AndOr): boolean => {
  if (node.commands.length !== 2 || !node.operators.every((op) => op === "||")) return false;
  const head = node.commands[0];
  return head?.type === "Command" && isCommandVHead(head);
};

/**
 * コマンド文字列のAST(Node)・Statementの並び・Wordの各部を再帰的に辿り、
 * 連結違反(ChainViolation)を集める。到達可能な全ての複合構文(サブシェル・if・for・while・
 * function・case等)の内部、およびcommand/process substitutionの内部まで対象にする。
 */
const walk = (target: Target, ctx: Context): void => {
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
    }
    for (const stmt of target) walk(stmt, ctx);
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
      walk(target.command, ctx);
      break;
    case "AndOr": {
      const exempt = isCdException(target) || isCommandVException(target);
      if (!exempt) {
        ctx.violations.push({
          label: [...new Set(target.operators)].join("/"),
          snippet: ctx.source.slice(target.pos, target.end),
        });
      }
      if (isCommandVException(target)) {
        // 一致した残り側のサブツリーは丸ごと素通りさせる。先頭のcommand -v呼び出しだけ走査する。
        walk(target.commands[0], ctx);
      } else {
        for (const child of target.commands) walk(child, ctx);
      }
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
      if (hasBypassPrefix(target)) ctx.bypassed = true;
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

/**
 * コマンド文字列をパースし、`&&`・`||`・`;`(改行含む)による連結を検知する。
 * COMMAND_CHAIN_GUARD_DISABLE(偽値以外)の前置がどこかにあれば、呼び出し全体をバイパスして空配列を返す。
 */
export const findChainViolations = (command: string): ChainViolation[] => {
  const ctx: Context = { source: command, violations: [], bypassed: false };
  walk(parse(command).commands, ctx);
  return ctx.bypassed ? [] : ctx.violations;
};
