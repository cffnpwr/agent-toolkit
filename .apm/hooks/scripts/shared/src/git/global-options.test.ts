import { describe, expect, it } from "bun:test";

import type { ConfigOverride, GitInvocation } from "./global-options.ts";

import { isGitCommandName, parseGitInvocation } from "./global-options.ts";

describe("isGitCommandName", () => {
  it.each(["git", "/usr/bin/git", "./git"])("[positive] 「%s」のときgitとみなす", (name) => {
    expect(isGitCommandName(name)).toBe(true);
  });

  it.each(["gitk", "xgit", "git-lfs", "/usr/bin/gitk"])("[negative] 「%s」のときgitとみなさない", (name) => {
    expect(isGitCommandName(name)).toBe(false);
  });
});

const literal = (name: string, text: string): ConfigOverride => ({
  name,
  value: { type: "literal", text },
});

const omitted = (name: string): ConfigOverride => ({
  name,
  value: { type: "omitted" },
});

const environment = (name: string): ConfigOverride => ({
  name,
  value: { type: "environment" },
});

describe("parseGitInvocation", () => {
  it.each<{ label: string; args: (string | null)[]; want: GitInvocation; }>([
    {
      label: "commit -n",
      args: ["commit", "-n"],
      want: {
        configOverrides: [],
        hasUnresolvedConfigOverride: false,
        subcommandIndex: 0,
      },
    },
    {
      label: "-C dir -c core.hooksPath=/x commit",
      args: ["-C", "dir", "-c", "core.hooksPath=/x", "commit"],
      want: {
        configOverrides: [literal("core.hooksPath", "/x")],
        hasUnresolvedConfigOverride: false,
        subcommandIndex: 4,
      },
    },
    {
      label: "-c a=b=c(値なしのサブコマンド)",
      args: ["-c", "a=b=c"],
      want: {
        configOverrides: [literal("a", "b=c")],
        hasUnresolvedConfigOverride: false,
        subcommandIndex: undefined,
      },
    },
    {
      label: "-c core.hooksPath(=なし) status",
      args: ["-c", "core.hooksPath", "status"],
      want: {
        configOverrides: [omitted("core.hooksPath")],
        hasUnresolvedConfigOverride: false,
        subcommandIndex: 2,
      },
    },
    {
      label: "-c sendemail.validate=(空の値) send-email",
      args: ["-c", "sendemail.validate=", "send-email"],
      want: {
        configOverrides: [literal("sendemail.validate", "")],
        hasUnresolvedConfigOverride: false,
        subcommandIndex: 2,
      },
    },
    {
      label: "--config-env=hook.a=b.command=E commit",
      args: ["--config-env=hook.a=b.command=E", "commit"],
      want: {
        configOverrides: [environment("hook.a=b.command")],
        hasUnresolvedConfigOverride: false,
        subcommandIndex: 1,
      },
    },
    {
      label: "--config-env core.hooksPath=E merge",
      args: ["--config-env", "core.hooksPath=E", "merge"],
      want: {
        configOverrides: [environment("core.hooksPath")],
        hasUnresolvedConfigOverride: false,
        subcommandIndex: 2,
      },
    },
    {
      label: "--git-dir .git --work-tree . --namespace n --attr-source HEAD --shallow-file f status",
      args: ["--git-dir", ".git", "--work-tree", ".", "--namespace", "n", "--attr-source", "HEAD", "--shallow-file", "f", "status"],
      want: {
        configOverrides: [],
        hasUnresolvedConfigOverride: false,
        subcommandIndex: 10,
      },
    },
    {
      label: "--git-dir=.git --no-pager -p --bare config",
      args: ["--git-dir=.git", "--no-pager", "-p", "--bare", "config"],
      want: {
        configOverrides: [],
        hasUnresolvedConfigOverride: false,
        subcommandIndex: 4,
      },
    },
    {
      label: "--help commit",
      args: ["--help", "commit"],
      want: {
        configOverrides: [],
        hasUnresolvedConfigOverride: false,
        subcommandIndex: 0,
      },
    },
    {
      label: "-c <未解決> commit",
      args: ["-c", null, "commit"],
      want: {
        configOverrides: [],
        hasUnresolvedConfigOverride: true,
        subcommandIndex: 2,
      },
    },
    {
      label: "--config-env <未解決> commit",
      args: ["--config-env", null, "commit"],
      want: {
        configOverrides: [],
        hasUnresolvedConfigOverride: true,
        subcommandIndex: 2,
      },
    },
    {
      label: "-c a=1 -c <未解決> -c b=2 commit",
      args: ["-c", "a=1", "-c", null, "-c", "b=2", "commit"],
      want: {
        configOverrides: [literal("a", "1"), literal("b", "2")],
        hasUnresolvedConfigOverride: true,
        subcommandIndex: 6,
      },
    },
    {
      label: "-C <未解決> commit(-c・--config-env以外の値は数えない)",
      args: ["-C", null, "commit"],
      want: {
        configOverrides: [],
        hasUnresolvedConfigOverride: false,
        subcommandIndex: 2,
      },
    },
  ])("[positive] 「$label」のとき設定の上書きとサブコマンドの位置を返す", ({ args, want }) => {
    const result = parseGitInvocation(args);

    expect(result).toEqual(want);
  });

  it.each<{ label: string; args: (string | null)[]; want: GitInvocation; }>([
    {
      label: "引数なし",
      args: [],
      want: {
        configOverrides: [],
        hasUnresolvedConfigOverride: false,
        subcommandIndex: undefined,
      },
    },
    {
      label: "--exec-path commit",
      args: ["--exec-path", "commit"],
      want: {
        configOverrides: [],
        hasUnresolvedConfigOverride: false,
        subcommandIndex: undefined,
      },
    },
    {
      label: "-ccore.hooksPath=x commit",
      args: ["-ccore.hooksPath=x", "commit"],
      want: {
        configOverrides: [],
        hasUnresolvedConfigOverride: false,
        subcommandIndex: undefined,
      },
    },
    {
      label: "<未解決> commit",
      args: [null, "commit"],
      want: {
        configOverrides: [],
        hasUnresolvedConfigOverride: false,
        subcommandIndex: undefined,
      },
    },
    {
      label: "-c a=1 <未解決> commit",
      args: ["-c", "a=1", null, "commit"],
      want: {
        configOverrides: [literal("a", "1")],
        hasUnresolvedConfigOverride: false,
        subcommandIndex: undefined,
      },
    },
  ])("[negative] 「$label」のときサブコマンドの位置を決めない", ({ args, want }) => {
    const result = parseGitInvocation(args);

    expect(result).toEqual(want);
  });
});
