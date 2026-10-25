import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { fileURLToPath } from "node:url";

import * as textlint from "textlint";

import { MORPHOLOGY_RULES } from "./morphology-rules.ts";
import { createResponseLinter, describeTextlintFinding, findingsOf } from "./textlint.ts";

describe("createResponseLinter", () => {
  afterEach(() => {
    mock.restore();
  });

  it("[positive] hookの設定に形態素解析の規則を加えてtextlintを作り、errorを確定、warningと設定のseverityを反映しない規則のerrorを判定が必要な指摘として、その行の本文付きで返す", async () => {
    const configRule = { ruleId: "prh", rule: () => ({}), options: { severity: "warning" } };
    const merged = { rules: "merged" };
    const shallowMerge = mock((_args: unknown) => merged);
    const descriptor = {
      rule: { toKernelRulesFormat: () => [configRule] },
      shallowMerge,
    };
    const lintText = mock(async (_text: string, _filePath: string) => ({
      filePath: "response.md",
      messages: [
        { ruleId: "warning-rule", message: "line 1", severity: 1, loc: { start: { line: 1 } } },
        { ruleId: "error-rule", message: "line 2", severity: 2, loc: { start: { line: 2 } } },
        { ruleId: "info-rule", message: "line 3", severity: 3, loc: { start: { line: 3 } } },
        { ruleId: "off-rule", message: "line 3", severity: 0, loc: { start: { line: 3 } } },
        { ruleId: "out-of-text", message: "line 5", severity: 2, loc: { start: { line: 5 } } },
        { ruleId: "@textlint-ja/ai-writing/ai-tech-writing-guideline", message: "line 2", severity: 2, loc: { start: { line: 2 } } },
      ],
    }));
    const loadTextlintrc = spyOn(textlint, "loadTextlintrc").mockResolvedValue(descriptor as never);
    const createLinter = spyOn(textlint, "createLinter").mockReturnValue({ lintText } as never);

    const lintResponse = await createResponseLinter();
    const findings = await lintResponse("一行目\n二行目\n三行目");

    expect(findings).toEqual([
      { certainty: "needs-judgment", line: 1, lineText: "一行目", ruleId: "warning-rule", message: "line 1" },
      { certainty: "confirmed", line: 2, lineText: "二行目", ruleId: "error-rule", message: "line 2" },
      { certainty: "confirmed", line: 5, lineText: "", ruleId: "out-of-text", message: "line 5" },
      { certainty: "needs-judgment", line: 2, lineText: "二行目", ruleId: "@textlint-ja/ai-writing/ai-tech-writing-guideline", message: "line 2" },
    ]);
    expect(loadTextlintrc.mock.calls).toEqual([[{ configFilePath: fileURLToPath(new URL("../../.textlintrc.json", import.meta.url)) }]]);
    expect(shallowMerge.mock.calls).toEqual([
      [{ rules: [configRule, ...MORPHOLOGY_RULES] }],
    ]);
    expect(createLinter.mock.calls as unknown[]).toEqual([
      [{ descriptor: merged }],
    ]);
    expect(lintText.mock.calls).toEqual([["一行目\n二行目\n三行目", "response.md"]]);
  });
});

describe("findingsOf", () => {
  it("[positive] 指定した確かさの指摘だけを返す", () => {
    const confirmed = { certainty: "confirmed" as const, line: 1, lineText: "a", ruleId: "r", message: "m" };
    const needsJudgment = { certainty: "needs-judgment" as const, line: 2, lineText: "b", ruleId: "r", message: "m" };

    const findings = findingsOf([confirmed, needsJudgment], "needs-judgment");

    expect(findings).toEqual([needsJudgment]);
  });
});

describe("describeTextlintFinding", () => {
  it("[positive] 行番号・行の本文・メッセージ・規則を1行にする", () => {
    const text = describeTextlintFinding({ certainty: "confirmed", line: 3, lineText: "要するに", ruleId: "prh", message: "要するに => 削除" });

    expect(text).toBe("- line 3 \"要するに\": 要するに => 削除 (prh)");
  });
});
