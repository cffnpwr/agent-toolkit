/**
 * prefer-jj hook本体。
 *
 * HarnessのPreToolUse入力をstdinで受け取る。
 * jjが使えるリポジトリで、jj相当のあるgit操作を実行前にブロックし、対応するjjコマンドへ誘導する。
 * コマンド内のcd移動を畳み込み、各git呼び出しをその有効CWD基準で判定する。
 * 有効CWDごとにjjリポジトリか判定し、jjリポジトリのgit呼び出しだけをブロック対象にする。
 *
 * 出力プロトコル(全Harness共通):
 * - ブロック: exit 2 + stderr(Claude/Codex/GeminiはAgentにフィードバック)
 * - 実行不可(fail-open): exit 1 + stderr(全Harnessで非ブロック警告)
 * - 通過・対象外: exit 0・無出力
 */

import { spawnSync } from "node:child_process";

import type { Json } from "./types.ts";

import { resolveBaseCwd } from "../../shared/src/cdfold.ts";

import { classify } from "./classify.ts";
import { parseGitCalls } from "./command.ts";
import { extractCommand, isObject } from "./input.ts";

// ブロックフィードバック。
// 全Harnessがexit 2 + stderrをブロック/フィードバックとして扱う。
const block = (reason: string): never => {
  process.stderr.write(`${reason}\n`);
  process.exit(2);
};

// 有効CWDがjjリポジトリか判定する(ディレクトリごとに結果をキャッシュ)。
const jjRepoCache = new Map<string, boolean>();
const isJjRepo = (cwd: string): boolean => {
  const cached = jjRepoCache.get(cwd);
  if (cached !== undefined) return cached;
  const res = spawnSync("jj", ["root", "--ignore-working-copy"], { cwd });
  const ok = res.status === 0;
  jjRepoCache.set(cwd, ok);
  return ok;
};

const run = async (): Promise<void> => {
  const parsed: unknown = JSON.parse(await Bun.stdin.text());
  if (!isObject(parsed)) return;
  const input: Json = parsed;

  const command = extractCommand(input);
  if (command === undefined) return;

  const baseCwd = resolveBaseCwd(input.cwd);

  // ブロック対象のgit呼び出しごとに誘導行を集める。同一サブコマンドの重複は除外する。
  const suggestions: string[] = [];
  for (const call of parseGitCalls(command, baseCwd)) {
    // 有効CWDが不明、または非jjリポジトリのgit呼び出しは対象外(誤ブロックを避ける)。
    if (call.cwd === null || !isJjRepo(call.cwd)) continue;
    const suggestion = classify(call);
    if (suggestion === undefined) continue;
    const line = `  git ${call.subcommand} -> ${suggestion}`;
    if (!suggestions.includes(line)) suggestions.push(line);
  }
  if (suggestions.length === 0) return;

  block(
    "prefer-jj: this repository is managed by jj. Use jj instead of git:\n"
    + `${suggestions.join("\n")}\n`
    + "If git is really required here, prefix the command with PREFER_JJ_DISABLE=1 "
    + "(e.g. PREFER_JJ_DISABLE=1 git <subcommand> ...) to bypass this check once.",
  );
};

run().catch((err: unknown) => {
  process.stderr.write(`prefer-jj: ${String(err)}\n`);
  process.exit(1);
});
