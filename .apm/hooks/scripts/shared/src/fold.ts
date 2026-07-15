// パース済みAST(unbash)を実行順に走査し、各simple commandをその有効CWDとともにcollectする。
// scan(置換内スクリプトの走査)とwalk(構文木の畳み込み)は相互再帰するため同一モジュールに置く。

import type {
  Command,
  DoubleQuotedChild,
  Node,
  Statement,
  TestExpression,
  Word,
  WordPart,
} from "unbash";

import type { Collect, Cwd, State } from "./types.ts";

import {
  applyExportAssign,
  applyPrefixAssign,
  cdTarget,
  EXPORT_LIKE,
} from "./command-effects.ts";
import { cloneEnv, cloneState } from "./types.ts";

// Wordのparts内の置換($(...)/`...`/<(...))の内部スクリプトを走査してcollectする。
// 置換はサブシェルのため、入力状態のコピーで走査する(CWD/envは外へ伝播しない)。
const scanWordSubstitutions = (
  word: Word | undefined,
  state: State,
  collect: Collect,
): void => {
  if (word?.parts === undefined) return;
  const stack: (DoubleQuotedChild | WordPart)[] = [...word.parts];
  while (stack.length > 0) {
    const part = stack.pop();
    if (part === undefined) continue;
    switch (part.type) {
      case "CommandExpansion":
      case "ProcessSubstitution":
        // eslint-disable-next-line @typescript-eslint/no-use-before-define -- walkとの相互再帰。実行時呼び出しで全束縛が初期化済みのため未定義参照は起きない
        for (const stmt of part.script?.commands ?? []) walk(stmt, cloneState(state), collect);
        break;
      case "DoubleQuoted":
      case "LocaleString":
        stack.push(...part.parts);
        break;
      case "ParameterExpansion":
        if (part.operand) stack.push(...(part.operand.parts ?? []));
        if (part.slice) {
          stack.push(...(part.slice.offset.parts ?? []));
          if (part.slice.length) stack.push(...(part.slice.length.parts ?? []));
        }
        if (part.replace) {
          stack.push(...(part.replace.pattern.parts ?? []));
          stack.push(...(part.replace.replacement.parts ?? []));
        }
        break;
      default:
        break;
    }
  }
};

// [[ ]]の条件式ツリーのoperand内の置換を走査する。
const scanTestExpression = (expr: TestExpression, state: State, collect: Collect): void => {
  switch (expr.type) {
    case "TestUnary":
      scanWordSubstitutions(expr.operand, state, collect);
      break;
    case "TestBinary":
      scanWordSubstitutions(expr.left, state, collect);
      scanWordSubstitutions(expr.right, state, collect);
      break;
    case "TestLogical":
      scanTestExpression(expr.left, state, collect);
      scanTestExpression(expr.right, state, collect);
      break;
    case "TestNot":
      scanTestExpression(expr.operand, state, collect);
      break;
    case "TestGroup":
      scanTestExpression(expr.expression, state, collect);
      break;
  }
};

// simple commandを処理する。対象をcollectし、cd/代入の効果を状態へ反映して返す。
const walkCommand = (cmd: Command, state: State, collect: Collect): State => {
  // この呼び出しを現在の有効CWDで採取する(git/jj判定はcollect側)。
  collect(cmd, state.cwd);

  // 全保持Word内の置換の内部スクリプトを走査する(cd適用前・コピーで)。
  scanWordSubstitutions(cmd.name, state, collect);
  for (const w of cmd.suffix) scanWordSubstitutions(w, state, collect);
  for (const a of cmd.prefix) scanWordSubstitutions(a.value, state, collect);
  for (const r of cmd.redirects) {
    scanWordSubstitutions(r.target, state, collect);
    scanWordSubstitutions(r.body, state, collect);
  }

  const name = cmd.name?.value;
  if (name === undefined) {
    // 単独代入 VAR=value(コマンド名無し)。
    for (const a of cmd.prefix) applyPrefixAssign(a, state.env);
    return state;
  }
  if (name === "cd") {
    const info = cdTarget(cmd, state);
    return info ? { cwd: info.target, env: state.env } : state;
  }
  if (EXPORT_LIKE.has(name)) {
    for (const w of cmd.suffix) applyExportAssign(w, state.env);
    return state;
  }
  // 前置一時代入 VAR=value cmd は追跡しない(POSIXで同一command内の他語展開に効かないため)。
  return state;
};

// AndOr(&&/||で結ばれた列)を実行順・success path前提で畳み込む。
// ||の右辺は、直前が解決可能なcdなら(左成功でスキップ)適用前CWDで採取、
// それ以外(非cd・解決不能cd)は「右も実行される経路」を採り現在状態で採取・効果を伝播する。
const walkAndOr = (
  commands: Node[],
  operators: ("&&" | "||")[],
  state: State,
  collect: Collect,
): State => {
  let s = state;
  let prevCwd: Cwd = state.cwd; // 直前にmain-pathで適用したコマンドの実行前CWD
  let lastResolvableCd = false;
  for (let i = 0; i < commands.length; i++) {
    const c = commands[i];
    if (c === undefined) continue;
    const op = i === 0 ? undefined : operators[i - 1];
    if (op === "||" && lastResolvableCd) {
      // 左のcdが成功 → この右辺はスキップ。適用前CWDで採取し、状態は伝播しない。
      // eslint-disable-next-line @typescript-eslint/no-use-before-define -- walkとの相互再帰。実行時呼び出しで全束縛が初期化済みのため未定義参照は起きない
      walk(c, { cwd: prevCwd, env: cloneEnv(s.env) }, collect);
      lastResolvableCd = false;
    } else {
      prevCwd = s.cwd;
      const info = cdTarget(c, s);
      // eslint-disable-next-line @typescript-eslint/no-use-before-define -- walkとの相互再帰。実行時呼び出しで全束縛が初期化済みのため未定義参照は起きない
      s = walk(c, s, collect);
      lastResolvableCd = info !== undefined && info.target !== null;
    }
  }
  return s;
};

// Statement列(;/改行)を左→右へ状態を引き回して畳み込む。
export const foldSequence = (statements: Statement[], state: State, collect: Collect): State => {
  let s = state;
  // eslint-disable-next-line @typescript-eslint/no-use-before-define -- walkとの相互再帰。実行時呼び出しで全束縛が初期化済みのため未定義参照は起きない
  for (const stmt of statements) s = walk(stmt, s, collect);
  return s;
};

// ノードを走査する。同一シェルを共有する構文は更新後状態を返し、
// 分離スコープ(サブシェル・パイプ・background・if/for等の本体)はコピーで走査して結果を捨てる。
const walk = (node: Node, state: State, collect: Collect): State => {
  switch (node.type) {
    case "Command":
      return walkCommand(node, state, collect);
    case "Statement":
      if (node.background === true) {
        walk(node.command, cloneState(state), collect);
        return state;
      }
      return walk(node.command, state, collect);
    case "CompoundList":
      return foldSequence(node.commands, state, collect);
    case "AndOr":
      return walkAndOr(node.commands, node.operators, state, collect);
    case "Pipeline":
      for (const c of node.commands) walk(c, cloneState(state), collect);
      return state;
    case "Subshell":
      walk(node.body, cloneState(state), collect);
      return state;
    case "BraceGroup":
      // brace groupは同一シェル。更新後状態を外へ伝播する。
      return walk(node.body, state, collect);
    case "If":
      walk(node.clause, cloneState(state), collect);
      walk(node.then, cloneState(state), collect);
      if (node.else) walk(node.else, cloneState(state), collect);
      return state;
    case "For":
    case "Select":
    case "ArithmeticFor":
    case "Function":
    case "Coproc":
      walk(node.body, cloneState(state), collect);
      return state;
    case "While":
      walk(node.clause, cloneState(state), collect);
      walk(node.body, cloneState(state), collect);
      return state;
    case "Case":
      for (const item of node.items) walk(item.body, cloneState(state), collect);
      return state;
    case "TestCommand":
      scanTestExpression(node.expression, state, collect);
      return state;
    case "ArithmeticCommand":
      return state;
    default: {
      const exhaustive: never = node;
      return exhaustive;
    }
  }
};
