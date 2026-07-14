/**
 * jj-commitlint hook本体。
 *
 * HarnessのPostToolUse入力をstdinで受け取る。
 * jj describe/commitが成功した直後の実際のコミット説明を読み出してcommitlintに掛ける。
 * 違反は移植性の高い終了コードのみで全Harnessに伝える。
 * 設定はlint対象リポジトリの設定を優先し、無ければ同梱の@cffnpwr/commitlint-configを使う。
 *
 * 出力プロトコル(全Harness共通):
 * - 違反: exit 2 + stderr(Claude/Codex/GeminiはAgentにフィードバック、Copilot等は警告に劣化)
 * - 実行不可(fail-open): exit 1 + stderr(全Harnessで非ブロック警告)
 * - 通過・対象外: exit 0・無出力
 */

import type { Json } from "./types.ts";

import { parseTargets } from "./command.ts";
import { extractCommand, isObject } from "./input.ts";
import { readDescription, runCommitlint } from "./lint.ts";

const env = process.env;

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

  const targets = parseTargets(command);
  if (targets.length === 0) return;

  let cwd = process.cwd();
  if (typeof input.cwd === "string" && input.cwd.length > 0) {
    cwd = input.cwd;
  } else if (env.CLAUDE_PROJECT_DIR !== undefined && env.CLAUDE_PROJECT_DIR.length > 0) {
    cwd = env.CLAUDE_PROJECT_DIR;
  }

  // lint対象の(rev, 説明)を集める。重複revは除外する。
  const seen = new Set<string>();
  const messages: { rev: string; message: string; }[] = [];
  for (const t of targets) {
    for (const rev of t.revs) {
      if (seen.has(rev)) continue;
      seen.add(rev);
      const desc = readDescription(rev, cwd);
      if (desc === undefined) continue;
      messages.push({ rev, message: desc });
    }
  }
  if (messages.length === 0) return;

  const violations: string[] = [];
  for (const { rev, message } of messages) {
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
