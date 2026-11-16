import type { Command } from "unbash";

import { parse } from "unbash";

import { foldCwd } from "../../shared/src/cdfold.ts";
import { expandWord } from "../../shared/src/expand.ts";
import { isGitCommandName, parseGitInvocation } from "../../shared/src/git/global-options.ts";
import { isDisabledByPrefix } from "../../shared/src/hook/disable.ts";

const NO_HOOK_OPTIONS = ["--no-verify", "--no-validate", "--no-post-rewrite"];

// `-n`が`--no-verify`を意味するサブコマンド
const SHORT_NO_VERIFY_SUBCOMMANDS = new Set(["commit", "am"]);

// git-history(1)が列挙するサブコマンド
const HISTORY_SUBCOMMANDS = new Set(["drop", "fixup", "reword", "split"]);

export interface HookBypass {
  snippet: string;
  reason: string;
}

// 1つの`-`の後に`n`を含む語（`--`始まりの語は除く）
const isShortOptionWithN = (word: string | null): boolean => word !== null
  && word.startsWith("-")
  && !word.startsWith("--")
  && word.slice(1).includes("n");

const findInCommand = (cmd: Command): string[] => {
  const name = cmd.name === undefined ? null : expandWord(cmd.name, new Map());
  if (name === null || !isGitCommandName(name)) {
    return [];
  }
  const args = cmd.suffix.map((word) => expandWord(word, new Map()));

  const reasons = NO_HOOK_OPTIONS
    .filter((option) => args.includes(option))
    .map((option) => `passes ${option}, which skips git hooks`);

  const index = parseGitInvocation(args).subcommandIndex;
  const subcommand = index === undefined ? undefined : args[index];
  if (index === undefined || typeof subcommand !== "string") {
    return reasons;
  }
  const rest = args.slice(index + 1);

  if (
    SHORT_NO_VERIFY_SUBCOMMANDS.has(subcommand)
    && rest.some(isShortOptionWithN)
  ) {
    reasons.push(
      `runs git ${subcommand} with -n (--no-verify), which skips git hooks`,
    );
  }
  const [first] = rest;
  if (
    subcommand === "history"
    && typeof first === "string"
    && HISTORY_SUBCOMMANDS.has(first)
  ) {
    // git-history(1)はhookを実行しない
    reasons.push(`runs git history ${first}, which does not run git hooks`);
  }

  return reasons;
};

export const findHookBypasses = (
  command: string,
  // 指定したとき、この変数を前置代入で真値にしたコマンドを除く
  disableVariable?: string,
): HookBypass[] => {
  const bypasses: HookBypass[] = [];
  foldCwd(parse(command).commands, null, (cmd) => {
    if (
      disableVariable !== undefined
      && isDisabledByPrefix(cmd, disableVariable)
    ) {
      return;
    }
    const snippet = command.slice(cmd.pos, cmd.end);
    for (const reason of findInCommand(cmd)) {
      bypasses.push({ snippet, reason });
    }
  });

  return bypasses;
};
