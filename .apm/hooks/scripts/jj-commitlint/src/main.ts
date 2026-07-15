/**
 * jj-commitlint hook本体。
 *
 * HarnessのPostToolUse入力をstdinで受け取る。
 * jj describe/commitが成功した直後の実際のコミット説明を読み出してcommitlintに掛ける。
 * コマンド内のcd移動を畳み込み、各コミットをその有効CWD基準で読み出す。
 * 違反は移植性の高い終了コードのみで全Harnessに伝える。
 * 設定はlint対象リポジトリの設定を優先し、無ければ同梱の@cffnpwr/commitlint-configを使う。
 *
 * 出力プロトコル(全Harness共通):
 * - 違反: exit 2 + stderr(Claude/Codex/GeminiはAgentにフィードバック、Copilot等は警告に劣化)
 * - 実行不可(fail-open): exit 1 + stderr(全Harnessで非ブロック警告)
 * - 通過・対象外: exit 0・無出力
 */

import type { Json } from "./types.ts";

import { resolveBaseCwd } from "../../shared/cdfold.ts";

import { parseTargets } from "./command.ts";
import { extractCommand, isObject } from "./input.ts";
import { readDescription, runCommitlint } from "./lint.ts";

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
  if (targets.length === 0) return;

  // lint対象の(有効CWD, rev, 説明)を集める。同一(cwd, rev)の重複は除外する。
  const seen = new Set<string>();
  const messages: { rev: string; cwd: string; message: string; }[] = [];
  for (const t of targets) {
    // 有効CWDが不明な対象は、無関係なリポジトリを推測でlintしないためスキップする。
    if (t.cwd === null) continue;
    for (const rev of t.revs) {
      const key = `${t.cwd}\0${rev}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const desc = readDescription(rev, t.cwd);
      if (desc === undefined) continue;
      messages.push({ rev, cwd: t.cwd, message: desc });
    }
  }
  if (messages.length === 0) return;

  const violations: string[] = [];
  for (const { rev, cwd, message } of messages) {
    // 空説明はcommitlintがstdin無しと見なしてヘルプを出すため、直接違反扱いにする。
    if (message.trim() === "") {
      violations.push(`Commit message on rev ${rev} is empty.`);
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
        `Commit message on rev ${rev} violates commitlint:\n`
        + `--- message ---\n${message}\n--- violations ---\n${result.report}`,
      );
    }
  }

  if (violations.length > 0) {
    block(
      `${violations.join("\n\n")}\n\nFix the violations above. `
      + "You can rewrite the description directly with: "
      + "jj describe -r <rev> -m \"<fixed message>\".",
    );
  }
};

run().catch((err: unknown) => {
  process.stderr.write(`jj-commitlint: ${String(err)}\n`);
  process.exit(1);
});
