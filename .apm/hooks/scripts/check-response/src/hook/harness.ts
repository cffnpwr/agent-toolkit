import { readFile } from "node:fs/promises";
import { platform } from "node:os";
import { basename } from "node:path";

import type { Result } from "@cffnpwr/result-ts";

import { Err, Ok } from "@cffnpwr/result-ts";
import { type } from "arktype";
import { match, P } from "ts-pattern";

const ROOT_PID = 1;

const PS_COLUMNS = /^\s*(?<ppid>\S+)\s+(?<comm>.*\S)\s*$/;

export const harness = type("'claude' | 'codex'");

const processInfo = type({
  ppid: type("string.integer.parse").to("number.integer >= 0"),
  comm: "string > 0",
});

export type Harness = typeof harness.infer;

type ProcessInfo = typeof processInfo.infer;

type ReadProcess = (pid: number) => Promise<ProcessInfo | undefined>;

export class HarnessDetectionError extends Error {
  override readonly name = "HarnessDetectionError" as const;

  constructor(reason: string) {
    super(`Cannot tell whether Claude Code or Codex runs this hook: ${reason}.`);
  }
}

const toProcessInfo = (
  ppid: string | undefined,
  comm: string | undefined,
): ProcessInfo | undefined => {
  const info = processInfo({ ppid, comm });

  return info instanceof type.errors ? undefined : info;
};

const runPs = async (pid: number): Promise<string> => {
  const child = Bun.spawn(["ps", "-o", "ppid=,comm=", "-p", String(pid)], { stdout: "pipe", stderr: "ignore" });
  const stdout = await child.stdout.text();

  return await child.exited === 0 ? stdout : "";
};

const readByPs = async (pid: number): Promise<ProcessInfo | undefined> => {
  const groups = PS_COLUMNS.exec(await runPs(pid))?.groups;

  return toProcessInfo(groups?.ppid, groups?.comm);
};

// プロセスが無い場合はファイルも無いため、undefined
const readProcFile = async (path: string): Promise<string | undefined> => readFile(path, "utf8").catch(() => undefined);

const readByProcfs = async (pid: number): Promise<ProcessInfo | undefined> => {
  const stat = await readProcFile(`/proc/${pid}/stat`);
  const comm = await readProcFile(`/proc/${pid}/comm`);

  return toProcessInfo(stat?.slice(stat.lastIndexOf(")") + 1).trim().split(/\s+/)[1], comm?.trim());
};

const findAncestorHarness = async (
  pid: number,
  readProcess: ReadProcess,
): Promise<Harness | undefined> => {
  if (pid <= ROOT_PID) {
    return undefined;
  }
  const info = await readProcess(pid);
  if (info === undefined) {
    return undefined;
  }
  const ancestorHarness = harness(basename(info.comm));

  return ancestorHarness instanceof type.errors
    ? findAncestorHarness(info.ppid, readProcess)
    : ancestorHarness;
};

const harnessOf = (
  override: string,
): Result<Harness, HarnessDetectionError> => {
  const namedHarness = harness(override);

  return namedHarness instanceof type.errors
    ? Err(new HarnessDetectionError(`CHECK_RESPONSE_HARNESS is "${override}", but it accepts only "claude" or "codex"`))
    : Ok(namedHarness);
};

const readProcessOf = (
  os: ReturnType<typeof platform>,
): ReadProcess | undefined => match(os)
  .with("darwin", () => readByPs)
  .with("linux", () => readByProcfs)
  .otherwise(() => undefined);

const detectFromAncestors = async (): Promise<
  Result<Harness, HarnessDetectionError>
> => {
  const os = platform();
  const readProcess = readProcessOf(os);
  if (readProcess === undefined) {
    return Err(new HarnessDetectionError(`reading the process tree on ${os} is not supported, and CHECK_RESPONSE_HARNESS is not set`));
  }
  const ancestorHarness = await findAncestorHarness(process.pid, readProcess);

  return ancestorHarness === undefined
    ? Err(new HarnessDetectionError("no ancestor process is named claude or codex, and CHECK_RESPONSE_HARNESS is not set"))
    : Ok(ancestorHarness);
};

export const detectHarness = async (): Promise<
  Result<Harness, HarnessDetectionError>
> => match(process.env.CHECK_RESPONSE_HARNESS)
  .with(P.union(undefined, ""), async () => detectFromAncestors())
  .with(P.string, async (override) => harnessOf(override))
  .exhaustive();
