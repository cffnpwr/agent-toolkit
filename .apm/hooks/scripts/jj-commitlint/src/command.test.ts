import { describe, expect, test } from "bun:test";

import { parseTargets } from "./command.ts";

describe("parseTargets", () => {
  test("[positive] describeでrev指定が無いとき、既定の@になる", () => {
    expect(parseTargets("jj describe -m \"x\"")).toEqual([{ subcommand: "describe", revs: ["@"] }]);
  });

  test("[positive] commitのとき、対象は常に@-になる", () => {
    expect(parseTargets("jj commit -m \"x\"")).toEqual([{ subcommand: "commit", revs: ["@-"] }]);
  });

  test("[positive] -r REVのとき、REVが対象revになる", () => {
    expect(parseTargets("jj describe -r abc -m \"x\"")).toEqual([
      { subcommand: "describe", revs: ["abc"] },
    ]);
  });

  test("[positive] --revision=VALUEのとき、VALUEが対象revになる", () => {
    expect(parseTargets("jj describe --revision=abc")).toEqual([
      { subcommand: "describe", revs: ["abc"] },
    ]);
  });

  test("[positive] 密着形-rVALUEのとき、VALUEが対象revになる", () => {
    expect(parseTargets("jj describe -rabcdef")).toEqual([
      { subcommand: "describe", revs: ["abcdef"] },
    ]);
  });

  test("[positive] -r=VALUEのとき、VALUEが対象revになる", () => {
    expect(parseTargets("jj describe -r=abcdef")).toEqual([
      { subcommand: "describe", revs: ["abcdef"] },
    ]);
  });

  test("[positive] 位置引数でrevsetを与えたとき、それが対象revになる", () => {
    expect(parseTargets("jj describe foo -m \"x\"")).toEqual([
      { subcommand: "describe", revs: ["foo"] },
    ]);
  });

  test("[negative] -mの値がフラグに見えるとき、revsetと誤認しない", () => {
    expect(parseTargets("jj describe -m \"-r not a rev\"")).toEqual([
      { subcommand: "describe", revs: ["@"] },
    ]);
  });

  test("[positive] desc/ciエイリアスのとき、describe/commitとして解釈する", () => {
    expect(parseTargets("jj desc -m x")).toEqual([{ subcommand: "describe", revs: ["@"] }]);
    expect(parseTargets("jj ci -m x")).toEqual([{ subcommand: "commit", revs: ["@-"] }]);
  });

  test("[positive] 絶対パスのjjのとき、jjとして認識する", () => {
    expect(parseTargets("/usr/bin/jj describe -m x")).toEqual([
      { subcommand: "describe", revs: ["@"] },
    ]);
  });

  test("[positive] &&で連結されたとき、jjセグメントから抽出する", () => {
    expect(parseTargets("git status && jj describe -m \"y\"")).toEqual([
      { subcommand: "describe", revs: ["@"] },
    ]);
  });

  test("[positive] ;で連結されたとき、jjセグメントから抽出する", () => {
    expect(parseTargets("git status; jj describe -m \"y\"")).toEqual([
      { subcommand: "describe", revs: ["@"] },
    ]);
  });

  test("[negative] 非対象コマンドのとき、空になる", () => {
    expect(parseTargets("ls -la")).toEqual([]);
    expect(parseTargets("jj log")).toEqual([]);
  });

  test("[positive] -rが複数あるとき、全revを保持する", () => {
    expect(parseTargets("jj describe -r a -r b")).toEqual([
      { subcommand: "describe", revs: ["a", "b"] },
    ]);
  });

  test("[positive] サブコマンド前にグローバル値フラグがあるとき、読み飛ばす", () => {
    expect(parseTargets("jj -R /repo describe -m x")).toEqual([
      { subcommand: "describe", revs: ["@"] },
    ]);
  });

  test("[positive] サブコマンド前にグローバル真偽フラグがあるとき、読み飛ばす", () => {
    expect(parseTargets("jj --ignore-working-copy describe -m x")).toEqual([
      { subcommand: "describe", revs: ["@"] },
    ]);
  });

  test("[positive] describeに非値フラグがあるとき、読み飛ばして既定の@になる", () => {
    expect(parseTargets("jj describe --stdin")).toEqual([
      { subcommand: "describe", revs: ["@"] },
    ]);
  });

  test("[negative] jjにサブコマンドが無いとき、空になる", () => {
    expect(parseTargets("jj -R /repo")).toEqual([]);
  });

  test("[negative] -rに値が無いとき、無視して既定の@になる", () => {
    expect(parseTargets("jj describe -r")).toEqual([
      { subcommand: "describe", revs: ["@"] },
    ]);
  });

  test("[positive] 引用符付きメッセージに演算子があるとき、セグメントを分割しない", () => {
    expect(parseTargets("jj describe -m \"a && b | c\"")).toEqual([
      { subcommand: "describe", revs: ["@"] },
    ]);
  });

  test("[positive] リダイレクトがあるとき、revsetと誤認しない", () => {
    expect(parseTargets("jj describe -m x > /dev/null")).toEqual([
      { subcommand: "describe", revs: ["@"] },
    ]);
  });

  test("[positive] コマンド置換の内部にjjがあるとき、対象にする", () => {
    expect(parseTargets("echo \"$(jj describe -m x)\"")).toEqual([
      { subcommand: "describe", revs: ["@"] },
    ]);
  });

  test("[positive] バッククオートの内部にjjがあるとき、対象にする", () => {
    expect(parseTargets("echo `jj commit -m x`")).toEqual([
      { subcommand: "commit", revs: ["@-"] },
    ]);
  });

  test("[positive] 代入値のコマンド置換の内部にjjがあるとき、対象にする", () => {
    expect(parseTargets("FOO=$(jj describe -r abc -m x) git status")).toEqual([
      { subcommand: "describe", revs: ["abc"] },
    ]);
  });

  test("[negative] コマンド名以外の位置にjjがあるとき、対象にしない", () => {
    expect(parseTargets("echo jj describe -m x")).toEqual([]);
  });

  test("[negative] サブシェルの内部にjjがあるとき、対象にしない", () => {
    expect(parseTargets("(jj describe -m x)")).toEqual([]);
  });
});
