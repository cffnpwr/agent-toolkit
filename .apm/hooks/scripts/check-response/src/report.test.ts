import { describe, expect, it } from "bun:test";

import { BLOCK_LIMIT_NOTICE, buildReport, STOP_INSTRUCTION } from "./report.ts";

const calque = { rule: "calque", quote: "安全側に倒す", reason: "Literal translation.", suggestion: "安全を優先する" };

const frank = { rule: "frank", quote: "めっちゃ", reason: "Casual.", suggestion: "とても" };

describe("buildReport", () => {
  it("[positive] 差し戻せる状態で違反・差し戻さない指摘・警告があるとき、その順に並べてexit 2にする", () => {
    const report = buildReport({
      textlint: [{ certainty: "confirmed", line: 1, lineText: "要するに", ruleId: "prh", message: "削除する" }],
      blocking: [{ title: "Prose review", findings: [calque] }],
      nonBlocking: [{ title: "Verification review", findings: [frank] }],
      warnings: ["Cannot tell the harness.", "`claude -p` failed: exit code 1"],
      canBlock: true,
    });

    expect(report).toEqual({
      exitCode: 2,
      message: [
        `check-response: ${STOP_INSTRUCTION}`,
        "",
        "textlint (Japanese style rules):",
        "- line 1 \"要するに\": 削除する (prh)",
        "",
        "Prose review:",
        "- calque: \"安全側に倒す\" -- Literal translation. Suggested fix: 安全を優先する",
        "",
        "Verification review (new findings after the previous block; not sent back):",
        "- frank: \"めっちゃ\" -- Casual. Suggested fix: とても",
        "",
        "The check could not finish:",
        "- Cannot tell the harness.",
        "- `claude -p` failed: exit code 1",
      ].join("\n"),
    });
  });

  it("[positive] 違反だけがあるとき、警告の節を付けずにexit 2にする", () => {
    const report = buildReport({ textlint: [], blocking: [{ title: "Prose review", findings: [frank] }], nonBlocking: [], warnings: [], canBlock: true });

    expect(report).toEqual({
      exitCode: 2,
      message: `check-response: ${STOP_INSTRUCTION}\n\nProse review:\n- frank: "めっちゃ" -- Casual. Suggested fix: とても`,
    });
  });

  it("[positive] 差し戻しの上限に達して違反があるとき、残った違反と差し戻さない指摘をexit 1で警告する", () => {
    const report = buildReport({ textlint: [], blocking: [{ title: "Prose review", findings: [calque] }], nonBlocking: [{ title: "Prose review", findings: [frank] }], warnings: [], canBlock: false });

    expect(report).toEqual({
      exitCode: 1,
      message: [
        `check-response: ${BLOCK_LIMIT_NOTICE}`,
        "",
        "Prose review:",
        "- calque: \"安全側に倒す\" -- Literal translation. Suggested fix: 安全を優先する",
        "",
        "Prose review (new findings after the previous block; not sent back):",
        "- frank: \"めっちゃ\" -- Casual. Suggested fix: とても",
      ].join("\n"),
    });
  });

  it("[positive] 差し戻さない指摘だけのとき、exit 1で警告する", () => {
    const report = buildReport({ textlint: [], blocking: [], nonBlocking: [{ title: "Prose review", findings: [frank] }], warnings: [], canBlock: true });

    expect(report).toEqual({
      exitCode: 1,
      message: "check-response: Prose review (new findings after the previous block; not sent back):\n- frank: \"めっちゃ\" -- Casual. Suggested fix: とても",
    });
  });

  it("[positive] 警告だけのときexit 1にする", () => {
    const report = buildReport({ textlint: [], blocking: [], nonBlocking: [], warnings: ["`codex exec` failed: exit code 1"], canBlock: true });

    expect(report).toEqual({
      exitCode: 1,
      message: "check-response: The check could not finish:\n- `codex exec` failed: exit code 1",
    });
  });

  it.each([true, false])("[negative] 差し戻せるかが%sで、違反も警告も無いときexit 0で出力しない", (canBlock) => {
    const report = buildReport({
      textlint: [],
      blocking: [],
      nonBlocking: [],
      warnings: [],
      canBlock,
    });

    expect(report).toEqual({ exitCode: 0 });
  });
});
