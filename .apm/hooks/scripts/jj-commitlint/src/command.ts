import type { DoubleQuotedChild, Node, TestExpression, Word, WordPart } from "unbash";

import { parse } from "unbash";

import type { Target } from "./types.ts";

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

// ASTから、演算子(&&, ||, ;, |)で結ばれた各simple commandの語列を集める。
// 実行を伴う置換($(...), `...`, <(...), >(...))の内部スクリプトと、
// サブシェル・if・for等の複合構文の本体も再帰的に走査する。
// [[ ]]はoperand内の置換のみ走査する。算術式の内部には入らない。
const collectFromNode = (node: Node, segments: string[][]): void => {
  // Wordの並びのpartsを走査し、置換の内部スクリプトから語列を集める。
  const collectFromWords = (words: (Word | undefined)[]): void => {
    const parts: (DoubleQuotedChild | WordPart)[] = [];
    const pushParts = (word: Word | undefined): void => {
      if (word?.parts) parts.push(...word.parts);
    };
    for (const word of words) pushParts(word);
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      switch (part.type) {
        case "CommandExpansion":
        case "ProcessSubstitution":
          for (const statement of part.script?.commands ?? []) {
            collectFromNode(statement, segments);
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
      collectFromNode(node.command, segments);
      break;
    case "AndOr":
    case "Pipeline":
      for (const child of node.commands) collectFromNode(child, segments);
      break;
    case "CompoundList":
      for (const statement of node.commands) collectFromNode(statement, segments);
      break;
    case "Subshell":
    case "BraceGroup":
    case "For":
    case "ArithmeticFor":
    case "Select":
    case "Function":
    case "Coproc":
      collectFromNode(node.body, segments);
      break;
    case "While":
      collectFromNode(node.clause, segments);
      collectFromNode(node.body, segments);
      break;
    case "If":
      collectFromNode(node.clause, segments);
      collectFromNode(node.then, segments);
      if (node.else) collectFromNode(node.else, segments);
      break;
    case "Case":
      for (const item of node.items) collectFromNode(item.body, segments);
      break;
    case "TestCommand":
      collectFromWords(testExpressionWords(node.expression));
      break;
    case "Command": {
      const words: string[] = [];
      if (node.name) words.push(node.name.value);
      for (const word of node.suffix) words.push(word.value);
      if (words.length > 0) segments.push(words);

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

/**
 * コマンド文字列をパースし、simple commandごとにjj describe/commit呼び出しを抽出して
 * 対象revisionを解決する。
 */
export const parseTargets = (command: string): Target[] => {
  const segments: string[][] = [];
  for (const statement of parse(command).commands) collectFromNode(statement, segments);

  const targets: Target[] = [];
  for (const seg of segments) {
    // コマンド名がjjバイナリ(jj または .../jj)の呼び出しだけを対象にする。
    if (seg[0] !== "jj" && !seg[0].endsWith("/jj")) continue;
    // jjの後ろで最初に現れる非グローバルフラグをサブコマンドとみなす。
    let subIdx = -1;
    for (let k = 1; k < seg.length; k++) {
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
