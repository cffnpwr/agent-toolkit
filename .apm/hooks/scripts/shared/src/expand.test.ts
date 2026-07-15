import { describe, expect, it } from "bun:test";

import type { Env } from "./types.ts";

import { expandWord, lookupVar } from "./expand.ts";
import { wordOf } from "./test-support.ts";

describe("lookupVar", () => {
  it("[positive] IDENTで値がstringのときその値を返す", () => {
    const env: Env = new Map([["FOO", "/x"]]);
    expect(lookupVar("FOO", env)).toBe("/x");
  });

  it("[negative] 値がnull(既知だが解決不能)のときnullを返す", () => {
    const env: Env = new Map([["FOO", null]]);
    expect(lookupVar("FOO", env)).toBeNull();
  });

  it("[negative] 未定義のときnullを返す", () => {
    expect(lookupVar("FOO", new Map())).toBeNull();
  });

  it("[negative] 非IDENT(特殊パラメータ)のときnullを返す", () => {
    const env: Env = new Map([["?", "0"]]);
    expect(lookupVar("?", env)).toBeNull();
  });
});

describe("expandWord", () => {
  describe("parts無し(チルダ/純リテラル)", () => {
    it("[positive] 純リテラルのときそのまま返す", () => {
      expect(expandWord(wordOf("abc"), new Map())).toBe("abc");
    });

    it("[positive] ~のときHOMEを返す", () => {
      const env: Env = new Map([["HOME", "/home/u"]]);
      expect(expandWord(wordOf("~"), env)).toBe("/home/u");
    });

    it("[positive] ~/pのときHOME連結を返す", () => {
      const env: Env = new Map([["HOME", "/home/u"]]);
      expect(expandWord(wordOf("~/p"), env)).toBe("/home/u/p");
    });

    it("[negative] HOME未設定の~のときnullを返す", () => {
      expect(expandWord(wordOf("~"), new Map())).toBeNull();
    });

    it("[negative] ~user形のときnullを返す", () => {
      const env: Env = new Map([["HOME", "/home/u"]]);
      expect(expandWord(wordOf("~user"), env)).toBeNull();
    });
  });

  describe("parts有り", () => {
    it("[positive] $HOME(SimpleExpansion)のとき値を返す", () => {
      const env: Env = new Map([["HOME", "/home/u"]]);
      expect(expandWord(wordOf("$HOME"), env)).toBe("/home/u");
    });

    it("[negative] 未定義の$FOO(SimpleExpansion)のときnullを返す", () => {
      expect(expandWord(wordOf("$FOO"), new Map())).toBeNull();
    });

    it("[negative] 特殊パラメータ$?のときnullを返す", () => {
      expect(expandWord(wordOf("$?"), new Map())).toBeNull();
    });

    it("[positive] SingleQuotedのとき中身をそのまま返す", () => {
      expect(expandWord(wordOf("'raw'"), new Map())).toBe("raw");
    });

    it("[positive] DoubleQuotedのリテラルと$HOMEを連結して返す", () => {
      const env: Env = new Map([["HOME", "/home/u"]]);
      expect(expandWord(wordOf("\"pre$HOME\""), env)).toBe("pre/home/u");
    });

    it("[negative] コマンド置換$(...)を含むときnullを返す", () => {
      expect(expandWord(wordOf("$(date)"), new Map())).toBeNull();
    });

    it("[negative] 解決不能partが後続にあるときnullを返す(短絡)", () => {
      expect(expandWord(wordOf("a$(date)b"), new Map())).toBeNull();
    });
  });

  describe("ParameterExpansion", () => {
    it("[positive] ${VAR}のとき値を返す", () => {
      const env: Env = new Map([["VAR", "/x"]]);
      expect(expandWord(wordOf("${VAR}"), env)).toBe("/x");
    });

    it("[negative] ${VAR}が未定義のときnullを返す", () => {
      expect(expandWord(wordOf("${VAR}"), new Map())).toBeNull();
    });

    it("[negative] ${VAR}が値null(既知だが解決不能)のときnullを返す", () => {
      const env: Env = new Map([["VAR", null]]);
      expect(expandWord(wordOf("${VAR}"), env)).toBeNull();
    });

    it("[negative] 非IDENTパラメータ${1:-x}のときnullを返す", () => {
      expect(expandWord(wordOf("${1:-x}"), new Map())).toBeNull();
    });

    it("[negative] 値null時の${VAR:-def}は既定値を選べずnullを返す", () => {
      const env: Env = new Map([["VAR", null]]);
      expect(expandWord(wordOf("${VAR:-def}"), env)).toBeNull();
    });

    it.each([
      { token: "${VAR:-def}", env: new Map<string, string | null>(), want: "def" },
      { token: "${VAR:-def}", env: new Map([["VAR", ""]]), want: "def" },
      { token: "${VAR:-def}", env: new Map([["VAR", "x"]]), want: "x" },
      { token: "${VAR:-}", env: new Map<string, string | null>(), want: "" },
      { token: "${VAR-def}", env: new Map([["VAR", ""]]), want: "" },
      { token: "${VAR:=def}", env: new Map<string, string | null>(), want: "def" },
    ])(
      "[positive] $token(env=$env)のとき $want を返す",
      ({ token, env, want }: { token: string; env: Env; want: string; }) => {
        expect(expandWord(wordOf(token), env)).toBe(want);
      },
    );

    it.each([{ token: "${VAR:+x}" }, { token: "${VAR#p}" }, { token: "${VAR/a/b}" }])(
      "[negative] 非対応演算子 $token のときnullを返す",
      ({ token }: { token: string; }) => {
        const env: Env = new Map([["VAR", "px"]]);
        expect(expandWord(wordOf(token), env)).toBeNull();
      },
    );
  });
});
