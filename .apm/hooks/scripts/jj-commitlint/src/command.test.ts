import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import type { Target } from "./types.ts";

import { parseTargets } from "./command.ts";

const BASE = "/base";

// 各jj対象の有効CWDを取り出す。
const cwds = (command: string, base: string | null = BASE): (string | null)[] => parseTargets(command, base)
  .map((t) => t.cwd);

describe("parseTargets", () => {
  test("[positive] describeでrev指定が無いとき、既定の@になる", () => {
    expect(parseTargets("jj describe -m \"x\"", BASE)).toEqual([
      { subcommand: "describe", revs: ["@"], cwd: BASE },
    ]);
  });

  test("[positive] commitのとき、対象は常に@-になる", () => {
    expect(parseTargets("jj commit -m \"x\"", BASE)).toEqual([
      { subcommand: "commit", revs: ["@-"], cwd: BASE },
    ]);
  });

  test("[positive] -r REVのとき、REVが対象revになる", () => {
    expect(parseTargets("jj describe -r abc -m \"x\"", BASE)).toEqual([
      { subcommand: "describe", revs: ["abc"], cwd: BASE },
    ]);
  });

  test("[positive] --revision=VALUEのとき、VALUEが対象revになる", () => {
    expect(parseTargets("jj describe --revision=abc", BASE)).toEqual([
      { subcommand: "describe", revs: ["abc"], cwd: BASE },
    ]);
  });

  test("[positive] 密着形-rVALUEのとき、VALUEが対象revになる", () => {
    expect(parseTargets("jj describe -rabcdef", BASE)).toEqual([
      { subcommand: "describe", revs: ["abcdef"], cwd: BASE },
    ]);
  });

  test("[positive] -r=VALUEのとき、VALUEが対象revになる", () => {
    expect(parseTargets("jj describe -r=abcdef", BASE)).toEqual([
      { subcommand: "describe", revs: ["abcdef"], cwd: BASE },
    ]);
  });

  test("[positive] 位置引数でrevsetを与えたとき、それが対象revになる", () => {
    expect(parseTargets("jj describe foo -m \"x\"", BASE)).toEqual([
      { subcommand: "describe", revs: ["foo"], cwd: BASE },
    ]);
  });

  test("[negative] -mの値がフラグに見えるとき、revsetと誤認しない", () => {
    expect(parseTargets("jj describe -m \"-r not a rev\"", BASE)).toEqual([
      { subcommand: "describe", revs: ["@"], cwd: BASE },
    ]);
  });

  test.each<[string, Target]>([
    ["jj desc -m x", { subcommand: "describe", revs: ["@"], cwd: BASE }],
    ["jj ci -m x", { subcommand: "commit", revs: ["@-"], cwd: BASE }],
  ])("[positive] %s のとき describe/commitエイリアスとして解釈する", (command, expected) => {
    expect(parseTargets(command, BASE)).toEqual([expected]);
  });

  test("[positive] 絶対パスのjjのとき、jjとして認識する", () => {
    expect(parseTargets("/usr/bin/jj describe -m x", BASE)).toEqual([
      { subcommand: "describe", revs: ["@"], cwd: BASE },
    ]);
  });

  test("[positive] &&で連結されたとき、jjセグメントから抽出する", () => {
    expect(parseTargets("git status && jj describe -m \"y\"", BASE)).toEqual([
      { subcommand: "describe", revs: ["@"], cwd: BASE },
    ]);
  });

  test("[positive] ;で連結されたとき、jjセグメントから抽出する", () => {
    expect(parseTargets("git status; jj describe -m \"y\"", BASE)).toEqual([
      { subcommand: "describe", revs: ["@"], cwd: BASE },
    ]);
  });

  test.each([
    "ls -la",
    "jj log",
  ])("[negative] 非対象コマンド(%s)のとき、空になる", (command) => {
    expect(parseTargets(command, BASE)).toEqual([]);
  });

  test("[positive] -rが複数あるとき、全revを保持する", () => {
    expect(parseTargets("jj describe -r a -r b", BASE)).toEqual([
      { subcommand: "describe", revs: ["a", "b"], cwd: BASE },
    ]);
  });

  test("[positive] サブコマンド前にグローバル値フラグがあるとき、読み飛ばす", () => {
    expect(parseTargets("jj -R /repo describe -m x", BASE)).toEqual([
      { subcommand: "describe", revs: ["@"], cwd: BASE },
    ]);
  });

  test("[positive] サブコマンド前にグローバル真偽フラグがあるとき、読み飛ばす", () => {
    expect(parseTargets("jj --ignore-working-copy describe -m x", BASE)).toEqual([
      { subcommand: "describe", revs: ["@"], cwd: BASE },
    ]);
  });

  test("[positive] describeに非値フラグがあるとき、読み飛ばして既定の@になる", () => {
    expect(parseTargets("jj describe --stdin", BASE)).toEqual([
      { subcommand: "describe", revs: ["@"], cwd: BASE },
    ]);
  });

  test("[negative] jjにサブコマンドが無いとき、空になる", () => {
    expect(parseTargets("jj -R /repo", BASE)).toEqual([]);
  });

  test("[negative] -rに値が無いとき、無視して既定の@になる", () => {
    expect(parseTargets("jj describe -r", BASE)).toEqual([
      { subcommand: "describe", revs: ["@"], cwd: BASE },
    ]);
  });

  test("[positive] 引用符付きメッセージに演算子があるとき、セグメントを分割しない", () => {
    expect(parseTargets("jj describe -m \"a && b | c\"", BASE)).toEqual([
      { subcommand: "describe", revs: ["@"], cwd: BASE },
    ]);
  });

  test("[positive] リダイレクトがあるとき、revsetと誤認しない", () => {
    expect(parseTargets("jj describe -m x > /dev/null", BASE)).toEqual([
      { subcommand: "describe", revs: ["@"], cwd: BASE },
    ]);
  });

  test("[positive] コマンド置換の内部にjjがあるとき、対象にする", () => {
    expect(parseTargets("echo \"$(jj describe -m x)\"", BASE)).toEqual([
      { subcommand: "describe", revs: ["@"], cwd: BASE },
    ]);
  });

  test("[positive] バッククオートの内部にjjがあるとき、対象にする", () => {
    expect(parseTargets("echo `jj commit -m x`", BASE)).toEqual([
      { subcommand: "commit", revs: ["@-"], cwd: BASE },
    ]);
  });

  test("[positive] 代入値のコマンド置換の内部にjjがあるとき、対象にする", () => {
    expect(parseTargets("FOO=$(jj describe -r abc -m x) git status", BASE)).toEqual([
      { subcommand: "describe", revs: ["abc"], cwd: BASE },
    ]);
  });

  test("[negative] コマンド名以外の位置にjjがあるとき、対象にしない", () => {
    expect(parseTargets("echo jj describe -m x", BASE)).toEqual([]);
  });

  test("[positive] サブシェルの内部にjjがあるとき、対象にする", () => {
    expect(parseTargets("(jj describe -m x)", BASE)).toEqual([
      { subcommand: "describe", revs: ["@"], cwd: BASE },
    ]);
  });

  test("[positive] ブレースグループの内部にjjがあるとき、対象にする", () => {
    expect(parseTargets("{ jj describe -m x; }", BASE)).toEqual([
      { subcommand: "describe", revs: ["@"], cwd: BASE },
    ]);
  });

  test("[positive] forの本体にjjがあるとき、対象にする", () => {
    expect(parseTargets("for f in a b; do jj describe -r abc -m x; done", BASE)).toEqual([
      { subcommand: "describe", revs: ["abc"], cwd: BASE },
    ]);
  });

  test("[positive] ifの条件・then・elseにjjがあるとき、対象にする", () => {
    expect(parseTargets("if jj describe -m x; then jj commit -m y; else jj desc -m z; fi", BASE)).toEqual([
      { subcommand: "describe", revs: ["@"], cwd: BASE },
      { subcommand: "commit", revs: ["@-"], cwd: BASE },
      { subcommand: "describe", revs: ["@"], cwd: BASE },
    ]);
  });

  test("[positive] whileの条件と本体にjjがあるとき、対象にする", () => {
    expect(parseTargets("while jj describe -m x; do jj commit -m y; done", BASE)).toEqual([
      { subcommand: "describe", revs: ["@"], cwd: BASE },
      { subcommand: "commit", revs: ["@-"], cwd: BASE },
    ]);
  });

  test("[positive] 関数定義の本体にjjがあるとき、対象にする", () => {
    expect(parseTargets("f() { jj commit -m x; }", BASE)).toEqual([
      { subcommand: "commit", revs: ["@-"], cwd: BASE },
    ]);
  });

  test("[positive] caseの各項にjjがあるとき、対象にする", () => {
    expect(parseTargets("case x in a) jj describe -m x ;; *) jj commit -m y ;; esac", BASE)).toEqual([
      { subcommand: "describe", revs: ["@"], cwd: BASE },
      { subcommand: "commit", revs: ["@-"], cwd: BASE },
    ]);
  });

  test("[positive] 入れ子の複合構文の内部にjjがあるとき、対象にする", () => {
    expect(parseTargets("for f in a; do if true; then jj describe -m x; fi; done", BASE)).toEqual([
      { subcommand: "describe", revs: ["@"], cwd: BASE },
    ]);
  });

  test("[negative] [[ ]]の内部の語を対象にしない", () => {
    expect(parseTargets("[[ jj == describe ]] && [[ -n jj ]]", BASE)).toEqual([]);
  });

  test("[positive] [[ ]]の内部のコマンド置換にjjがあるとき、対象にする", () => {
    expect(parseTargets("[[ -n $(jj describe -m x) ]]", BASE)).toEqual([
      { subcommand: "describe", revs: ["@"], cwd: BASE },
    ]);
  });

  test("[positive] [[ ]]の二項式・入れ子の条件式の内部のコマンド置換にjjがあるとき、対象にする", () => {
    expect(parseTargets("[[ ! ( $(jj describe -r abc -m x) == $(jj commit -m y) ) ]]", BASE)).toEqual([
      { subcommand: "describe", revs: ["abc"], cwd: BASE },
      { subcommand: "commit", revs: ["@-"], cwd: BASE },
    ]);
  });
});

describe("parseTargets: cd畳み込みで有効CWDを解決する", () => {
  test.each<[string, (string | null)[]]>([
    ["jj describe -m x", ["/base"]],
    ["cd /x && jj describe -m x", ["/x"]],
    ["cd sub && jj commit -m x", ["/base/sub"]],
    ["cd /x && cd y && jj describe -m x", ["/x/y"]],
    ["(cd /x && jj describe -m x)", ["/x"]],
    ["(cd /x) && jj describe -m x", ["/base"]],
    ["cd /x | jj describe -m x", ["/base"]],
    ["{ cd /x; }; jj describe -m x", ["/x"]],
    ["cd /x || jj describe -m x", ["/base"]],
    ["cd - && jj describe -m x", [null]],
  ])("%s", (command, expected) => {
    expect(cwds(command)).toEqual(expected);
  });
});

describe("parseTargets: 複合演算子のsuccess path畳み込み", () => {
  test.each<[string, (string | null)[]]>([
    ["cd /x && cd /y ; jj describe -m x", ["/y"]],
    ["cd /x || cd /y && jj describe -m x", ["/x"]],
    ["false || cd /x && jj describe -m x", ["/x"]],
    ["cd /x && jj describe -m x || jj describe -m y", ["/x", "/x"]],
    ["cd /x ; cd /y ; cd /z && jj commit -m x", ["/z"]],
  ])("%s", (command, expected) => {
    expect(cwds(command)).toEqual(expected);
  });
});

describe("parseTargets: 変数展開とチルダ", () => {
  const saved: Record<string, string | undefined> = {};
  const keys = ["HOME", "DIR", "UNDEFINED"];

  beforeAll(() => {
    for (const k of keys) saved[k] = process.env[k];
    process.env.HOME = "/home/u";
    delete process.env.DIR;
    delete process.env.UNDEFINED;
  });

  afterAll(() => {
    for (const k of keys) {
      const v = saved[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  test.each<[string, (string | null)[]]>([
    ["cd $HOME && jj describe -m x", ["/home/u"]],
    ["cd \"$HOME/p\" && jj describe -m x", ["/home/u/p"]],
    ["cd ${UNDEFINED:-/d} && jj describe -m x", ["/d"]],
    ["cd $UNDEFINED && jj describe -m x", [null]],
    ["DIR=/x && cd $DIR && jj describe -m x", ["/x"]],
    ["export DIR=/x && cd $DIR && jj describe -m x", ["/x"]],
    ["cd $(pwd) && jj describe -m x", [null]],
  ])("%s", (command, expected) => {
    expect(cwds(command)).toEqual(expected);
  });
});
