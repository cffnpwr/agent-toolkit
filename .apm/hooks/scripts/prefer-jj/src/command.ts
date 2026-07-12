import type { Command, DoubleQuotedChild, Node, TestExpression, Word, WordPart } from "unbash";

import { parse } from "unbash";

import type { GitCall } from "./types.ts";

// コマンド単位の一時バイパスに使うenv代入名。
const BYPASS_VAR = "PREFER_JJ_DISABLE";

// boolean環境変数の偽値。git-configのbooleanの偽値に合わせる(大文字小文字無視)。
// これらの値の代入ではバイパスしない。
const FALSE_VALUES = new Set(["", "0", "false", "no", "off"]);

// gitのグローバルフラグのうち、値を次の語で取るもの。
// 値をサブコマンドと誤認しないために列挙する(`--git-dir=<path>`等の=結合形は-始まりの語として自然に読み飛ばされる)。
const GIT_VALUE_FLAGS = new Set([
  "-C",
  "-c",
  "--git-dir",
  "--work-tree",
  "--namespace",
  "--config-env",
  "--attr-source",
]);

// [[ ]]の条件式ツリーからoperandのWordを集める。
const testExpressionWords = (expr: TestExpression): Word[] => {
  switch (expr.type) {
    case "TestUnary":
      return [expr.operand];
    case "TestBinary":
      return [expr.left, expr.right];
    case "TestLogical":
      return [...testExpressionWords(expr.left), ...testExpressionWords(expr.right)];
    case "TestNot":
      return testExpressionWords(expr.operand);
    case "TestGroup":
      return testExpressionWords(expr.expression);
  }
};

// ASTから、演算子(&&, ||, ;, |, 改行)で結ばれた各simple commandを集める。
// 実行を伴う置換($(...), `...`, <(...), >(...))の内部スクリプトと、
// サブシェル・if・for等の複合構文の本体も再帰的に走査する。
// [[ ]]はoperand内の置換のみ走査する。算術式の内部には入らない。
const collectCommands = (node: Node, out: Command[]): void => {
  // Wordの並びのpartsを走査し、置換の内部スクリプトからコマンドを集める。
  const collectFromWords = (words: (Word | undefined)[]): void => {
    const parts: (DoubleQuotedChild | WordPart)[] = [];
    const pushParts = (word: Word | undefined): void => {
      if (word?.parts) parts.push(...word.parts);
    };
    for (const word of words) pushParts(word);
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part === undefined) continue;
      switch (part.type) {
        case "CommandExpansion":
        case "ProcessSubstitution":
          for (const statement of part.script?.commands ?? []) {
            collectCommands(statement, out);
          }
          break;
        case "DoubleQuoted":
        case "LocaleString":
          parts.push(...part.parts);
          break;
        case "ParameterExpansion":
          pushParts(part.operand);
          pushParts(part.slice?.offset);
          pushParts(part.slice?.length);
          pushParts(part.replace?.pattern);
          pushParts(part.replace?.replacement);
          break;
        default:
          break;
      }
    }
  };

  switch (node.type) {
    case "Statement":
      collectCommands(node.command, out);
      break;
    case "AndOr":
    case "Pipeline":
      for (const child of node.commands) collectCommands(child, out);
      break;
    case "CompoundList":
      for (const statement of node.commands) collectCommands(statement, out);
      break;
    case "Subshell":
    case "BraceGroup":
    case "For":
    case "ArithmeticFor":
    case "Select":
    case "Function":
    case "Coproc":
      collectCommands(node.body, out);
      break;
    case "While":
      collectCommands(node.clause, out);
      collectCommands(node.body, out);
      break;
    case "If":
      collectCommands(node.clause, out);
      collectCommands(node.then, out);
      if (node.else) collectCommands(node.else, out);
      break;
    case "Case":
      for (const item of node.items) collectCommands(item.body, out);
      break;
    case "TestCommand":
      collectFromWords(testExpressionWords(node.expression));
      break;
    case "Command": {
      out.push(node);

      // simple commandに属する全Wordのpartsを走査し、置換の内部スクリプトを拾う。
      const heldWords: (Word | undefined)[] = [node.name, ...node.suffix];
      for (const assign of node.prefix) heldWords.push(assign.value);
      for (const redirect of node.redirects) heldWords.push(redirect.target, redirect.body);
      collectFromWords(heldWords);
      break;
    }
    default:
      break;
  }
};

// 先頭env代入によるコマンド単位の一時バイパス(PREFER_JJ_DISABLE=1 git ...)を判定する。
// 偽値(空・0・false・no・off)の代入ではバイパスしない。
const hasBypassPrefix = (command: Command): boolean => command.prefix.some(
  (assign) => assign.name === BYPASS_VAR
    && !FALSE_VALUES.has((assign.value?.value ?? "").toLowerCase()),
);

/**
 * コマンド文字列をパースし、simple commandごとにgit呼び出しを抽出して
 * サブコマンドと後続引数を解決する。
 * 先頭env代入PREFER_JJ_DISABLE(偽値以外)が付くsimple commandは除外する。
 */
export const parseGitCalls = (command: string): GitCall[] => {
  const commands: Command[] = [];
  for (const statement of parse(command).commands) collectCommands(statement, commands);

  const calls: GitCall[] = [];
  for (const cmd of commands) {
    // コマンド名がgitバイナリ(git または .../git)の呼び出しだけを対象にする。
    const name = cmd.name?.value;
    if (name === undefined) continue;
    if (name !== "git" && !name.endsWith("/git")) continue;
    if (hasBypassPrefix(cmd)) continue;

    // gitの後ろで最初に現れる非グローバルフラグをサブコマンドとみなす。
    const words = cmd.suffix.map((word) => word.value);
    let subIdx = -1;
    for (let k = 0; k < words.length; k++) {
      const t = words[k];
      if (t === undefined) continue;
      if (t.startsWith("-")) {
        if (GIT_VALUE_FLAGS.has(t)) k++;
        continue;
      }
      subIdx = k;
      break;
    }
    if (subIdx < 0) continue;
    const subcommand = words[subIdx];
    if (subcommand === undefined) continue;
    calls.push({ subcommand, args: words.slice(subIdx + 1) });
  }
  return calls;
};
