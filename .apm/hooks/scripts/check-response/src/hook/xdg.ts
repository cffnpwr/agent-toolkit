import { homedir } from "node:os";
import { join } from "node:path";

import { match, P } from "ts-pattern";

const APP_NAME = "check-response";

export const appDirOf = (
  variable: "XDG_CACHE_HOME" | "XDG_STATE_HOME",
  defaultPath: string,
): string => {
  const base = match(process.env[variable])
    // XDG Base Directoryの変数が未設定・空の場合は、仕様の既定値(ホームディレクトリからの相対パス)
    .with(P.union(undefined, ""), () => join(homedir(), defaultPath))
    .with(P.string, (path) => path)
    .exhaustive();

  return join(base, APP_NAME);
};
