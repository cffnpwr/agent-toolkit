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
      previousToolCalls: [],
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
      previousToolCalls: [],
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

  it("[positive] 作業中の発言・質問への回答を、会話と前のターンの文脈にそれぞれのタグで入れる", () => {
    const conversation: Conversation = {
      kind: "after-user-message",
      userMessageLine: 3,
      history: [{ kind: "user-message", text: "前の依頼" }, { kind: "user-answer", text: "前の質問: 前の回答" }, { kind: "additional-user-message", text: "前の追加の指示" }],
      previousToolCalls: [],
      events: [
        { kind: "user-message", text: "依頼" },
        { kind: "additional-user-message", text: "追加の指示" },
        { kind: "user-answer", text: "質問: 回答" },
        { kind: "response", text: "応答" },
      ],
    };

    const input = toProseReviewInput({
      conversation,
      confirmedFindings: [],
      findingsToJudge: [],
    });

    expect(input).toBe([
      "<earlier-turns>",
      "<user-message>\n前の依頼\n</user-message>",
      "<user-answer>\n前の質問: 前の回答\n</user-answer>",
      "<additional-user-message>\n前の追加の指示\n</additional-user-message>",
      "</earlier-turns>",
      "<conversation>",
      "<user-message>\n依頼\n</user-message>",
      "<additional-user-message>\n追加の指示\n</additional-user-message>",
      "<user-answer>\n質問: 回答\n</user-answer>",
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
    const conversation: Conversation = { kind: "after-user-message", userMessageLine: 3, history, previousToolCalls: [], events: [] };

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
      previousToolCalls: [],
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
    { name: "20000文字", result: "a".repeat(20_000), want: "a".repeat(20_000) },
    { name: "20001文字", result: `${"a".repeat(10_000)}m${"z".repeat(10_000)}`, want: `${"a".repeat(10_000)}\n[1 characters omitted]\n${"z".repeat(10_000)}` },
  ])("[positive] 結果が$nameのとき、先頭と末尾の10000文字ずつを残し、20000文字を超えた分を省いた文字数の表記に置き換える", ({ result, want }) => {
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
      previousToolCalls: [],
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

  it("[positive] 前のターンにツール呼び出しがあるとき、その名前・入力・結果を査読済みの応答より前に入れ、2000文字を超える入力と結果を省略する", () => {
    const conversation: Conversation = {
      kind: "after-user-message",
      userMessageLine: 3,
      history: [{ kind: "user-message", text: "前の依頼" }, { kind: "response", text: "前の応答" }],
      previousToolCalls: [
        { name: "Bash", input: "{\"command\":\"ls\"}", result: `${"b".repeat(1000)}m${"y".repeat(1000)}` },
        { name: "Write", input: `${"a".repeat(1000)}m${"z".repeat(1000)}`, result: undefined },
      ],
      events: [{ kind: "user-message", text: "依頼" }, { kind: "response", text: "完了しました。" }],
    };

    const input = toVerificationReviewInput({
      conversation,
      confirmedFindings: [],
      findingsToJudge: [],
    });

    expect(input).toBe([
      "<conversation>",
      [
        "<previous-turn-tool-calls>",
        `<tool-call name="Bash">\n<input>\n{"command":"ls"}\n</input>\n<result>\n${"b".repeat(1000)}\n[1 characters omitted]\n${"y".repeat(1000)}\n</result>\n</tool-call>`,
        `<tool-call name="Write">\n<input>\n${"a".repeat(1000)}\n[1 characters omitted]\n${"z".repeat(1000)}\n</input>\n</tool-call>`,
        "</previous-turn-tool-calls>",
      ].join("\n"),
      "<reviewed-response>\n前の応答\n</reviewed-response>",
      "<user-message>\n依頼\n</user-message>",
      "<final-response>\n完了しました。\n</final-response>",
      "</conversation>",
      "<textlint-findings-already-reported></textlint-findings-already-reported>",
    ].join("\n"));
  });

  it.each([
    { name: "合計40000文字", count: 10, want: "abcdefghij" },
    { name: "合計44000文字", count: 11, want: "bcdefghijk" },
  ])("[positive] 前のターンのツール呼び出しの入力と結果が$nameのとき、新しいものから40000文字に収まる分だけを入れる", ({ count, want }) => {
    const names = "abcdefghijk".slice(0, count);
    const conversation: Conversation = {
      kind: "after-user-message",
      userMessageLine: 1,
      history: [],
      previousToolCalls: [...names].map((name) => ({
        name,
        input: name.repeat(2000),
        result: name.toUpperCase().repeat(2000),
      })),
      events: [{ kind: "user-message", text: "依頼" }],
    };

    const input = toVerificationReviewInput({
      conversation,
      confirmedFindings: [],
      findingsToJudge: [],
    });

    expect(input).toBe([
      "<conversation>",
      [
        "<previous-turn-tool-calls>",
        ...[...want].map((name) => `<tool-call name="${name}">\n<input>\n${name.repeat(2000)}\n</input>\n<result>\n${name.toUpperCase().repeat(2000)}\n</result>\n</tool-call>`),
        "</previous-turn-tool-calls>",
      ].join("\n"),
      "<user-message>\n依頼\n</user-message>",
      "</conversation>",
      "<textlint-findings-already-reported></textlint-findings-already-reported>",
    ].join("\n"));
  });

  it.each([
    { name: "合計60000文字", count: 3, shortenedCount: 0 },
    { name: "合計80000文字", count: 4, shortenedCount: 1 },
  ])("[positive] 20000文字の結果が$nameのとき、合計60000文字に収まる新しい結果を残し、それより古い結果の先頭と末尾の1000文字ずつだけを残す", ({ count, shortenedCount }) => {
    const names = "abcd".slice(0, count);
    const conversation: Conversation = {
      kind: "no-user-message",
      events: [...names].map((name) => ({ kind: "tool-call", callId: name, name, input: "{}", result: name.repeat(20_000) })),
    };

    const input = toVerificationReviewInput({
      conversation,
      confirmedFindings: [],
      findingsToJudge: [],
    });

    expect(input).toBe([
      "<conversation>",
      ...[...names].map((name, index) => {
        const result = index < shortenedCount
          ? `${name.repeat(1000)}\n[18000 characters omitted]\n${name.repeat(1000)}`
          : name.repeat(20_000);

        return `<tool-call name="${name}">\n<input>\n{}\n</input>\n<result>\n${result}\n</result>\n</tool-call>`;
      }),
      "</conversation>",
      "<textlint-findings-already-reported></textlint-findings-already-reported>",
    ].join("\n"));
  });

});
