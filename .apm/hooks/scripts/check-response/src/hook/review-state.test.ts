import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import * as fsPromises from "node:fs/promises";
import * as os from "node:os";

import type { Conversation } from "../conversation/conversation.ts";
import type { Finding } from "../llm-review/findings.ts";

import {
  blockStateOf,
  loadRecord,
  nextRecord,
  recordPathOf,
  saveRecord,
  withoutReviewed,
} from "./review-state.ts";

describe("recordPathOf", () => {
  const savedCacheHome = process.env.XDG_CACHE_HOME;

  afterEach(() => {
    mock.restore();
    if (savedCacheHome === undefined) {
      delete process.env.XDG_CACHE_HOME;
    } else {
      process.env.XDG_CACHE_HOME = savedCacheHome;
    }
  });

  it.each([
    { name: "XDG_CACHE_HOMEがある", cacheHome: "/cache", want: "/cache/check-response/s1" },
    { name: "XDG_CACHE_HOMEが空", cacheHome: "", want: "/home/u/.cache/check-response/s1" },
    { name: "XDG_CACHE_HOMEが無い", cacheHome: undefined, want: "/home/u/.cache/check-response/s1" },
  ])("[positive] $nameとき$wantを返す", ({ cacheHome, want }) => {
    if (cacheHome === undefined) {
      delete process.env.XDG_CACHE_HOME;
    } else {
      process.env.XDG_CACHE_HOME = cacheHome;
    }
    spyOn(os, "homedir").mockReturnValue("/home/u");

    const path = recordPathOf("s1");

    expect(path).toBe(want);
  });
});

describe("loadRecord", () => {
  afterEach(() => {
    mock.restore();
  });

  it("[positive] 差し戻しの記録が無い以前の形式の記録があるとき、その内容を返す", async () => {
    const readFile = spyOn(fsPromises, "readFile").mockResolvedValue("{\"reviewed\":{\"userMessageLine\":4,\"responseCount\":2}}" as never);

    const record = await loadRecord("/cache/s1");

    expect(record).toEqual({
      reviewed: { userMessageLine: 4, responseCount: 2 },
    });
    expect(readFile.mock.calls).toEqual([["/cache/s1", "utf8"]]);
  });

  it("[positive] 差し戻しの記録を含む記録があるとき、その内容を返す", async () => {
    const block = { userMessageLine: null, count: 2, findings: [{ rule: "calque", quote: "安全側に倒す", reason: "直訳", suggestion: "安全を優先する" }] };
    const readFile = spyOn(fsPromises, "readFile").mockResolvedValue(JSON.stringify({ reviewed: { userMessageLine: 4, responseCount: 2 }, block }) as never);

    const record = await loadRecord("/cache/s1");

    expect(record).toEqual({
      reviewed: { userMessageLine: 4, responseCount: 2 },
      block,
    });
    expect(readFile.mock.calls).toEqual([["/cache/s1", "utf8"]]);
  });

  it("[negative] 記録が無いとき空の記録を返す", async () => {
    const readFile = spyOn(fsPromises, "readFile").mockRejectedValue(new Error("ENOENT"));

    const record = await loadRecord("/cache/s1");

    expect(record).toEqual({});
    expect(readFile.mock.calls).toEqual([["/cache/s1", "utf8"]]);
  });

  it.each([
    { name: "JSONとして読めない", fileText: "{" },
    { name: "形式が異なる", fileText: "{\"reviewed\":{\"userMessageLine\":-1,\"responseCount\":0}}" },
    { name: "差し戻しの回数が0", fileText: "{\"block\":{\"userMessageLine\":0,\"count\":0,\"findings\":[]}}" },
  ])("[negative] 記録が$nameとき空の記録を返す", async ({ fileText }) => {
    const readFile = spyOn(fsPromises, "readFile").mockResolvedValue(fileText as never);

    const record = await loadRecord("/cache/s1");

    expect(record).toEqual({});
    expect(readFile.mock.calls).toEqual([["/cache/s1", "utf8"]]);
  });
});

describe("saveRecord", () => {
  afterEach(() => {
    mock.restore();
  });

  it("[positive] ディレクトリを作ってからJSONで書き込む", async () => {
    const mkdir = spyOn(fsPromises, "mkdir").mockResolvedValue(undefined);
    const writeFile = spyOn(fsPromises, "writeFile").mockResolvedValue(undefined);

    await saveRecord("/cache/check-response/s1", { reviewed: { userMessageLine: 0, responseCount: 1 } });

    expect(mkdir.mock.calls).toEqual([["/cache/check-response", { recursive: true }]]);
    expect(writeFile.mock.calls).toEqual([["/cache/check-response/s1", "{\"reviewed\":{\"userMessageLine\":0,\"responseCount\":1}}\n"]]);
    expect(mkdir.mock.invocationCallOrder[0]).toBeLessThan(
      writeFile.mock.invocationCallOrder[0] ?? 0,
    );
  });
});

describe("withoutReviewed", () => {
  it("[positive] 記録とユーザーの発言の行が一致するとき、記録した数の応答を先頭から除く", () => {
    const conversation = {
      kind: "after-user-message" as const,
      userMessageLine: 4,
      history: [{ kind: "response" as const, text: "前の応答" }],
      events: [
        { kind: "user-message" as const, text: "依頼" },
        { kind: "response" as const, text: "1つ目" },
        { kind: "tool-call" as const, callId: "c1", name: "Bash", input: "{}", result: "ok" },
        { kind: "response" as const, text: "2つ目" },
        { kind: "hook-feedback" as const, text: "差し戻し" },
        { kind: "response" as const, text: "3つ目" },
      ],
    };

    const result = withoutReviewed(conversation, {
      reviewed: { userMessageLine: 4, responseCount: 2 },
    });

    expect(result).toEqual({
      kind: "after-user-message" as const,
      userMessageLine: 4,
      history: [{ kind: "response", text: "前の応答" }],
      events: [
        { kind: "user-message", text: "依頼" },
        { kind: "tool-call", callId: "c1", name: "Bash", input: "{}", result: "ok" },
        { kind: "hook-feedback", text: "差し戻し" },
        { kind: "response", text: "3つ目" },
      ],
    });
  });

  it.each([
    { name: "ユーザーの発言の行が異なる", record: { reviewed: { userMessageLine: 1, responseCount: 2 } } },
    { name: "記録が無い", record: {} },
  ])("[negative] $nameとき応答を除かない", ({ record }) => {
    const conversation = {
      kind: "after-user-message" as const,
      userMessageLine: 4,
      history: [],
      events: [{ kind: "user-message" as const, text: "依頼" }, { kind: "response" as const, text: "応答" }],
    };

    const result = withoutReviewed(conversation, record);

    expect(result).toEqual({
      kind: "after-user-message" as const,
      userMessageLine: 4,
      history: [],
      events: [{ kind: "user-message", text: "依頼" }, { kind: "response", text: "応答" }],
    });
  });
  it("[negative] 会話にユーザーの発言が無いとき、記録があっても応答を除かない", () => {
    const conversation = { kind: "no-user-message" as const, events: [{ kind: "response" as const, text: "応答" }] };

    const result = withoutReviewed(conversation, {
      reviewed: { userMessageLine: 0, responseCount: 1 },
    });

    expect(result).toEqual({ kind: "no-user-message", events: [{ kind: "response", text: "応答" }] });
  });
});

interface BlockRecord {
  userMessageLine: number | null;
  count: number;
  findings: Finding[];
}

describe("blockStateOf", () => {
  const findings = [{ rule: "calque", quote: "安全側に倒す", reason: "直訳", suggestion: "安全を優先する" }];

  it.each([
    { name: "ユーザーの発言の行が記録と一致する", stopHookActive: false },
    { name: "ユーザーの発言の行が記録と一致し、差し戻しを受けて応答を続けている", stopHookActive: true },
  ])("[positive] $nameとき、差し戻した回数と指摘を返す", ({ stopHookActive }) => {
    const conversation = { kind: "after-user-message" as const, userMessageLine: 4, history: [], events: [] };

    const record = { block: { userMessageLine: 4, count: 2, findings } };

    const state = blockStateOf(conversation, record, stopHookActive);

    expect(state).toEqual({ count: 2, findings });
  });

  it("[positive] ユーザーの発言が無い会話で、記録の行もnullで、差し戻しを受けて応答を続けているとき、差し戻した回数と指摘を返す", () => {
    const state = blockStateOf({ kind: "no-user-message", events: [] }, { block: { userMessageLine: null, count: 1, findings } }, true);

    expect(state).toEqual({ count: 1, findings });
  });

  it.each<{
    name: string;
    conversation: Conversation;
    block: BlockRecord | undefined;
    stopHookActive: boolean;
  }>([
    { name: "差し戻しの記録が無い", conversation: { kind: "after-user-message", userMessageLine: 4, history: [], events: [] }, block: undefined, stopHookActive: true },
    { name: "ユーザーの発言の行が記録と異なる", conversation: { kind: "after-user-message", userMessageLine: 6, history: [], events: [] }, block: { userMessageLine: 4, count: 1, findings }, stopHookActive: true },
    { name: "ユーザーの発言が無く、差し戻しを受けた応答でない", conversation: { kind: "no-user-message", events: [] }, block: { userMessageLine: null, count: 1, findings }, stopHookActive: false },
    { name: "ユーザーの発言が無く、記録の行が数値", conversation: { kind: "no-user-message", events: [] }, block: { userMessageLine: 0, count: 1, findings }, stopHookActive: true },
  ])("[negative] $nameとき、undefinedを返す", ({ conversation, block, stopHookActive }) => {
    const state = blockStateOf(conversation, { block }, stopHookActive);

    expect(state).toBeUndefined();
  });
});

describe("nextRecord", () => {
  it("[positive] ユーザーの発言があり差し戻しの状態があるとき、その行と応答の数と差し戻しの状態を記録する", () => {
    const conversation = {
      kind: "after-user-message" as const,
      userMessageLine: 4,
      history: [],
      events: [{ kind: "user-message" as const, text: "依頼" }, { kind: "response" as const, text: "1つ目" }, { kind: "response" as const, text: "2つ目" }],
    };
    const findings = [{ rule: "calque", quote: "安全側に倒す", reason: "直訳", suggestion: "安全を優先する" }];

    const record = nextRecord(conversation, { count: 1, findings });

    expect(record).toEqual({
      reviewed: { userMessageLine: 4, responseCount: 2 },
      block: { userMessageLine: 4, count: 1, findings },
    });
  });

  it("[negative] ユーザーの発言が無く差し戻しの状態も無いとき、検査済みの応答も差し戻しも記録しない", () => {
    const record = nextRecord({ kind: "no-user-message", events: [{ kind: "response", text: "応答" }] }, undefined);

    expect(record).toEqual({ reviewed: undefined, block: undefined });
  });

  it("[positive] ユーザーの発言が無く差し戻しの状態があるとき、行をnullにして差し戻しの状態だけを記録する", () => {
    const record = nextRecord({ kind: "no-user-message", events: [{ kind: "response", text: "応答" }] }, { count: 1, findings: [] });

    expect(record).toEqual({
      reviewed: undefined,
      block: { userMessageLine: null, count: 1, findings: [] },
    });
  });
});
