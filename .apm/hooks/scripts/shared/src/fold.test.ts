import { describe, expect, it } from "bun:test";

import type { CollectRow } from "./test-support.ts";
import type { Env } from "./types.ts";

import { collectFold } from "./test-support.ts";

describe("foldSequence(逐次と有効CWDの引き回し)", () => {
  it("[positive] ;区切りでcd後の有効CWDを後続へ引き回す", () => {
    expect(collectFold("cd /a; git status", "/base")).toEqual([
      ["cd", "/base"],
      ["git", "/a"],
    ]);
  });

  it("[positive] 相対cdをbaseCwd基準で解決する", () => {
    expect(collectFold("cd a; git status", "/base")).toEqual([
      ["cd", "/base"],
      ["git", "/base/a"],
    ]);
  });

  it("[positive] 連続cdを順に合成する", () => {
    expect(collectFold("cd /x/y; cd ..; git status", "/base")).toEqual([
      ["cd", "/base"],
      ["cd", "/x/y"],
      ["git", "/x"],
    ]);
  });
});

describe("walkAndOr(&&/||の経路)", () => {
  it("[positive] &&は左cd成功後の有効CWDで右辺を採取する", () => {
    expect(collectFold("cd /a && cd b && git status", "/base")).toEqual([
      ["cd", "/base"],
      ["cd", "/a"],
      ["git", "/a/b"],
    ]);
  });

  it("[positive] ||は左cd成功でスキップされる右辺を適用前CWDで採取する", () => {
    expect(collectFold("cd /a || git status", "/base")).toEqual([
      ["cd", "/base"],
      ["git", "/base"],
    ]);
  });

  it("[positive] 解決不能cdの後の||右辺は実行経路として現在状態で採取する", () => {
    expect(collectFold("cd - || git status", "/base")).toEqual([
      ["cd", "/base"],
      ["git", null],
    ]);
  });

  it("[positive] 非cdの後の||右辺は現在CWDで採取する", () => {
    expect(collectFold("false || git status", "/base")).toEqual([
      ["false", "/base"],
      ["git", "/base"],
    ]);
  });
});

describe("walk(スコープ分離)", () => {
  it("[positive] サブシェル内のcdは外へ伝播しない", () => {
    expect(collectFold("(cd /a; git status); jj st", "/base")).toEqual([
      ["cd", "/base"],
      ["git", "/a"],
      ["jj", "/base"],
    ]);
  });

  it("[positive] brace groupのcdは同一シェルとして後続へ伝播する", () => {
    expect(collectFold("{ cd /a; git status; }; jj st", "/base")).toEqual([
      ["cd", "/base"],
      ["git", "/a"],
      ["jj", "/a"],
    ]);
  });

  it("[positive] パイプ内のcdは外へ伝播しない", () => {
    expect(collectFold("cd /a | git status; jj st", "/base")).toEqual([
      ["cd", "/base"],
      ["git", "/base"],
      ["jj", "/base"],
    ]);
  });

  it("[positive] background(&)のcdは外へ伝播しない", () => {
    expect(collectFold("cd /a & git status", "/base")).toEqual([
      ["cd", "/base"],
      ["git", "/base"],
    ]);
  });

  // 分離スコープの各構文: 内側のcdは外(末尾jj)へ漏れず、内側gitは内側cwdで採取する。
  it.each([
    { name: "if", src: "if cd /a; then cd /b; git status; fi; jj st", inner: "/b" },
    { name: "for", src: "for f in x; do cd /a; git status; done; jj st", inner: "/a" },
    { name: "while", src: "while false; do cd /a; git status; done; jj st", inner: "/a" },
    { name: "select", src: "select f in x; do cd /a; git status; done; jj st", inner: "/a" },
    { name: "arithmetic-for", src: "for ((i=0;i<1;i++)); do cd /a; git status; done; jj st", inner: "/a" },
    { name: "function", src: "f() { cd /a; git status; }; jj st", inner: "/a" },
    { name: "case", src: "case x in x) cd /a; git status;; esac; jj st", inner: "/a" },
    { name: "coproc", src: "coproc c { cd /a; git status; }; jj st", inner: "/a" },
  ])("[positive] $name 本体のcdは外へ伝播せず内側gitは内側cwdで採取する", ({ src, inner }: { src: string; inner: string; }) => {
    const rows = collectFold(src, "/base");
    expect(rows).toContainEqual(["git", inner]);
    expect(rows.at(-1)).toEqual(["jj", "/base"]);
  });

  it("[positive] whileのclauseのcdはbodyへ伝播しない", () => {
    // clauseはコピー走査のため、bodyのgitはbaseで採取される。
    expect(collectFold("while cd /a; do git status; done; jj st", "/base")).toEqual([
      ["cd", "/base"],
      ["git", "/base"],
      ["jj", "/base"],
    ]);
  });
});

describe("walkCommand(置換の走査)", () => {
  it("[positive] コマンド置換内のコマンドを現在の有効CWDで採取する", () => {
    expect(collectFold("cd /a && echo `git status`", "/base")).toEqual([
      ["cd", "/base"],
      ["echo", "/a"],
      ["git", "/a"],
    ]);
  });

  it("[positive] [[ ]]内の置換のコマンドを採取する", () => {
    expect(collectFold("[[ -n $(git status) ]]; jj st", "/base")).toEqual([
      ["git", "/base"],
      ["jj", "/base"],
    ]);
  });

  it("[positive] 算術コマンドは採取せず後続を維持する", () => {
    expect(collectFold("(( x + 1 )); jj st", "/base")).toEqual([["jj", "/base"]]);
  });
});

describe("walkCommand(代入と変数展開)", () => {
  it("[positive] export後の変数をcdの移動先展開に使う", () => {
    expect(collectFold("export FOO=/e; cd $FOO; git status", "/base")).toEqual([
      ["export", "/base"],
      ["cd", "/base"],
      ["git", "/e"],
    ]);
  });

  it("[positive] 単独代入後の変数をcdの移動先展開に使う", () => {
    expect(collectFold("FOO=/e; cd $FOO; git status", "/base")).toEqual([
      [undefined, "/base"],
      ["cd", "/base"],
      ["git", "/e"],
    ]);
  });

  it("[negative] 前置一時代入は追跡せずcdの移動先が解決不能になる", () => {
    expect(collectFold("FOO=/e cd $FOO; git status", "/base")).toEqual([
      ["cd", "/base"],
      ["git", null],
    ]);
  });

  it("[positive] 引数無しcdはenvのHOMEへ移動する", () => {
    const env: Env = new Map([["HOME", "/home/u"]]);
    expect(collectFold("cd; git status", "/base", env)).toEqual([
      ["cd", "/base"],
      ["git", "/home/u"],
    ]);
  });

  it("[positive] チルダをenvのHOMEで展開する", () => {
    const env: Env = new Map([["HOME", "/home/u"]]);
    expect(collectFold("cd ~/p; git status", "/base", env)).toEqual([
      ["cd", "/base"],
      ["git", "/home/u/p"],
    ]);
  });
});

describe("foldSequence(baseCwd不明)", () => {
  it("[negative] baseCwdがnullなら相対cd後も不明のまま", () => {
    const rows: CollectRow[] = collectFold("cd sub; git status", null);
    expect(rows).toEqual([
      ["cd", null],
      ["git", null],
    ]);
  });
});
