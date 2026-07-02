/**
 * prefer-jj hook本体。
 *
 * HarnessのPreToolUse入力をstdinで受け取る。
 * jjが使えるリポジトリで、jj相当のあるgit操作を実行前にブロックし、対応するjjコマンドへ誘導する。
 * jjリポジトリ判定とセッション全体の無効化(環境変数PREFER_JJ_DISABLE)は起動スクリプトが行う。
 *
 * 出力プロトコル(全Harness共通):
 * - ブロック: exit 2 + stderr(Claude/Codex/GeminiはAgentにフィードバック)
 * - 実行不可(fail-open): exit 1 + stderr(全Harnessで非ブロック警告)
 * - 通過・対象外: exit 0・無出力
 */

import type { Json } from "./types.ts";

import { classify } from "./classify.ts";
import { parseGitCalls } from "./command.ts";
import { extractCommand, isObject } from "./input.ts";

// ブロックフィードバック。
// 全Harnessがexit 2 + stderrをブロック/フィードバックとして扱う。
const block = (reason: string): never => {
  process.stderr.write(`${reason}\n`);
  process.exit(2);
};

const run = async (): Promise<void> => {
  const parsed: unknown = JSON.parse(await Bun.stdin.text());
  if (!isObject(parsed)) return;
  const input: Json = parsed;

  const command = extractCommand(input);
  if (command === undefined) return;

  // ブロック対象のgit呼び出しごとに誘導行を集める。同一サブコマンドの重複は除外する。
  const suggestions: string[] = [];
  for (const call of parseGitCalls(command)) {
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
