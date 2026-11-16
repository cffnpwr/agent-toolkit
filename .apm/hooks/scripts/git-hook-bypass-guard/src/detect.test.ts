import { describe, expect, it } from "bun:test";

import type { HookBypass } from "./detect.ts";

import { findHookBypasses } from "./detect.ts";

const NO_VERIFY = "passes --no-verify, which skips git hooks";
const NO_VALIDATE = "passes --no-validate, which skips git hooks";
const NO_POST_REWRITE = "passes --no-post-rewrite, which skips git hooks";
const COMMIT_SHORT = "runs git commit with -n (--no-verify), which skips git hooks";
const AM_SHORT = "runs git am with -n (--no-verify), which skips git hooks";

const bypass = (snippet: string, reason: string): HookBypass => ({
  snippet,
  reason,
});

const historyRewrite = (command: string): string => `runs git history ${command}, which does not run git hooks`;

interface SingleBypassCase {
  command: string;
  reason: string;
}

describe("findHookBypasses", () => {
  it.each<SingleBypassCase>([
    { command: "git push --no-verify", reason: NO_VERIFY },
    { command: "git commit --no-verify -m a", reason: NO_VERIFY },
    { command: "git merge --no-verify topic", reason: NO_VERIFY },
    { command: "git pull origin main --no-verify", reason: NO_VERIFY },
    { command: "git rebase --no-verify main", reason: NO_VERIFY },
    { command: "git am --no-verify p.patch", reason: NO_VERIFY },
    { command: "git p4 submit --no-verify", reason: NO_VERIFY },
    { command: "git -C x --no-pager push --no-verify", reason: NO_VERIFY },
    { command: "git commit -m --no-verify", reason: NO_VERIFY },
    { command: "git commit -- --no-verify", reason: NO_VERIFY },
    { command: "git commit --no-verify --verify", reason: NO_VERIFY },
    { command: "git log --no-verify", reason: NO_VERIFY },
    { command: "git $SUB --no-verify", reason: NO_VERIFY },
    { command: "git commit $OPTS --no-verify", reason: NO_VERIFY },
    { command: "git commit --no-verify --no-verify", reason: NO_VERIFY },
    { command: "/usr/bin/git push --no-verify", reason: NO_VERIFY },
    { command: "git send-email --no-validate x.patch", reason: NO_VALIDATE },
    { command: "git commit --no-post-rewrite -m x", reason: NO_POST_REWRITE },
    { command: "git commit -n -m a", reason: COMMIT_SHORT },
    { command: "git -C x commit -anm msg", reason: COMMIT_SHORT },
    { command: "git commit -mn", reason: COMMIT_SHORT },
    { command: "git commit file -n", reason: COMMIT_SHORT },
    { command: "git commit -n -n", reason: COMMIT_SHORT },
    { command: "git am -3n p.patch", reason: AM_SHORT },
    { command: "git history reword HEAD", reason: historyRewrite("reword") },
    { command: "git history drop HEAD", reason: historyRewrite("drop") },
    { command: "git history fixup HEAD", reason: historyRewrite("fixup") },
    { command: "git history split HEAD", reason: historyRewrite("split") },
  ])("[positive] 「$command」のとき理由を1つ返す", ({ command, reason }) => {
    const result = findHookBypasses(command);

    expect(result).toEqual([bypass(command, reason)]);
  });

  it.each<{ command: string; want: HookBypass[]; }>([
    { command: "echo $(git commit -n)", want: [bypass("git commit -n", COMMIT_SHORT)] },
    { command: "cd d && git push --no-verify", want: [bypass("git push --no-verify", NO_VERIFY)] },
    {
      command: "git commit -n --amend --no-post-rewrite",
      want: [
        bypass("git commit -n --amend --no-post-rewrite", NO_POST_REWRITE),
        bypass("git commit -n --amend --no-post-rewrite", COMMIT_SHORT),
      ],
    },
    {
      command: "git commit --no-post-rewrite --no-verify",
      want: [
        bypass("git commit --no-post-rewrite --no-verify", NO_VERIFY),
        bypass("git commit --no-post-rewrite --no-verify", NO_POST_REWRITE),
      ],
    },
    {
      command: "git push --no-verify && git commit -n",
      want: [
        bypass("git push --no-verify", NO_VERIFY),
        bypass("git commit -n", COMMIT_SHORT),
      ],
    },
  ])("[positive] 「$command」のとき検知した呼び出しと理由をすべて返す", ({ command, want }) => {
    const result = findHookBypasses(command);

    expect(result).toEqual(want);
  });

  it.each([
    "git commit -m a",
    "git commit --verify",
    "git commit --amend --post-rewrite",
    "git commit --message=n",
    "git commit --no-veri",
    "git commit --no-verify=x",
    "git commit --NO-VERIFY",
    "git commit -$N",
    "git commit -",
    "git push -n origin main",
    "git push --dry-run",
    "git push --no-veri",
    "git merge -n topic",
    "git pull -n",
    "git rebase -n main",
    "git log -n 3",
    "git p4 submit -n",
    "git p4 submit --no-v",
    "git send-email --novalidate x.patch",
    "git send-email +no-validate x.patch",
    "git send-email --NO-VALIDATE x.patch",
    "git send-email --no-validate=1 x.patch",
    "git history",
    "git history -h",
    "git history log",
    "git history $SUB HEAD",
    "git -c core.hooksPath=/dev/null commit -m x",
    "git --config-env=core.hooksPath=E commit",
    "git -c sendemail.validate=false send-email x.patch",
    "git status",
    "git ci -n",
    "gitk --no-verify",
    "git-send-email --no-validate",
    "$GIT commit -n",
    "sh -c 'git commit -n'",
  ])("[negative] 「%s」のとき検知しない", (command) => {
    const result = findHookBypasses(command);

    expect(result).toEqual([]);
  });

  it("[positive] 無効化の変数を渡したとき前置代入で真値にしたコマンドを除く", () => {
    const result = findHookBypasses(
      "GUARD_DISABLE=1 git commit --no-verify && git push --no-verify",
      "GUARD_DISABLE",
    );

    expect(result).toEqual([bypass("git push --no-verify", NO_VERIFY)]);
  });

  it("[positive] 無効化の変数を渡さないとき前置代入のあるコマンドも返す", () => {
    const result = findHookBypasses("GUARD_DISABLE=1 git push --no-verify");

    expect(result).toEqual([
      bypass("GUARD_DISABLE=1 git push --no-verify", NO_VERIFY),
    ]);
  });
});
