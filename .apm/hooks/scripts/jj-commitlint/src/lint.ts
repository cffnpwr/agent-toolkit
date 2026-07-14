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

type QualifiedConfig = Awaited<ReturnType<typeof load>>;

/**
 * commitlint設定を解決する。
 * まずlint対象リポジトリ(cwd)の設定を自動探索し、ルールが定義されていればそれを優先する。
 * 無ければ同梱依存の@cffnpwr/commitlint-configをデフォルトとしてextendsで解決する。
 * デフォルト解決時はcwdをこのファイルの位置に固定し、同梱node_modulesから解決する。
 */
const loadConfig = async (cwd: string): Promise<QualifiedConfig> => {
  const repo = await load({}, { cwd });
  if (Object.keys(repo.rules).length > 0) return repo;
  return load({ extends: ["@cffnpwr/commitlint-config"] }, { cwd: import.meta.dir });
};

/**
 * commitlintをメッセージに対して実行する。
 * 同梱した@commitlint/* のAPIを呼び、違反時はレポートをreportに入れる。
 * 設定はリポジトリ設定を優先し、無ければ同梱の@cffnpwr/commitlint-configを使う(loadConfig参照)。
 * ライブラリ・設定パッケージの未同期などのインフラ要因はunavailableとして扱う。
 */
export const runCommitlint = async (message: string, cwd: string): Promise<LintResult> => {
  try {
    const config = await loadConfig(cwd);
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
