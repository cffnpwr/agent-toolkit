import type { TxtParagraphNode } from "@textlint/ast-node-types";
import type { TextlintRuleReporter } from "@textlint/types";

import { tokenize } from "kuromojin";
import { splitAST } from "sentence-splitter";

import type { MorphologyFinding, PositionedToken } from "./morphology.ts";

import {
  bannedVerbFindings,
  CONFIRMED_CLAUSE_COUNT,
  countClauses,
  describeClauseCount,
  motionVerbFindings,
  NEEDS_JUDGMENT_CLAUSE_COUNT,
} from "./morphology.ts";

// sentence-splitterの依存する@textlint/ast-node-typesのバージョンがtextlintと異なるため、使う属性のみの型
interface AstNode {
  type: string;
  range: readonly [number, number];
  children?: AstNode[];
}

interface Sentence {
  range: readonly [number, number];
  tokens: PositionedToken[];
}

type SentenceCheck = (sentence: Sentence) => MorphologyFinding[];

// インラインコード・URL等はStrの外にあるため、形態素解析の対象は文中のStrのみ
const strNodesOf = (node: AstNode): AstNode[] => (node.type === "Str"
  ? [node]
  : (node.children ?? []).flatMap(strNodesOf));

const tokensOf = async (
  str: AstNode,
  source: string,
): Promise<PositionedToken[]> => {
  const [start, end] = str.range;

  // 位置を本文と揃えるため、形態素解析の対象はStrのvalueではなく本文の範囲
  return (await tokenize(source.slice(start, end)))
    .map((token) => ({ token, offset: start + token.word_position - 1 }));
};

const sentenceNodesOf = (
  paragraph: TxtParagraphNode,
): AstNode[] => (splitAST(paragraph as Parameters<typeof splitAST>[0])
  .children as AstNode[])
  .filter((child) => child.type === "Sentence");

const sentencesOf = async (
  paragraph: TxtParagraphNode,
  source: string,
): Promise<Sentence[]> => Promise.all(
  sentenceNodesOf(paragraph).map(async (sentence) => ({
    range: sentence.range,
    tokens: (await Promise.all(
      strNodesOf(sentence).map(async (str) => tokensOf(str, source)),
    )).flat(),
  })),
);

const clauseFindings = (
  { range: [start, end], tokens }: Sentence,
  isTarget: (count: number) => boolean,
): MorphologyFinding[] => {
  const count = countClauses(tokens.map(({ token }) => token));

  return isTarget(count)
    ? [{
      offset: start,
      length: end - start,
      message: describeClauseCount(count),
    }]
    : [];
};

const createRule = (
  check: SentenceCheck,
): TextlintRuleReporter => (context) => ({
  [context.Syntax.Paragraph]: async (paragraph: TxtParagraphNode) => {
    for (const sentence of await sentencesOf(paragraph, context.getSource())) {
      for (const { offset, length, message } of check(sentence)) {
        const start = offset - paragraph.range[0];
        context.report(paragraph, new context.RuleError(message, {
          padding: context.locator.range([start, start + length]),
        }));
      }
    }
  },
});

// 書き換えが必要と確定する違反
const confirmedRule = createRule((sentence) => [
  ...bannedVerbFindings(sentence.tokens),
  ...clauseFindings(sentence, (count) => count >= CONFIRMED_CLAUSE_COUNT),
]);

// 文脈によっては違反でないため、文章の査読で判定する候補
const needsJudgmentRule = createRule((sentence) => [
  ...motionVerbFindings(sentence.tokens),
  ...clauseFindings(sentence, (count) => count === NEEDS_JUDGMENT_CLAUSE_COUNT),
]);

export const MORPHOLOGY_RULES = [
  { ruleId: "morphology", rule: confirmedRule, options: true },
  { ruleId: "morphology-needs-judgment", rule: needsJudgmentRule, options: { severity: "warning" } },
] as const;
