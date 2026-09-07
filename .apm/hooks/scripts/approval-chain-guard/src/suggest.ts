import type { ChainAnalysis, ChainViolation } from "./types.ts";

const describe = (violation: ChainViolation): string => `  ${violation.label}: ${violation.snippet}`;

const numbered = (command: string, index: number): string => `  ${index + 1}. ${command}`;

/**
 * 拒否理由の文言を組み立てる。
 * 分割案があれば1呼び出しずつのコマンドを列挙し、無ければ検知箇所を示して分割自体を促す。
 */
export const buildDenyMessage = ({ split, violations }: ChainAnalysis): string => {
  if (split === undefined) {
    return "approval-chain-guard: this call needs approval and chains multiple commands inside a "
      + "compound construct (for/if/subshell/$(...)), which can't be split automatically:\n"
      + `${violations.map(describe).join("\n")}\n`
      + "Run each command as its own tool call.";
  }

  return "approval-chain-guard: this call needs approval and chains multiple commands with "
    + "&&, || or ; (or a newline). Split it into separate tool calls so that each approval prompt "
    + "shows exactly one command:\n"
    + `${split.map(numbered).join("\n")}\n`
    + "Splitting drops the && / || conditions between them; check each result before running the next.";
};
