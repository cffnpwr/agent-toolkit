import { appendFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { appDirOf } from "./xdg.ts";

const LOG_FILE_NAME = "log.jsonl";

// ログファイルの大きさの上限(バイト)
const MAX_LOG_SIZE = 20 * 1024 * 1024;

export const logPathOf = (): string => join(appDirOf("XDG_STATE_HOME", join(".local", "state")), LOG_FILE_NAME);

const sizeOf = async (
  path: string,
): Promise<number> => stat(path).then(({ size }) => size, () => 0);

const dropOlderHalf = async (path: string): Promise<void> => {
  const lines = (await readFile(path, "utf8")).split("\n").filter((line) => line !== "");
  await writeFile(path, lines.slice(Math.floor(lines.length / 2)).map((line) => `${line}\n`).join(""));
};

export const appendLog = async (entry: unknown): Promise<void> => {
  const path = logPathOf();
  try {
    await mkdir(dirname(path), { recursive: true });
    // 上限を超えた場合は、古い半分の行を削除してから追記
    if (await sizeOf(path) > MAX_LOG_SIZE) {
      await dropOlderHalf(path);
    }
    await appendFile(path, `${JSON.stringify(entry)}\n`);
  } catch {
    // ログの書き込みの失敗で検査の結果を変えないため、失敗は無視
  }
};
