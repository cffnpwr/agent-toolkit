import { describe, expect, it } from "bun:test";

import type { Conversation, HistoryEntry } from "../conversation/conversation.ts";

import { toProseReviewInput, toVerificationReviewInput, withoutCodeBlocks } from "./review-input.ts";

describe("withoutCodeBlocks", () => {
  it("[positive] フェンス・インデント・リストの中のコードブロックを省略の表記に置き換え、インラインコードは残す", () => {
    const text = [
      "結果です。",
      "",
      "```ts",
      "const a = 1;",
      "```",
      "",
      "- 手順",
      "",
      "  ~~~",
      "  bun test",
      "  ~~~",
      "",
      "`bun test`を実行しました。",
    ].join("\n");

    const result = withoutCodeBlocks(text);

    expect(result).toBe([
      "結果です。",
      "",
      "[コードブロック省略]",
      "",
      "- 手順",
      "",
      "  [コードブロック省略]",
      "",
      "`bun test`を実行しました。",
    ].join("\n"));
  });

  it("[negative] コードブロックが無いとき、本文を変えない", () => {
    const result = withoutCodeBlocks("`a`を変更しました。");

    expect(result).toBe("`a`を変更しました。");
  });
});

describe("toProseReviewInput", () => {
  it("[positive] ツール呼び出しを除いて出来事を発生順にタグで囲み、応答のコードブロックを省き、確定した指摘と判定する指摘を続ける", () => {
    const conversation: Conversation = {
      kind: "after-user-message",
      userMessageLine: 0,
      history: [],
      events: [
        { kind: "user-message", text: "テストを実行して" },
        { kind: "tool-call", callId: "c1", name: "Bash", input: "{\"command\":\"bun test\"}", result: "3 pass" },
        { kind: "hook-feedback", text: "check-response: 差し戻し" },
        { kind: "response", text: "成功しました。\n\n```\n3 pass\n```" },
      ],
    };

    const input = toProseReviewInput({ conversation, confirmedFindings: ["- line 1 \"成功しました。\": 指摘 (rule)"], findingsToJudge: ["- line 1 \"成功しました。\": 候補 (rule)"] });

    expect(input).toBe([
      "<conversation>",
      "<user-message>\nテストを実行して\n</user-message>",
      "<hook-feedback>\ncheck-response: 差し戻し\n</hook-feedback>",
      "<response-to-review>\n成功しました。\n\n[コードブロック省略]\n</response-to-review>",
      "</conversation>",
      "<textlint-findings-already-reported>\n- line 1 \"成功しました。\": 指摘 (rule)\n</textlint-findings-already-reported>",
      "<textlint-findings-to-judge>\n- line 1 \"成功しました。\": 候補 (rule)\n</textlint-findings-to-judge>",
    ].join("\n"));
  });

  it("[positive] 前のターンがあるとき、応答のコードブロックを省いて会話の前に文脈のタグで入れる", () => {
    const conversation: Conversation = {
      kind: "after-user-message",
      userMessageLine: 2,
      history: [{ kind: "user-message", text: "前の依頼" }, { kind: "response", text: "前の応答\n\n```\ncode\n```" }],
      events: [{ kind: "user-message", text: "依頼" }, { kind: "response", text: "応答" }],
    };

    const input = toProseReviewInput({
      conversation,
      confirmedFindings: [],
      findingsToJudge: [],
    });

    expect(input).toBe([
      "<earlier-turns>",
      "<user-message>\n前の依頼\n</user-message>",
      "<response>\n前の応答\n\n[コードブロック省略]\n</response>",
      "</earlier-turns>",
      "<conversation>",
      "<user-message>\n依頼\n</user-message>",
      "<response-to-review>\n応答\n</response-to-review>",
      "</conversation>",
      "<textlint-findings-already-reported></textlint-findings-already-reported>",
      "<textlint-findings-to-judge></textlint-findings-to-judge>",
    ].join("\n"));
  });

  it.each<{ name: string; history: HistoryEntry[]; want: string[]; }>([
    {
      name: "合計が12000文字",
      history: [{ kind: "user-message", text: "a".repeat(4000) }, { kind: "response", text: "b".repeat(4000) }, { kind: "user-message", text: "c".repeat(4000) }],
      want: ["a".repeat(4000), "b".repeat(4000), "c".repeat(4000)],
    },
    {
      name: "合計が12001文字",
      history: [{ kind: "user-message", text: "a".repeat(4001) }, { kind: "response", text: "b".repeat(4000) }, { kind: "user-message", text: "c".repeat(4000) }],
      want: ["b".repeat(4000), "c".repeat(4000)],
    },
  ])("[positive] 前のターンの$nameとき、新しいものから12000文字以内に収まる分だけを発生順に入れる", ({ history, want }) => {
    const conversation: Conversation = { kind: "after-user-message", userMessageLine: 3, history, events: [] };

    const input = toProseReviewInput({
      conversation,
      confirmedFindings: [],
      findingsToJudge: [],
    });

    const historyLines = input
      .split("\n")
      .filter((line) => (/^[abc]+$/).test(line));
    expect(historyLines).toEqual(want);
  });

  it("[negative] ユーザーの発言が無い会話のとき、文脈のタグを入れない", () => {
    const input = toProseReviewInput({ conversation: { kind: "no-user-message", events: [{ kind: "response", text: "応答" }] }, confirmedFindings: [], findingsToJudge: [] });

    expect(input).toBe([
      "<conversation>",
      "<response-to-review>\n応答\n</response-to-review>",
      "</conversation>",
      "<textlint-findings-already-reported></textlint-findings-already-reported>",
      "<textlint-findings-to-judge></textlint-findings-to-judge>",
    ].join("\n"));
  });
});

describe("toVerificationReviewInput", () => {
  it("[positive] 最後の応答だけを最終応答のタグで囲み、それより前の応答を応答のタグで囲み、ツールの入力と結果を呼び出しのタグに入れ、確定した指摘だけを続ける", () => {
    const conversation: Conversation = {
      kind: "after-user-message",
      userMessageLine: 0,
      history: [],
      events: [
        { kind: "user-message", text: "依頼" },
        { kind: "response", text: "途中です。" },
        { kind: "tool-call", callId: "c1", name: "Bash", input: "{}", result: "ok" },
        { kind: "tool-call", callId: "c2", name: "Bash", input: "{\"command\":\"ls\"}", result: undefined },
        { kind: "response", text: "完了しました。\n\n```\nok\n```" },
      ],
    };

    const input = toVerificationReviewInput({ conversation, confirmedFindings: ["- line 1 \"完了しました。\": 指摘 (rule)"], findingsToJudge: ["- 候補"] });

    expect(input).toBe([
      "<conversation>",
      "<user-message>\n依頼\n</user-message>",
      "<response>\n途中です。\n</response>",
      "<tool-call name=\"Bash\">\n<input>\n{}\n</input>\n<result>\nok\n</result>\n</tool-call>",
      "<tool-call name=\"Bash\">\n<input>\n{\"command\":\"ls\"}\n</input>\n</tool-call>",
      "<final-response>\n完了しました。\n\n```\nok\n```\n</final-response>",
      "</conversation>",
      "<textlint-findings-already-reported>\n- line 1 \"完了しました。\": 指摘 (rule)\n</textlint-findings-already-reported>",
    ].join("\n"));
  });

  it.each([
    { name: "2000文字", result: "a".repeat(2000), want: "a".repeat(2000) },
    { name: "2001文字", result: `${"a".repeat(1000)}m${"z".repeat(1000)}`, want: `${"a".repeat(1000)}\n[1 characters omitted]\n${"z".repeat(1000)}` },
  ])("[positive] 結果が$nameのとき、先頭と末尾の1000文字ずつを残し、2000文字を超えた分を省いた文字数の表記に置き換える", ({ result, want }) => {
    const conversation: Conversation = { kind: "no-user-message", events: [{ kind: "tool-call", callId: "c1", name: "Bash", input: "{}", result }] };

    const input = toVerificationReviewInput({
      conversation,
      confirmedFindings: [],
      findingsToJudge: [],
    });

    expect(input).toBe([
      "<conversation>",
      `<tool-call name="Bash">\n<input>\n{}\n</input>\n<result>\n${want}\n</result>\n</tool-call>`,
      "</conversation>",
      "<textlint-findings-already-reported></textlint-findings-already-reported>",
    ].join("\n"));
  });

  it("[positive] 前のターンに応答があるとき、その最後の応答を会話の先頭に査読済みの応答のタグで入れる", () => {
    const conversation: Conversation = {
      kind: "after-user-message",
      userMessageLine: 2,
      history: [{ kind: "user-message", text: "前の依頼" }, { kind: "response", text: "前の応答" }],
      events: [{ kind: "user-message", text: "依頼" }, { kind: "response", text: "完了しました。" }],
    };

    const input = toVerificationReviewInput({
      conversation,
      confirmedFindings: [],
      findingsToJudge: [],
    });

    expect(input).toBe([
      "<conversation>",
      "<reviewed-response>\n前の応答\n</reviewed-response>",
      "<user-message>\n依頼\n</user-message>",
      "<final-response>\n完了しました。\n</final-response>",
      "</conversation>",
      "<textlint-findings-already-reported></textlint-findings-already-reported>",
    ].join("\n"));
  });
});
