import { spawnSync } from "node:child_process";

import type { ParserOptions } from "conventional-commits-parser";

import lint from "@commitlint/lint";
import load from "@commitlint/load";

import type { LintResult } from "./types.ts";

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
 * 同梱した@commitlint/* のAPIを呼び、違反時はレポートをreportに入れる。
 * 設定は同梱依存の@cffnpwr/commitlint-configをextendsで解決する。
 * cwdをこのファイルの位置に固定し、実行時cwd(ユーザープロジェクト)ではなく
 * 同梱node_modulesからパッケージを解決する。
 * ライブラリ・設定パッケージの未同期などのインフラ要因はunavailableとして扱う。
 */
export const runCommitlint = async (message: string): Promise<LintResult> => {
  try {
    const config = await load(
      { extends: ["@cffnpwr/commitlint-config"] },
      { cwd: import.meta.dir },
    );
    const result = await lint(message, config.rules, {
      plugins: config.plugins,
      ignores: config.ignores,
      defaultIgnores: config.defaultIgnores,
      helpUrl: config.helpUrl,
      parserOpts: config.parserPreset?.parserOpts as ParserOptions | undefined,
    });
    if (result.valid) return { ok: true, report: "", unavailable: false };
    const report = [
      ...result.errors.map((o) => `error: ${o.message} [${o.name}]`),
      ...result.warnings.map((o) => `warn: ${o.message} [${o.name}]`),
    ].join("\n");
    return { ok: false, report, unavailable: false };
  } catch {
    return { ok: false, report: "", unavailable: true };
  }
};
