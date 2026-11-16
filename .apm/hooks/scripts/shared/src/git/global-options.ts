// 次の語を値として取るグローバルオプション
const SEPARATE_VALUE_OPTIONS = new Set([
  "-C",
  "-c",
  "--attr-source",
  "--config-env",
  "--git-dir",
  "--namespace",
  "--shallow-file",
  "--work-tree",
]);

const STUCK_VALUE_OPTION_PREFIXES = [
  "--attr-source=",
  "--config-env=",
  "--exec-path=",
  "--git-dir=",
  "--namespace=",
  "--work-tree=",
];

const SWITCHES = new Set([
  "-P",
  "-p",
  "--bare",
  "--glob-pathspecs",
  "--icase-pathspecs",
  "--literal-pathspecs",
  "--no-advice",
  "--no-lazy-fetch",
  "--no-literal-pathspecs",
  "--no-optional-locks",
  "--no-pager",
  "--no-replace-objects",
  "--noglob-pathspecs",
  "--paginate",
]);

// gitがhelp・versionコマンドとして実行する語
const COMMAND_OPTIONS = new Set(["-h", "-v", "--help", "--version"]);

const CONFIG_ENV_PREFIX = "--config-env=";

export type ConfigValue = { type: "literal"; text: string; }
  // `=`を省略した`-c <name>`
  | { type: "omitted"; }
  // `--config-env`は値を環境変数から読む
  | { type: "environment"; };

export interface ConfigOverride {
  name: string;
  value: ConfigValue;
}

export interface GitInvocation {
  // `-c`・`--config-env`による設定の上書き（静的に解決できない語を除く）
  configOverrides: ConfigOverride[];
  // `-c`・`--config-env`の値の語が静的に解決できず、上書きの名前が決まらない
  hasUnresolvedConfigOverride: boolean;
  // サブコマンドの位置（サブコマンドを実行しない場合・静的に決まらない場合はundefined）
  subcommandIndex: number | undefined;
}

export const isGitCommandName = (name: string): boolean => name === "git" || name.endsWith("/git");

// `-c`の引数は最初の`=`で名前と値に分かれる
const toConfigParameter = (value: string): ConfigOverride => {
  const eq = value.indexOf("=");
  if (eq === -1) {
    return { name: value, value: { type: "omitted" } };
  }

  return {
    name: value.slice(0, eq),
    value: { type: "literal", text: value.slice(eq + 1) },
  };
};

// `--config-env`の引数は<envvar>が`=`を含まないため最後の`=`で分かれる
const toConfigEnv = (value: string): ConfigOverride => {
  const eq = value.lastIndexOf("=");

  return {
    name: eq === -1 ? value : value.slice(0, eq),
    value: { type: "environment" },
  };
};

// argsはgitに続く語（静的に解決できない語はnull）
export const parseGitInvocation = (
  args: readonly (string | null)[],
): GitInvocation => {
  const configOverrides: ConfigOverride[] = [];
  let hasUnresolvedConfigOverride = false;
  const toInvocation = (subcommandIndex?: number): GitInvocation => ({
    configOverrides,
    hasUnresolvedConfigOverride,
    subcommandIndex,
  });
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === null || arg === undefined) {
      return toInvocation();
    }
    if (!arg.startsWith("-") || COMMAND_OPTIONS.has(arg)) {
      return toInvocation(i);
    }
    if (SEPARATE_VALUE_OPTIONS.has(arg)) {
      i++;
      const value = args[i];
      if (value === null && (arg === "-c" || arg === "--config-env")) {
        hasUnresolvedConfigOverride = true;
      }
      if (typeof value !== "string") {
        continue;
      }
      switch (arg) {
        case "-c":
          configOverrides.push(toConfigParameter(value));
          break;
        case "--config-env":
          configOverrides.push(toConfigEnv(value));
          break;
        default:
          break;
      }
      continue;
    }
    if (arg.startsWith(CONFIG_ENV_PREFIX)) {
      configOverrides.push(toConfigEnv(arg.slice(CONFIG_ENV_PREFIX.length)));
      continue;
    }
    const hasStuckValue = STUCK_VALUE_OPTION_PREFIXES
      .some((p) => arg.startsWith(p));
    if (SWITCHES.has(arg) || hasStuckValue) {
      continue;
    }

    // `--exec-path`（`=`なし）・`--html-path`等・未知のオプションがあるとgitはサブコマンドを実行しない
    return toInvocation();
  }

  return toInvocation();
};
