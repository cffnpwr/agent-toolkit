// コマンド文字列内のcdによる有効CWD移動を解決する共通エンジン(cd-fold)。
//
// 各hookはunbashでパースしたAST(parse(command).commands)を渡し、collectコールバックで
// simple commandごとに「その呼び出しが実際に実行される有効CWD」を受け取る。
// unbashのランタイム依存(parse)は各hook側に残し、ここは型のみ(import type、実行時に消える)を使う。
// これによりnode_modulesを持たないsharedでも解決できる(tscの型解決は各hook tsconfigのpathsで補う)。

import { resolve } from "node:path";

import type {
  AssignmentPrefix,
  Command,
  DoubleQuotedChild,
  Node,
  Statement,
  TestExpression,
  Word,
  WordPart,
} from "unbash";

// 有効CWD。null=静的に解決不能(不明)。
export type Cwd = string | null;

// 変数環境。値string=既知、値null=既知だが解決不能、キー不在=未定義。
type Env = Map<string, string | null>;

// foldの引き回すスコープ状態。cwd(有効CWD)とenv(変数環境)を同一シェル内で共有する。
interface State {
  cwd: Cwd;
  env: Env;
}

// simple commandごとに、その呼び出しが実行される有効CWDとともに呼ばれる。
// cmdはunbashのCommandノード(name/suffix/prefix/redirectsを持つ)。
export type Collect = (cmd: Command, cwd: Cwd) => void;

// シェルの変数名(識別子)。特殊パラメータ($1・$?等)は解決対象外。
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

// 未設定/空時に既定値を採るパラメータ展開の演算子。
const DEFAULT_OPS = new Set([":-", "-", ":=", "="]);

// 変数代入を追跡する組み込みコマンド(export VAR=value 形)。
const EXPORT_LIKE = new Set(["export", "declare", "local", "readonly", "typeset"]);

const cloneEnv = (env: Env): Env => new Map(env);
const cloneState = (s: State): State => ({ cwd: s.cwd, env: new Map(s.env) });

// 変数名を現在のenvで引く。未定義・解決不能・特殊パラメータはnull。
const lookupVar = (name: string, env: Env): string | null => {
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
const expandWord = (word: Word, env: Env): string | null => {
  if (word.parts === undefined) return expandTilde(word.value, env);
  return expandParts(word.parts, env);
};

// ノードを(Statementを剥がして)Commandとして取り出す。cd判定用。
const asCommand = (node: Node): Command | undefined => {
  if (node.type === "Command") return node;
  if (node.type === "Statement" && node.command.type === "Command") return node.command;
  return undefined;
};

// ノードがcd呼び出しなら移動先の有効CWDを返す。cdでなければundefined。
// 解決不能な移動先(cd -・未定義変数・コマンド置換等)はtarget=null。
const cdTarget = (node: Node, state: State): { target: Cwd; } | undefined => {
  const cmd = asCommand(node);
  if (cmd === undefined || cmd.name?.value !== "cd") return undefined;

  let targetWord: Word | undefined;
  let seenDDash = false;
  for (const w of cmd.suffix) {
    const v = w.value;
    if (!seenDDash) {
      if (v === "--") {
        seenDDash = true;
        continue;
      }
      // cdのオプション(-L/-P/-e/-@)と、未知のフラグ様の語(- 単独を除く)を読み飛ばす。
      if (v.startsWith("-") && v !== "-") continue;
    }
    targetWord = w;
    break;
  }

  if (targetWord === undefined) {
    // 引数無しのcd → HOME。
    return { target: lookupVar("HOME", state.env) };
  }
  if (!seenDDash && targetWord.value === "-") {
    // cd - はOLDPWD。追跡しないため不明。
    return { target: null };
  }
  const expanded = expandWord(targetWord, state.env);
  if (expanded === null) return { target: null };
  if (expanded === "") {
    // cd "" は無操作。CWDは変わらない。
    return { target: state.cwd };
  }
  if (expanded.startsWith("/")) return { target: resolve(expanded) };
  return { target: state.cwd === null ? null : resolve(state.cwd, expanded) };
};

// 単独代入 VAR=value(prefix)を現在のenvへ反映する。
const applyPrefixAssign = (assign: AssignmentPrefix, env: Env): void => {
  const name = assign.name;
  if (name === undefined || !IDENT.test(name)) return;
  if (assign.array !== undefined) return; // 配列代入はパスに使わないため追跡しない
  if (assign.value === undefined) {
    env.set(name, "");
    return;
  }
  env.set(name, expandWord(assign.value, env));
};

// export VAR=value 形のsuffix語を現在のenvへ反映する。
const applyExportAssign = (word: Word, env: Env): void => {
  const src = word.value;
  const eq = src.indexOf("=");
  if (eq <= 0) return;
  const name = src.slice(0, eq);
  if (!IDENT.test(name)) return;
  const expanded = expandWord(word, env);
  // 値側が解決不能なら「既知だが不明」として登録する。
  if (expanded === null) {
    env.set(name, null);
    return;
  }
  // 展開結果は "NAME=<値>"。変数名部はリテラルなので先頭のNAME=を落とす。
  env.set(name, expanded.slice(name.length + 1));
};

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
      walk(c, { cwd: prevCwd, env: cloneEnv(s.env) }, collect);
      lastResolvableCd = false;
    } else {
      prevCwd = s.cwd;
      const info = cdTarget(c, s);
      s = walk(c, s, collect);
      lastResolvableCd = info !== undefined && info.target !== null;
    }
  }
  return s;
};

// Statement列(;/改行)を左→右へ状態を引き回して畳み込む。
const foldSequence = (statements: Statement[], state: State, collect: Collect): State => {
  let s = state;
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

/**
 * パース済みのStatement列(parse(command).commands)を実行順に走査し、
 * 各simple commandをその有効CWDとともにcollectへ渡す。
 * baseCwdはコマンド先頭のcd実行前の基準CWD(null不可の通常呼び出しではstring)。
 */
export const foldCwd = (commands: Statement[], baseCwd: Cwd, collect: Collect): void => {
  const env: Env = new Map();
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string") env.set(k, v);
  }
  foldSequence(commands, { cwd: baseCwd, env }, collect);
};

/**
 * hook起動時の基準CWDを解決する。input.cwd → CLAUDE_PROJECT_DIR → process.cwd() の順。
 */
export const resolveBaseCwd = (inputCwd: unknown): string => {
  if (typeof inputCwd === "string" && inputCwd.length > 0) return inputCwd;
  const projectDir = process.env.CLAUDE_PROJECT_DIR;
  if (typeof projectDir === "string" && projectDir.length > 0) return projectDir;
  return process.cwd();
};
