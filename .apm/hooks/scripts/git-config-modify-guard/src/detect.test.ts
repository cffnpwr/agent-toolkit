import { describe, expect, it } from "bun:test";

import type { ConfigOverrideFinding } from "./detect.ts";

import { findConfigOverrides, findConfigWrites } from "./detect.ts";

describe("findConfigWrites", () => {
  it.each<{ command: string; want: string[]; }>([
    { command: "git config user.name x", want: ["git config user.name x"] },
    { command: "git -C repo config set a.b 1", want: ["git -C repo config set a.b 1"] },
    { command: "git -c a.b=1 config --unset a.c", want: ["git -c a.b=1 config --unset a.c"] },
    { command: "/usr/bin/git config --add a.b 1", want: ["/usr/bin/git config --add a.b 1"] },
    { command: "cd r && git config a.b 1", want: ["git config a.b 1"] },
    { command: "echo $(git config a.b 1)", want: ["git config a.b 1"] },
    {
      command: "git config a.b 1; git config --get a.b; git config a.c 2",
      want: ["git config a.b 1", "git config a.c 2"],
    },
  ])("[positive] 「$command」のとき書き込む呼び出しを返す", ({ command, want }) => {
    expect(findConfigWrites(command)).toEqual(want);
  });

  it.each([
    "git config --get user.name",
    "git config list",
    "git status",
    "git log --format=config",
    "git -c core.editor=true commit",
    "git $SUB a.b 1",
    "$GIT config a.b 1",
    "git cfg a.b 1",
    "sh -c 'git config a.b 1'",
    "config a.b 1",
  ])("[negative] 「%s」のとき何も返さない", (command) => {
    expect(findConfigWrites(command)).toEqual([]);
  });

  it("[positive] 無効化の変数を渡したとき前置代入で真値にしたコマンドを除く", () => {
    const result = findConfigWrites(
      "GUARD_DISABLE=1 git config a.b 1; git config a.c 2",
      "GUARD_DISABLE",
    );

    expect(result).toEqual(["git config a.c 2"]);
  });

  it("[positive] 無効化の変数を渡さないとき前置代入のあるコマンドも返す", () => {
    const result = findConfigWrites("GUARD_DISABLE=1 git config a.b 1");

    expect(result).toEqual(["GUARD_DISABLE=1 git config a.b 1"]);
  });
});

describe("findConfigOverrides", () => {
  it.each<{ command: string; want: ConfigOverrideFinding[]; }>([
    {
      command: "git -c core.hooksPath=/dev/null commit -m x",
      want: [{
        snippet: "git -c core.hooksPath=/dev/null commit -m x",
        overrides: [{ option: "-c", name: "core.hooksPath" }],
        hasUnresolvedOverride: false,
        environmentVariables: [],
      }],
    },
    {
      command: "git -c core.pager=cat log",
      want: [{
        snippet: "git -c core.pager=cat log",
        overrides: [{ option: "-c", name: "core.pager" }],
        hasUnresolvedOverride: false,
        environmentVariables: [],
      }],
    },
    {
      command: "git -c a.b status",
      want: [{
        snippet: "git -c a.b status",
        overrides: [{ option: "-c", name: "a.b" }],
        hasUnresolvedOverride: false,
        environmentVariables: [],
      }],
    },
    {
      command: "git -c a.b=c --version",
      want: [{
        snippet: "git -c a.b=c --version",
        overrides: [{ option: "-c", name: "a.b" }],
        hasUnresolvedOverride: false,
        environmentVariables: [],
      }],
    },
    {
      command: "git --config-env=user.name=NAME commit",
      want: [{
        snippet: "git --config-env=user.name=NAME commit",
        overrides: [{ option: "--config-env", name: "user.name" }],
        hasUnresolvedOverride: false,
        environmentVariables: [],
      }],
    },
    {
      command: "git --config-env user.name=NAME status",
      want: [{
        snippet: "git --config-env user.name=NAME status",
        overrides: [{ option: "--config-env", name: "user.name" }],
        hasUnresolvedOverride: false,
        environmentVariables: [],
      }],
    },
    {
      command: "git -c a.b=1 -c c.d=2 status",
      want: [{
        snippet: "git -c a.b=1 -c c.d=2 status",
        overrides: [
          { option: "-c", name: "a.b" },
          { option: "-c", name: "c.d" },
        ],
        hasUnresolvedOverride: false,
        environmentVariables: [],
      }],
    },
    {
      command: "git -c \"$KV\" status",
      want: [{
        snippet: "git -c \"$KV\" status",
        overrides: [],
        hasUnresolvedOverride: true,
        environmentVariables: [],
      }],
    },
    {
      command: "GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/dev/null git commit",
      want: [{
        snippet: "GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/dev/null git commit",
        overrides: [],
        hasUnresolvedOverride: false,
        environmentVariables: [
          "GIT_CONFIG_COUNT",
          "GIT_CONFIG_KEY_0",
          "GIT_CONFIG_VALUE_0",
        ],
      }],
    },
    {
      command: "GIT_CONFIG_KEY_10=core.pager FOO=1 git log",
      want: [{
        snippet: "GIT_CONFIG_KEY_10=core.pager FOO=1 git log",
        overrides: [],
        hasUnresolvedOverride: false,
        environmentVariables: ["GIT_CONFIG_KEY_10"],
      }],
    },
    {
      command: "GIT_CONFIG_COUNT=\"$N\" git status",
      want: [{
        snippet: "GIT_CONFIG_COUNT=\"$N\" git status",
        overrides: [],
        hasUnresolvedOverride: false,
        environmentVariables: ["GIT_CONFIG_COUNT"],
      }],
    },
    {
      command: "GIT_CONFIG_GLOBAL=/dev/null git commit -m x",
      want: [{
        snippet: "GIT_CONFIG_GLOBAL=/dev/null git commit -m x",
        overrides: [],
        hasUnresolvedOverride: false,
        environmentVariables: ["GIT_CONFIG_GLOBAL"],
      }],
    },
    {
      command: "GIT_CONFIG_SYSTEM=/dev/null git commit -m x",
      want: [{
        snippet: "GIT_CONFIG_SYSTEM=/dev/null git commit -m x",
        overrides: [],
        hasUnresolvedOverride: false,
        environmentVariables: ["GIT_CONFIG_SYSTEM"],
      }],
    },
    {
      command: "GIT_CONFIG_NOSYSTEM=1 git commit",
      want: [{
        snippet: "GIT_CONFIG_NOSYSTEM=1 git commit",
        overrides: [],
        hasUnresolvedOverride: false,
        environmentVariables: ["GIT_CONFIG_NOSYSTEM"],
      }],
    },
    {
      command: "GIT_CONFIG_GLOBAL= git log",
      want: [{
        snippet: "GIT_CONFIG_GLOBAL= git log",
        overrides: [],
        hasUnresolvedOverride: false,
        environmentVariables: ["GIT_CONFIG_GLOBAL"],
      }],
    },
    {
      command: "GIT_CONFIG_SYSTEM=\"$F\" git log",
      want: [{
        snippet: "GIT_CONFIG_SYSTEM=\"$F\" git log",
        overrides: [],
        hasUnresolvedOverride: false,
        environmentVariables: ["GIT_CONFIG_SYSTEM"],
      }],
    },
    {
      command: "GIT_CONFIG_NOSYSTEM=0 git log",
      want: [{
        snippet: "GIT_CONFIG_NOSYSTEM=0 git log",
        overrides: [],
        hasUnresolvedOverride: false,
        environmentVariables: ["GIT_CONFIG_NOSYSTEM"],
      }],
    },
    {
      command: "GIT_CONFIG_COUNT=1 git -c a.b=c log",
      want: [{
        snippet: "GIT_CONFIG_COUNT=1 git -c a.b=c log",
        overrides: [{ option: "-c", name: "a.b" }],
        hasUnresolvedOverride: false,
        environmentVariables: ["GIT_CONFIG_COUNT"],
      }],
    },
    {
      command: "cd r && /usr/bin/git -c a.b=1 log; git -c c.d=2 log",
      want: [
        {
          snippet: "/usr/bin/git -c a.b=1 log",
          overrides: [{ option: "-c", name: "a.b" }],
          hasUnresolvedOverride: false,
          environmentVariables: [],
        },
        {
          snippet: "git -c c.d=2 log",
          overrides: [{ option: "-c", name: "c.d" }],
          hasUnresolvedOverride: false,
          environmentVariables: [],
        },
      ],
    },
  ])("[positive] 「$command」のとき上書きする呼び出しを返す", ({ command, want }) => {
    expect(findConfigOverrides(command)).toEqual(want);
  });

  it.each([
    "git log",
    "git config get user.name",
    "git commit -m '-c a.b=c'",
    "git log -c",
    "git \"$OPT\" commit",
    "git $OPT -c a.b=c commit",
    "FOO=1 git log",
    "GIT_CONFIG_COUNTER=1 git log",
    "GIT_CONFIG_GLOBALX=1 git log",
    "GIT_CONFIG_NOSYSTEMS=1 git log",
    "XGIT_CONFIG_SYSTEM=1 git log",
    "HOME=/tmp git log",
    "XDG_CONFIG_HOME=/tmp git log",
    "export GIT_CONFIG_GLOBAL=/dev/null; git log",
    "env GIT_CONFIG_GLOBAL=/dev/null git log",
    "GIT_CONFIG_KEY_=x git log",
    "GIT_CONFIG_KEY_a=x git log",
    "GIT_CONFIG_COUNT=1 make log",
    "env GIT_CONFIG_COUNT=1 git log",
    "export GIT_CONFIG_COUNT=1; git log",
    "GIT_CONFIG_COUNT=1",
    "make -c a.b=c",
  ])("[negative] 「%s」のとき何も返さない", (command) => {
    expect(findConfigOverrides(command)).toEqual([]);
  });

  it("[positive] 無効化の変数を渡したとき前置代入で真値にしたコマンドを除く", () => {
    const result = findConfigOverrides(
      "GUARD_DISABLE=1 git -c a.b=c log; git -c a.d=e log",
      "GUARD_DISABLE",
    );

    expect(result).toEqual([{
      snippet: "git -c a.d=e log",
      overrides: [{ option: "-c", name: "a.d" }],
      hasUnresolvedOverride: false,
      environmentVariables: [],
    }]);
  });

  it("[positive] 無効化の変数を渡さないとき前置代入のあるコマンドも返す", () => {
    const result = findConfigOverrides("GUARD_DISABLE=1 git -c a.b=c log");

    expect(result).toEqual([{
      snippet: "GUARD_DISABLE=1 git -c a.b=c log",
      overrides: [{ option: "-c", name: "a.b" }],
      hasUnresolvedOverride: false,
      environmentVariables: [],
    }]);
  });
});
