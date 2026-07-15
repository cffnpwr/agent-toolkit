import { describe, expect, it } from "bun:test";

import type { Cwd, Env, State } from "./types.ts";

import { applyExportAssign, applyPrefixAssign, cdTarget } from "./command-effects.ts";
import { firstCommand, firstStatement } from "./test-support.ts";

const state = (cwd: Cwd, env: Env = new Map()): State => ({ cwd, env });

describe("cdTarget", () => {
  it("[negative] cd以外のコマンドのときundefinedを返す", () => {
    expect(cdTarget(firstStatement("git status"), state("/base"))).toBeUndefined();
  });

  it("[negative] Command以外を包むStatement(AndOr)のときundefinedを返す", () => {
    expect(cdTarget(firstStatement("cd /a && x"), state("/base"))).toBeUndefined();
  });

  it("[positive] Commandノードを直接渡したとき移動先を返す", () => {
    // asCommandのnode.type==="Command"経路。
    expect(cdTarget(firstCommand("cd /a"), state("/base"))).toEqual({ target: "/a" });
  });

  it.each([
    { name: "-- 後の絶対パス", src: "cd -- /a", cwd: "/base", want: "/a" },
    { name: "オプション読み飛ばし", src: "cd -L /a", cwd: "/base", want: "/a" },
    { name: "相対パス", src: "cd sub", cwd: "/base", want: "/base/sub" },
    { name: "親参照の正規化", src: "cd /a/../b", cwd: "/base", want: "/b" },
    { name: "空文字は無操作", src: "cd \"\"", cwd: "/base", want: "/base" },
  ])("[positive] $name のとき有効CWDを算出する", ({ src, cwd, want }: { src: string; cwd: string; want: string; }) => {
    expect(cdTarget(firstStatement(src), state(cwd))).toEqual({ target: want });
  });

  it("[positive] 引数無しのcdはHOMEを返す", () => {
    const env: Env = new Map([["HOME", "/home/u"]]);
    expect(cdTarget(firstStatement("cd"), state("/base", env))).toEqual({ target: "/home/u" });
  });

  it.each([
    { name: "cd -(OLDPWD)は追跡不能", src: "cd -", cwd: "/base", env: new Map<string, string | null>() },
    { name: "HOME未設定の引数無しcd", src: "cd", cwd: "/base", env: new Map<string, string | null>() },
    { name: "未定義変数への移動", src: "cd $UNDEF", cwd: "/base", env: new Map<string, string | null>() },
    { name: "CWD不明での相対移動", src: "cd sub", cwd: null, env: new Map<string, string | null>() },
  ])("[negative] $name のときtarget=nullを返す", ({ src, cwd, env }: { src: string; cwd: Cwd; env: Env; }) => {
    expect(cdTarget(firstStatement(src), state(cwd, env))).toEqual({ target: null });
  });
});

describe("applyPrefixAssign", () => {
  const run = (src: string, env: Env = new Map()): Record<string, string | null> => {
    for (const a of firstCommand(src).prefix) applyPrefixAssign(a, env);
    return Object.fromEntries(env);
  };

  it("[positive] VAR=valueを環境へ反映する", () => {
    expect(run("FOO=/e")).toEqual({ FOO: "/e" });
  });

  it("[positive] VAR=(値無し)を空文字として反映する", () => {
    expect(run("FOO=")).toEqual({ FOO: "" });
  });

  it("[positive] 値側の変数を展開して反映する", () => {
    expect(run("FOO=$BAR", new Map([["BAR", "/x"]]))).toEqual({ BAR: "/x", FOO: "/x" });
  });

  it("[negative] 配列代入は追跡しない", () => {
    expect(run("FOO=(a b)")).toEqual({});
  });
});

describe("applyExportAssign", () => {
  const run = (src: string, env: Env = new Map()): Record<string, string | null> => {
    for (const w of firstCommand(src).suffix) applyExportAssign(w, env);
    return Object.fromEntries(env);
  };

  it("[positive] export VAR=valueを環境へ反映する", () => {
    expect(run("export FOO=/e")).toEqual({ FOO: "/e" });
  });

  it("[positive] 値側が解決不能なら既知だが不明(null)として登録する", () => {
    expect(run("export FOO=$BAR")).toEqual({ FOO: null });
  });

  it.each([
    { name: "=を含まない語", src: "export FOO" },
    { name: "先頭が=の語", src: "export =x" },
    { name: "非IDENTな変数名", src: "export 1FOO=x" },
  ])("[negative] $name は反映しない", ({ src }: { src: string; }) => {
    expect(run(src)).toEqual({});
  });
});
