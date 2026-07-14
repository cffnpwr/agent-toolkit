import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { runCommitlint } from "./lint.ts";

describe("runCommitlint", () => {
  // commitlint設定を持たないcwd。同梱デフォルト設定へのフォールバックを検証する。
  let noConfigDir: string;
  // commitlint設定を持つcwd。リポジトリ設定の優先を検証する。
  let repoDir: string;

  beforeAll(() => {
    noConfigDir = mkdtempSync(join(tmpdir(), "jj-commitlint-noconfig-"));
    repoDir = mkdtempSync(join(tmpdir(), "jj-commitlint-repo-"));
    // customのみ許可し、絵文字要求など同梱デフォルトの規則は課さない。
    writeFileSync(
      join(repoDir, ".commitlintrc.json"),
      JSON.stringify({ rules: { "type-enum": [2, "always", ["custom"]] } }),
    );
  });

  afterAll(() => {
    rmSync(noConfigDir, { recursive: true, force: true });
    rmSync(repoDir, { recursive: true, force: true });
  });

  test("[positive] リポジトリ設定が無ければ同梱デフォルトを使い、breaking change記法(!)は違反にしない", async () => {
    const result = await runCommitlint("feat!: :sparkles: add breaking feature", noConfigDir);
    expect(result).toEqual({ ok: true, report: "", unavailable: false });
  });

  test("[negative] 同梱デフォルトで許可されていないtypeは違反として報告する", async () => {
    const result = await runCommitlint("unknown: :sparkles: do something", noConfigDir);
    expect(result.ok).toBe(false);
    expect(result.unavailable).toBe(false);
  });

  test("[positive] リポジトリ設定があればそれを優先し、設定内のtypeは通過させる", async () => {
    const result = await runCommitlint("custom: do something", repoDir);
    expect(result).toEqual({ ok: true, report: "", unavailable: false });
  });

  test("[negative] リポジトリ設定を優先し、同梱デフォルトでは通るtypeでもenum外なら違反にする", async () => {
    const result = await runCommitlint("feat: :sparkles: do something", repoDir);
    expect(result.ok).toBe(false);
    expect(result.unavailable).toBe(false);
  });
});
