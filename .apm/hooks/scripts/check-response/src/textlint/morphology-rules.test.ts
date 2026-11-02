import { describe, expect, it } from "bun:test";
import { fileURLToPath } from "node:url";

import { createLinter, loadTextlintrc } from "textlint";

import { MORPHOLOGY_RULES } from "./morphology-rules.ts";

interface Message {
  ruleId: string;
  severity: number;
  line: number;
  column: number;
  message: string;
}

const CONFIG_PATH = fileURLToPath(
  new URL("fixtures/.textlintrc.json", import.meta.url),
);

// 規則を持たない設定に、形態素解析の規則だけを加えた検査
const lintWithMorphologyRules = async (text: string): Promise<Message[]> => {
  const descriptor = await loadTextlintrc({ configFilePath: CONFIG_PATH });
  const linter = createLinter({
    descriptor: descriptor.shallowMerge({ rules: [...MORPHOLOGY_RULES] }),
  });

  return (await linter.lintText(text, "response.md")).messages
    .map(({ ruleId, severity, loc, message }) => ({
      ruleId,
      severity,
      line: loc.start.line,
      column: loc.start.column,
      message,
    }));
};

describe("MORPHOLOGY_RULES", () => {
  it("[positive] 確定の指摘をerror、判定が必要な指摘をwarningで、文中の位置付きで報告する", async () => {
    const text = [
      "ファイルを読み、内容を解析し、結果を整形し、標準出力へ書き込みます。",
      "",
      "設定を足しました。処理が走ります。ファイルを読み込んで、形式を変換して、保存します。",
    ].join("\n");

    const messages = await lintWithMorphologyRules(text);

    expect(messages).toEqual([
      { ruleId: "morphology", severity: 2, line: 1, column: 1, message: "連用中止で4つの節を続けている => （文を分割し、1文に1つの主張を書く）" },
      { ruleId: "morphology", severity: 2, line: 3, column: 4, message: "足し => 追加する" },
      { ruleId: "morphology-needs-judgment", severity: 1, line: 3, column: 13, message: "が走り => （比喩・擬人化であれば、実際の処理・事象を表す動詞に書き換える）" },
      { ruleId: "morphology-needs-judgment", severity: 1, line: 3, column: 18, message: "連用中止で3つの節を続けている => （文を分割し、1文に1つの主張を書く）" },
    ]);
  });

  it("[negative] コードブロック・インラインコードの中の語は検査しない", async () => {
    const text = [
      "`足す`を呼ぶ。",
      "",
      "```",
      "設定を足した。",
      "```",
    ].join("\n");

    const messages = await lintWithMorphologyRules(text);

    expect(messages).toEqual([]);
  });
});
