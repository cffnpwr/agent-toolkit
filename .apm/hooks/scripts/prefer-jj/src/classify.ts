import type { GitCall } from "./types.ts";

// denylist: jj相当のあるgitサブコマンド → jj誘導メッセージ。
// 対応はjj-referenceスキル(.apm/skills/jj-reference/SKILL.md)の対応表と整合させる。
// 未登録のサブコマンドは全て通過(既定通過モデル)。
const JJ_EQUIVALENTS = new Map<string, string>([
  ["status", "use `jj st`"],
  ["log", "use `jj log`"],
  ["diff", "use `jj diff`"],
  ["show", "use `jj show` (file contents: `jj file show FILE -r REV`)"],
  ["ls-files", "use `jj file list`"],
  ["blame", "use `jj file annotate`"],
  ["add", "not needed; jj snapshots the working copy automatically, just edit files"],
  ["commit", "use `jj commit -m \"msg\"` or `jj describe -m \"msg\"`"],
  ["checkout", "use `jj new REV` / `jj edit REV` (for files: `jj restore FILE`)"],
  ["switch", "use `jj new REV` / `jj edit REV`"],
  ["restore", "use `jj restore`"],
  ["reset", "use `jj abandon` / `jj restore` / `jj squash`"],
  ["rebase", "use `jj rebase`"],
  ["merge", "use `jj new @ REV`"],
  ["cherry-pick", "use `jj duplicate REV -d @`"],
  ["revert", "use `jj revert -r REV --insert-after @`"],
  ["stash", "use `jj new @-` (the current change stays as a sibling)"],
  ["push", "use `jj git push`"],
  ["fetch", "use `jj git fetch`"],
  ["pull", "use `jj git fetch` then `jj rebase`"],
  ["clone", "use `jj git clone`"],
  ["init", "use `jj git init`"],
  ["remote", "use `jj git remote`"],
  ["branch", "use `jj bookmark`"],
  ["worktree", "use `jj workspace`"],
  ["sparse-checkout", "use `jj sparse`"],
]);

// clone/fetchでshallow/partial系フラグが付く場合は、jj相当の無いgit専用操作として通過させる。
const SHALLOW_EXEMPT_SUBCOMMANDS = new Set(["clone", "fetch"]);

const isShallowFlag = (arg: string): boolean => arg === "--depth"
  || arg.startsWith("--depth=")
  || arg.startsWith("--shallow-")
  || arg === "--filter"
  || arg.startsWith("--filter=")
  || arg === "--unshallow";

/**
 * git呼び出しを分類し、ブロック対象ならjj誘導メッセージを返す。
 * denylist未登録・フラグ例外はundefined(通過)。
 */
export const classify = (call: GitCall): string | undefined => {
  const suggestion = JJ_EQUIVALENTS.get(call.subcommand);
  if (suggestion === undefined) return undefined;
  if (SHALLOW_EXEMPT_SUBCOMMANDS.has(call.subcommand) && call.args.some(isShallowFlag)) {
    return undefined;
  }
  return suggestion;
};
