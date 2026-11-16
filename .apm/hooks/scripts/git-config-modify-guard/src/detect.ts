import type { Command } from "unbash";

import { parse } from "unbash";

import type { ConfigOverride } from "../../shared/src/git/global-options.ts";

import { foldCwd } from "../../shared/src/cdfold.ts";
import { expandWord } from "../../shared/src/expand.ts";
import {
  isGitCommandName,
  parseGitInvocation,
} from "../../shared/src/git/global-options.ts";
import { isDisabledByPrefix } from "../../shared/src/hook/disable.ts";

import { classifyConfigArgs } from "./classify.ts";

export interface ConfigOverrideFinding {
  snippet: string;
  // 名前が静的に決まらない上書きは含まない
  overrides: { option: "-c" | "--config-env"; name: string; }[];
  hasUnresolvedOverride: boolean;
  // gitのコマンドより前に置いた代入の環境変数名
  environmentVariables: string[];
}

const CONFIG_ENVIRONMENT_VARIABLE = new RegExp(
  "^GIT_CONFIG_(?:COUNT|KEY_[0-9]+|VALUE_[0-9]+|GLOBAL|SYSTEM|NOSYSTEM)$",
);

const toGitArgs = (cmd: Command): (string | null)[] | null => {
  const name = cmd.name === undefined ? null : expandWord(cmd.name, new Map());
  if (name === null || !isGitCommandName(name)) {
    return null;
  }

  return cmd.suffix.map((word) => expandWord(word, new Map()));
};

const writesConfig = (cmd: Command): boolean => {
  const args = toGitArgs(cmd);
  if (args === null) {
    return false;
  }
  const index = parseGitInvocation(args).subcommandIndex;
  if (index === undefined || args[index] !== "config") {
    return false;
  }

  return classifyConfigArgs(cmd.suffix.slice(index + 1)) === "writes";
};

const toOption = (override: ConfigOverride): "-c" | "--config-env" => {
  if (override.value.type === "environment") {
    return "--config-env";
  }

  return "-c";
};

const findOverrides = (
  cmd: Command,
  command: string,
): ConfigOverrideFinding | null => {
  const args = toGitArgs(cmd);
  if (args === null) {
    return null;
  }
  const invocation = parseGitInvocation(args);
  const environmentVariables = cmd.prefix
    .map((assignment) => assignment.name ?? "")
    .filter((name) => CONFIG_ENVIRONMENT_VARIABLE.test(name));
  if (
    invocation.configOverrides.length === 0
    && !invocation.hasUnresolvedConfigOverride
    && environmentVariables.length === 0
  ) {
    return null;
  }

  return {
    snippet: command.slice(cmd.pos, cmd.end),
    overrides: invocation.configOverrides.map((override) => ({
      option: toOption(override),
      name: override.name,
    })),
    hasUnresolvedOverride: invocation.hasUnresolvedConfigOverride,
    environmentVariables,
  };
};

// 設定を書き換えるgit configの呼び出しを、コマンド文字列の該当箇所として返す
export const findConfigWrites = (
  command: string,
  // 指定したとき、この変数を前置代入で真値にしたコマンドを除く
  disableVariable?: string,
): string[] => {
  const snippets: string[] = [];
  foldCwd(parse(command).commands, null, (cmd) => {
    if (
      disableVariable !== undefined
      && isDisabledByPrefix(cmd, disableVariable)
    ) {
      return;
    }
    if (writesConfig(cmd)) {
      snippets.push(command.slice(cmd.pos, cmd.end));
    }
  });

  return snippets;
};

// -c・--config-env・環境変数で設定を上書きするgitの呼び出しを返す
export const findConfigOverrides = (
  command: string,
  // 指定したとき、この変数を前置代入で真値にしたコマンドを除く
  disableVariable?: string,
): ConfigOverrideFinding[] => {
  const findings: ConfigOverrideFinding[] = [];
  foldCwd(parse(command).commands, null, (cmd) => {
    if (
      disableVariable !== undefined
      && isDisabledByPrefix(cmd, disableVariable)
    ) {
      return;
    }
    const finding = findOverrides(cmd, command);
    if (finding !== null) {
      findings.push(finding);
    }
  });

  return findings;
};
