/**
 * approval-chain-guard hook本体。
 *
 * HarnessのPermissionRequest入力をstdinで受け取る。
 * 承認プロンプトが出る呼び出しに`&&`・`||`・`;`(改行含む)で複数コマンドが詰め込まれていれば拒否し、
 * 1呼び出し1コマンドへの分割を促す。`|`(pipe)は対象外。
 *
 * 出力プロトコル(全Harness共通):
 * - 拒否: exit 0 + stdoutのdecision JSON(Claude Codeはこのイベントでexit 2を無視する)
 * - 実行不可(fail-open): exit 1 + stderr(decisionなしとして通常の承認フローへ戻る)
 * - 通過・対象外: exit 0・無出力
 */

import { analyzeChain } from "./command.ts";
import { extractCommand, isObject } from "./input.ts";
import { buildDenyMessage } from "./suggest.ts";

// 拒否decision。Codexはdecisionの未知フィールドを不正として扱う(deny_unknown_fields)ため、
// 両Harnessが解釈するbehavior・message以外を入れない。
const deny = (message: string): void => {
  process.stdout.write(`${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PermissionRequest",
      decision: { behavior: "deny", message },
    },
  })}\n`);
};

const run = async (): Promise<void> => {
  const parsed: unknown = JSON.parse(await Bun.stdin.text());
  if (!isObject(parsed)) return;

  const command = extractCommand(parsed);
  if (command === undefined) return;

  const analysis = analyzeChain(command);
  if (analysis.violations.length === 0) return;

  deny(buildDenyMessage(analysis));
};

run().catch((err: unknown) => {
  process.stderr.write(`approval-chain-guard: ${String(err)}\n`);
  process.exit(1);
});
