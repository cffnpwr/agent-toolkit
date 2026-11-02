import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import * as fsPromises from "node:fs/promises";
import * as os from "node:os";

import { appendLog, logPathOf } from "./log.ts";

const savedStateHome = process.env.XDG_STATE_HOME;

const restoreStateHome = (): void => {
  if (savedStateHome === undefined) {
    delete process.env.XDG_STATE_HOME;
  } else {
    process.env.XDG_STATE_HOME = savedStateHome;
  }
};

describe("logPathOf", () => {
  afterEach(() => {
    mock.restore();
    restoreStateHome();
  });

  it.each([
    { name: "XDG_STATE_HOMEがある", stateHome: "/state", want: "/state/check-response/log.jsonl" },
    { name: "XDG_STATE_HOMEが空", stateHome: "", want: "/home/u/.local/state/check-response/log.jsonl" },
    { name: "XDG_STATE_HOMEが無い", stateHome: undefined, want: "/home/u/.local/state/check-response/log.jsonl" },
  ])("[positive] $nameとき$wantを返す", ({ stateHome, want }) => {
    if (stateHome === undefined) {
      delete process.env.XDG_STATE_HOME;
    } else {
      process.env.XDG_STATE_HOME = stateHome;
    }
    spyOn(os, "homedir").mockReturnValue("/home/u");

    const path = logPathOf();

    expect(path).toBe(want);
  });
});

describe("appendLog", () => {
  beforeEach(() => {
    process.env.XDG_STATE_HOME = "/state";
  });

  afterEach(() => {
    mock.restore();
    restoreStateHome();
  });

  it("[positive] ログが20 MiB以下のとき、ディレクトリを作ってから1行追記する", async () => {
    const mkdir = spyOn(fsPromises, "mkdir").mockResolvedValue(undefined);
    spyOn(fsPromises, "stat").mockResolvedValue({ size: 20 * 1024 * 1024 } as never);
    const readFile = spyOn(fsPromises, "readFile").mockImplementation((() => {
      throw new Error("unexpected call");
    }) as never);
    const writeFile = spyOn(fsPromises, "writeFile").mockImplementation((() => {
      throw new Error("unexpected call");
    }) as never);
    const appendFile = spyOn(fsPromises, "appendFile").mockResolvedValue(undefined);

    await appendLog({ outcome: "pass" });

    expect(mkdir.mock.calls).toEqual([["/state/check-response", { recursive: true }]]);
    expect(readFile.mock.calls).toEqual([]);
    expect(writeFile.mock.calls).toEqual([]);
    expect(appendFile.mock.calls).toEqual([["/state/check-response/log.jsonl", "{\"outcome\":\"pass\"}\n"]]);
  });

  it("[positive] ログが20 MiBを超えるとき、古い半分の行を消してから追記する", async () => {
    spyOn(fsPromises, "mkdir").mockResolvedValue(undefined);
    spyOn(fsPromises, "stat").mockResolvedValue({ size: (20 * 1024 * 1024) + 1 } as never);
    spyOn(fsPromises, "readFile").mockResolvedValue("{\"n\":1}\n{\"n\":2}\n{\"n\":3}\n{\"n\":4}\n{\"n\":5}\n" as never);
    const writeFile = spyOn(fsPromises, "writeFile").mockResolvedValue(undefined);
    const appendFile = spyOn(fsPromises, "appendFile").mockResolvedValue(undefined);

    await appendLog({ n: 6 });

    expect(writeFile.mock.calls).toEqual([["/state/check-response/log.jsonl", "{\"n\":3}\n{\"n\":4}\n{\"n\":5}\n"]]);
    expect(appendFile.mock.calls).toEqual([["/state/check-response/log.jsonl", "{\"n\":6}\n"]]);
    expect(writeFile.mock.invocationCallOrder[0]).toBeLessThan(
      appendFile.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("[positive] ログがまだ無いとき、消さずに追記する", async () => {
    spyOn(fsPromises, "mkdir").mockResolvedValue(undefined);
    spyOn(fsPromises, "stat").mockRejectedValue(new Error("ENOENT"));
    const writeFile = spyOn(fsPromises, "writeFile").mockImplementation((() => {
      throw new Error("unexpected call");
    }) as never);
    const appendFile = spyOn(fsPromises, "appendFile").mockResolvedValue(undefined);

    await appendLog({ n: 1 });

    expect(writeFile.mock.calls).toEqual([]);
    expect(appendFile.mock.calls).toEqual([["/state/check-response/log.jsonl", "{\"n\":1}\n"]]);
  });

  it("[negative] 書き込みに失敗したとき、例外を投げずに終わる", async () => {
    spyOn(fsPromises, "mkdir").mockRejectedValue(new Error("EACCES"));
    const appendFile = spyOn(fsPromises, "appendFile").mockResolvedValue(undefined);

    await appendLog({ n: 1 });

    expect(appendFile.mock.calls).toEqual([]);
  });
});
