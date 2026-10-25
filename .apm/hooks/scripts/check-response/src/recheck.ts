import type { BlockState } from "./hook/review-state.ts";
import type { Finding } from "./llm-review/findings.ts";
import type { ReviewSection } from "./llm-review/reviewer.ts";

// 1つのターンで差し戻す回数の上限
export const MAX_BLOCKS_PER_TURN = 3;

const REMAINING_FINDINGS_TITLE = "Findings from the previous block that are still in the response";

export interface FindingGroup {
  title: string;
  findings: Finding[];
}

export interface ReviewVerdict {
  blocking: FindingGroup[];
  nonBlocking: FindingGroup[];
}

const findingGroupsOf = (sections: ReviewSection[]): FindingGroup[] => sections
  .map(({ title, result }) => ({ title, findings: result.unwrapOr([]) }))
  .filter(({ findings }) => findings.length > 0);

// 前の差し戻しで報告した指摘のうち、引用した箇所が書き直した応答にそのまま残っているもの
const remainingFindingsOf = (
  findings: Finding[],
  responses: string[],
): Finding[] => findings.filter(({ quote }) => quote.trim() !== ""
  && responses.some((response) => response.includes(quote)));

export const judgeReviews = (
  sections: ReviewSection[],
  blockState: BlockState | undefined,
  responses: string[],
): ReviewVerdict => {
  const groups = findingGroupsOf(sections);
  if (blockState === undefined) {
    return { blocking: groups, nonBlocking: [] };
  }
  // 差し戻し後の検査での新しい指摘は、差し戻しの対象外
  const remaining = remainingFindingsOf(blockState.findings, responses);
  const remainingQuotes = new Set(remaining.map(({ quote }) => quote));

  return {
    blocking: remaining.length > 0
      ? [{ title: REMAINING_FINDINGS_TITLE, findings: remaining }]
      : [],
    nonBlocking: groups
      .map(({ title, findings }) => ({
        title,
        findings: findings.filter(({ quote }) => !remainingQuotes.has(quote)),
      }))
      .filter(({ findings }) => findings.length > 0),
  };
};

export const canBlock = (
  blockState: BlockState | undefined,
): boolean => (blockState?.count ?? 0) < MAX_BLOCKS_PER_TURN;
