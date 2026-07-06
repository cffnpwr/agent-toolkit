/**
 * command-chain-guard hook本体。
 *
 * HarnessのPreToolUse入力をstdinで受け取る。
 * 1回のシェルコマンド呼び出しに`&&`・`||`・`;`(改行含む)で複数コマンドを詰め込む操作を実行前にブロックし、
 * 1呼び出し1コマンドへの分割を促す。`|`(pipe)は対象外。
 *
 * 出力プロトコル(全Harness共通):
 * - ブロック: exit 2 + stderr(Claude/Codex/GeminiはAgentにフィードバック)
 * - 実行不可(fail-open): exit 1 + stderr(全Harnessで非ブロック警告)
 * - 通過・対象外: exit 0・無出力
 */

import type { ChainViolation } from "./types.ts";

import { findChainViolations } from "./command.ts";
import { extractCommand, isObject } from "./input.ts";

// ブロックフィードバック。
// 全Harnessがexit 2 + stderrをブロック/フィードバックとして扱う。
const block = (reason: string): never => {
  process.stderr.write(`${reason}\n`);
  process.exit(2);
};

const describe = (violation: ChainViolation): string => `  ${violation.label}: ${violation.snippet}`;

const run = async (): Promise<void> => {
  const parsed: unknown = JSON.parse(await Bun.stdin.text());
  if (!isObject(parsed)) return;

  const command = extractCommand(parsed);
  if (command === undefined) return;

  const violations = findChainViolations(command);
  if (violations.length === 0) return;

  block(
    "command-chain-guard: this call chains multiple commands with &&, || or ; (or a newline). "
    + "Split it into separate tool calls, one command per call:\n"
    + `${violations.map(describe).join("\n")}\n`
    + "Exceptions: a single leading `cd <dir> &&` and a single `command -v X || <fallback>` "
    + "existence check are allowed.\n"
    + "If this chain is really required, prefix the command with COMMAND_CHAIN_GUARD_DISABLE=1 "
    + "(e.g. COMMAND_CHAIN_GUARD_DISABLE=1 a && b) to bypass this check once.",
  );
};

run().catch((err: unknown) => {
  process.stderr.write(`command-chain-guard: ${String(err)}\n`);
  process.exit(1);
});
