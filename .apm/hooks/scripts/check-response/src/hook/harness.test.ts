import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import * as fsPromises from "node:fs/promises";
import * as os from "node:os";

import { detectHarness, HarnessDetectionError } from "./harness.ts";

describe("detectHarness", () => {
  const savedHarness = process.env.CHECK_RESPONSE_HARNESS;

  beforeEach(() => {
    delete process.env.CHECK_RESPONSE_HARNESS;
  });

  afterEach(() => {
    mock.restore();
    if (savedHarness === undefined) {
      delete process.env.CHECK_RESPONSE_HARNESS;
    } else {
      process.env.CHECK_RESPONSE_HARNESS = savedHarness;
    }
  });

  it.each(["claude", "codex"] as const)("[positive] CHECK_RESPONSE_HARNESSが%sのとき、祖先をたどらずにその値を返す", async (override) => {
    process.env.CHECK_RESPONSE_HARNESS = override;
    const spawn = spyOn(Bun, "spawn").mockImplementation((() => {
      throw new Error("unexpected call");
    }) as never);
    const readFile = spyOn(fsPromises, "readFile").mockImplementation((() => {
      throw new Error("unexpected call");
    }) as never);

    const harness = await detectHarness();

    expect(harness.unwrap()).toBe(override);
    expect(spawn.mock.calls).toEqual([]);
    expect(readFile.mock.calls).toEqual([]);
  });

  it("[negative] CHECK_RESPONSE_HARNESSが不正な値のとき、祖先をたどらずにHarnessDetectionErrorを返す", async () => {
    process.env.CHECK_RESPONSE_HARNESS = "gemini";
    const spawn = spyOn(Bun, "spawn").mockImplementation((() => {
      throw new Error("unexpected call");
    }) as never);
    const readFile = spyOn(fsPromises, "readFile").mockImplementation((() => {
      throw new Error("unexpected call");
    }) as never);

    const harness = await detectHarness();

    expect(harness.unwrapErr()).toBeInstanceOf(HarnessDetectionError);
    expect(spawn.mock.calls).toEqual([]);
    expect(readFile.mock.calls).toEqual([]);
  });

  it("[positive] macOSで祖先にパス付きのclaudeがあるとき、psで親をたどってclaudeを返す", async () => {
    process.env.CHECK_RESPONSE_HARNESS = "";
    const psOutputs = new Map([[String(process.pid), "  50 /bin/sh\n"], ["50", "  40 /opt/homebrew/bin/claude\n"]]);
    spyOn(os, "platform").mockReturnValue("darwin");
    const spawn = spyOn(Bun, "spawn").mockImplementation(((args: string[]) => ({
      stdout: new Response(psOutputs.get(args[4] ?? "") ?? "").body,
      exited: Promise.resolve(0),
    })) as never);
    const readFile = spyOn(fsPromises, "readFile").mockImplementation((() => {
      throw new Error("unexpected call");
    }) as never);

    const harness = await detectHarness();

    expect(harness.unwrap()).toBe("claude");
    expect(spawn.mock.calls).toEqual([
      [["ps", "-o", "ppid=,comm=", "-p", String(process.pid)], { stdout: "pipe", stderr: "ignore" }],
      [["ps", "-o", "ppid=,comm=", "-p", "50"], { stdout: "pipe", stderr: "ignore" }],
    ]);
    expect(readFile.mock.calls).toEqual([]);
  });

  it.each([
    { name: "psが失敗した", output: "  50 /bin/sh\n", exitCode: 1 },
    { name: "親のpidが整数でない", output: "abc /bin/sh\n", exitCode: 0 },
    { name: "pid 1に達した", output: "  1 /bin/sh\n", exitCode: 0 },
  ])("[negative] macOSで$nameときHarnessDetectionErrorを返す", async ({ output, exitCode }) => {
    spyOn(os, "platform").mockReturnValue("darwin");
    const spawn = spyOn(Bun, "spawn").mockImplementation((() => ({
      stdout: new Response(output).body,
      exited: Promise.resolve(exitCode),
    })) as never);
    const readFile = spyOn(fsPromises, "readFile").mockImplementation((() => {
      throw new Error("unexpected call");
    }) as never);

    const harness = await detectHarness();

    expect(harness.unwrapErr()).toBeInstanceOf(HarnessDetectionError);
    expect(spawn.mock.calls).toEqual([[["ps", "-o", "ppid=,comm=", "-p", String(process.pid)], { stdout: "pipe", stderr: "ignore" }]]);
    expect(readFile.mock.calls).toEqual([]);
  });

  it("[positive] Linuxで祖先にcodexがあるとき、procfsで親をたどってcodexを返す", async () => {
    const files = new Map([
      [`/proc/${process.pid}/stat`, `${process.pid} (my (sh)) S 50 1 1 0`],
      [`/proc/${process.pid}/comm`, "sh\n"],
      ["/proc/50/stat", "50 (codex) S 1 50 50 0"],
      ["/proc/50/comm", "codex\n"],
    ]);
    spyOn(os, "platform").mockReturnValue("linux");
    const spawn = spyOn(Bun, "spawn").mockImplementation((() => {
      throw new Error("unexpected call");
    }) as never);
    const readFile = spyOn(fsPromises, "readFile").mockImplementation((async (path: string) => files.get(path)) as never);

    const harness = await detectHarness();

    expect(harness.unwrap()).toBe("codex");
    expect(spawn.mock.calls).toEqual([]);
    expect(readFile.mock.calls).toEqual([
      [`/proc/${process.pid}/stat`, "utf8"],
      [`/proc/${process.pid}/comm`, "utf8"],
      ["/proc/50/stat", "utf8"],
      ["/proc/50/comm", "utf8"],
    ]);
  });

  it.each([
    { name: "statもcommも無い", stat: undefined, comm: undefined },
    { name: "commだけが無い", stat: "1 (sh) S 50 1 1 0", comm: undefined },
    { name: "statの親のpidが整数でない", stat: "1 (sh) S x 1 1 0", comm: "sh\n" },
    { name: "commが空", stat: "1 (sh) S 50 1 1 0", comm: "\n" },
  ])("[negative] Linuxでprocfsの$nameときHarnessDetectionErrorを返す", async ({ stat, comm }) => {
    const files = new Map([[`/proc/${process.pid}/stat`, stat], [`/proc/${process.pid}/comm`, comm]]);
    spyOn(os, "platform").mockReturnValue("linux");
    const spawn = spyOn(Bun, "spawn").mockImplementation((() => {
      throw new Error("unexpected call");
    }) as never);
    const readFile = spyOn(fsPromises, "readFile").mockImplementation((async (path: string) => {
      const content = files.get(path);
      if (content === undefined) {
        throw new Error("ENOENT");
      }

      return content;
    }) as never);

    const harness = await detectHarness();

    expect(harness.unwrapErr()).toBeInstanceOf(HarnessDetectionError);
    expect(spawn.mock.calls).toEqual([]);
    expect(readFile.mock.calls).toEqual([[`/proc/${process.pid}/stat`, "utf8"], [`/proc/${process.pid}/comm`, "utf8"]]);
  });

  it("[negative] 対応していないOSのとき、プロセス情報を読まずにHarnessDetectionErrorを返す", async () => {
    spyOn(os, "platform").mockReturnValue("win32");
    const spawn = spyOn(Bun, "spawn").mockImplementation((() => {
      throw new Error("unexpected call");
    }) as never);
    const readFile = spyOn(fsPromises, "readFile").mockImplementation((() => {
      throw new Error("unexpected call");
    }) as never);

    const harness = await detectHarness();

    expect(harness.unwrapErr()).toBeInstanceOf(HarnessDetectionError);
    expect(spawn.mock.calls).toEqual([]);
    expect(readFile.mock.calls).toEqual([]);
  });
});
