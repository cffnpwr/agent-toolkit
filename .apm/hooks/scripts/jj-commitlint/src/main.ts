/**
 * jj-commitlint hook本体。
 *
 * HarnessのPreToolUse入力をstdinで受け取る。
 * 説明を設定するjjサブコマンドから-m/--message値を抽出し、実行前にcommitlintに掛ける。
 * メッセージを静的に特定できない呼び出し(-m無し・--stdin・変数展開等)はlint対象外(fail-open)。
 * コマンド内のcd移動を畳み込み、各呼び出しの有効CWD基準でcommitlint設定を解決する。
 * 違反は移植性の高い終了コードのみで全Harnessに伝え、コマンドの実行前にブロックする。
 * 設定はlint対象リポジトリの設定を優先し、無ければ同梱の@cffnpwr/commitlint-configを使う。
 *
 * 出力プロトコル(全Harness共通):
 * - 違反: exit 2 + stderr(Claude/Codex/Geminiはコマンド実行を止めてAgentにフィードバック)
 * - 実行不可(fail-open): exit 1 + stderr(全Harnessで非ブロック警告)
 * - 通過・対象外: exit 0・無出力
 */

import type { Json } from "./types.ts";

import { resolveBaseCwd } from "../../shared/src/cdfold.ts";

import { parseTargets } from "./command.ts";
import { extractCommand, isObject } from "./input.ts";
import { runCommitlint } from "./lint.ts";

// 違反フィードバック。
// 全Harnessがexit 2 + stderrをブロック/フィードバックとして扱う。
const block = (reason: string): never => {
  process.stderr.write(`${reason}\n`);
  process.exit(2);
};

// fail-open警告。
// 通すが理由を伝える(exit 1は全Harnessで非ブロック警告)。
const warn = (message: string): never => {
  process.stderr.write(`${message}\n`);
  process.exit(1);
};

const run = async (): Promise<void> => {
  const parsed: unknown = JSON.parse(await Bun.stdin.text());
  if (!isObject(parsed)) return;
  const input: Json = parsed;

  const command = extractCommand(input);
  if (command === undefined) return;

  const baseCwd = resolveBaseCwd(input.cwd);

  const targets = parseTargets(command, baseCwd);

  // lint対象の(有効CWD, メッセージ)を集める。同一(cwd, message)の重複は除外する。
  const seen = new Set<string>();
  const messages: { cwd: string; message: string; }[] = [];
  for (const t of targets) {
    if (t.message === null) continue;
    // 有効CWDが不明な対象は、無関係なリポジトリの設定を推測で使わないためスキップする。
    if (t.cwd === null) continue;
    const key = `${t.cwd}\0${t.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    messages.push({ cwd: t.cwd, message: t.message });
  }
  if (messages.length === 0) return;

  const violations: string[] = [];
  for (const { cwd, message } of messages) {
    // 空メッセージは設定に依らず違反として直接報告する。
    if (message.trim() === "") {
      violations.push("Commit message is empty.");
      continue;
    }
    const result = await runCommitlint(message, cwd);
    if (result.unavailable) {
      warn(
        "jj-commitlint: could not run commitlint (bundled commitlint deps not synced?). "
        + `The commit message may violate user-defined rules.\n${result.report}`,
      );
      return;
    }
    if (!result.ok) {
      violations.push(
        "Commit message violates commitlint:\n"
        + `--- message ---\n${message}\n--- violations ---\n${result.report}`,
      );
    }
  }

  if (violations.length > 0) {
    block(
      `${violations.join("\n\n")}\n\nThe command was blocked before execution. `
      + "Fix the message value and re-run the command.",
    );
  }
};

run().catch((err: unknown) => {
  process.stderr.write(`jj-commitlint: ${String(err)}\n`);
  process.exit(1);
});
