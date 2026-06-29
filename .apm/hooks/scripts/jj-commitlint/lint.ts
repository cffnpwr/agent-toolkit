import { spawnSync } from "node:child_process";

import type { LintResult } from "./types.ts";

import { COMMITLINT_PKG } from "./config.ts";

// 対象revの説明を読み、取得できなければundefinedを返す。
export const readDescription = (rev: string, cwd: string): string | undefined => {
  const res = spawnSync(
    "jj",
    ["log", "--no-graph", "--ignore-working-copy", "-r", rev, "-T", "description"],
    { cwd, encoding: "utf8" },
  );
  if (res.status !== 0 || typeof res.stdout !== "string") return undefined;
  // 末尾の改行のみ除去し、本文の改行は保持する。
  return res.stdout.replace(/\n$/, "");
};

/**
 * commitlintをメッセージに対して実行する。
 * 違反時はレポートをreportに入れる。
 * stdoutが空で非ゼロ終了なら、パッケージ取得失敗等のインフラ要因としてunavailableとする。
 */
export const runCommitlint = (message: string, configPath: string): LintResult => {
  // --bun でbunランタイムを強制し、commitlintのnode shebangでnodeを呼ばないようにする。
  const res = spawnSync("bun", ["x", "--bun", COMMITLINT_PKG, "--config", configPath], {
    input: message,
    encoding: "utf8",
  });
  if (res.error) return { ok: false, report: "", unavailable: true };
  const stdout = res.stdout.trim();
  const stderr = res.stderr.trim();
  if (res.status === 0) return { ok: true, report: "", unavailable: false };
  if (!stdout) return { ok: false, report: stderr, unavailable: true };
  return { ok: false, report: stdout, unavailable: false };
};
