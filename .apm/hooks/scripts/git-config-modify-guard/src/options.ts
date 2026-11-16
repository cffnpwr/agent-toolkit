import type { OptionSpec } from "../../shared/src/git/parse-options.ts";

export type ConfigEffect = "no-write" | "writes";

export interface ConfigOptionSpec extends OptionSpec {
  // 動作モードを選ぶオプションの効果
  mode?: ConfigEffect;
}

// サブコマンドを省略した形式で`git config`が受け付けるオプション
export const LEGACY_OPTIONS: readonly ConfigOptionSpec[] = [
  { long: "global", argument: "none", negatable: true },
  { long: "system", argument: "none", negatable: true },
  { long: "local", argument: "none", negatable: true },
  { long: "worktree", argument: "none", negatable: true },
  { short: "f", long: "file", argument: "required", negatable: true },
  { long: "blob", argument: "required", negatable: true },
  { long: "get", argument: "none", negatable: false, mode: "no-write" },
  { long: "get-all", argument: "none", negatable: false, mode: "no-write" },
  { long: "get-regexp", argument: "none", negatable: false, mode: "no-write" },
  { long: "get-urlmatch", argument: "none", negatable: false, mode: "no-write" },
  { long: "replace-all", argument: "none", negatable: false, mode: "writes" },
  { long: "add", argument: "none", negatable: false, mode: "writes" },
  { long: "unset", argument: "none", negatable: false, mode: "writes" },
  { long: "unset-all", argument: "none", negatable: false, mode: "writes" },
  { long: "rename-section", argument: "none", negatable: false, mode: "writes" },
  { long: "remove-section", argument: "none", negatable: false, mode: "writes" },
  { short: "l", long: "list", argument: "none", negatable: false, mode: "no-write" },
  { short: "e", long: "edit", argument: "none", negatable: false, mode: "writes" },
  { long: "get-color", argument: "none", negatable: false, mode: "no-write" },
  { long: "get-colorbool", argument: "none", negatable: false, mode: "no-write" },
  { short: "z", long: "null", argument: "none", negatable: true },
  { long: "name-only", argument: "none", negatable: true },
  { long: "show-origin", argument: "none", negatable: true },
  { long: "show-scope", argument: "none", negatable: true },
  { long: "show-names", argument: "none", negatable: true },
  { short: "t", long: "type", argument: "required", negatable: true },
  { long: "bool", argument: "none", negatable: false },
  { long: "int", argument: "none", negatable: false },
  { long: "bool-or-int", argument: "none", negatable: false },
  { long: "bool-or-str", argument: "none", negatable: false },
  { long: "path", argument: "none", negatable: false },
  { long: "expiry-date", argument: "none", negatable: false },
  { long: "default", argument: "required", negatable: true },
  { long: "comment", argument: "required", negatable: true },
  { long: "fixed-value", argument: "none", negatable: true },
  { long: "includes", argument: "none", negatable: true },
];

export const SUBCOMMAND_EFFECTS = new Map<string, ConfigEffect>([
  ["list", "no-write"],
  ["get", "no-write"],
  ["set", "writes"],
  ["unset", "writes"],
  ["rename-section", "writes"],
  ["remove-section", "writes"],
  ["edit", "writes"],
]);
