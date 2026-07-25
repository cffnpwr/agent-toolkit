import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { parseTargets } from "./command.ts";

const BASE = "/base";

// 各jj対象の有効CWDを取り出す。
const cwds = (command: string): (string | null)[] => parseTargets(command, BASE).map((t) => t.cwd);

describe("parseTargets", () => {
  describe("メッセージ抽出", () => {
    it.each<[string, string]>([
      ["jj describe -m \"feat: x\"", "feat: x"],
      ["jj commit -m \"feat: x\"", "feat: x"],
      ["jj desc -m \"feat: x\"", "feat: x"],
      ["jj ci -m \"feat: x\"", "feat: x"],
      ["jj describe --message \"feat: x\"", "feat: x"],
      ["jj describe --message=\"feat: x\"", "feat: x"],
      ["jj describe \"-mfeat: x\"", "feat: x"],
      ["jj describe \"-m=feat: x\"", "feat: x"],
      ["jj describe -m 'feat: x'", "feat: x"],
      ["jj describe -m x", "x"],
      ["jj describe -r abc -m \"feat: x\"", "feat: x"],
      ["jj describe foo -m \"feat: x\"", "feat: x"],
      ["/usr/bin/jj describe -m \"feat: x\"", "feat: x"],
      ["jj -R /repo describe -m \"feat: x\"", "feat: x"],
      ["jj --ignore-working-copy describe -m \"feat: x\"", "feat: x"],
      ["jj describe --quiet -m \"feat: x\"", "feat: x"],
      ["jj describe -m \"feat: x\" > /dev/null", "feat: x"],
    ])("[positive] %s のとき、メッセージは %s になる", (command, message) => {
      expect(parseTargets(command, BASE)).toEqual([{ message, cwd: BASE }]);
    });

    it("[positive] -mが複数のとき、jjの適用挙動どおり空行で連結する", () => {
      expect(parseTargets("jj describe -m \"feat: a\" -m \"body b\"", BASE)).toEqual([
        { message: "feat: a\n\nbody b", cwd: BASE },
      ]);
    });

    it("[positive] -mの値が空文字列のとき、空メッセージとして抽出する", () => {
      expect(parseTargets("jj describe -m \"\"", BASE)).toEqual([
        { message: "", cwd: BASE },
      ]);
    });

    it("[positive] -mの値がフラグに見えるとき、値として扱う", () => {
      expect(parseTargets("jj describe -m \"-r not a rev\"", BASE)).toEqual([
        { message: "-r not a rev", cwd: BASE },
      ]);
    });

    it("[positive] 引用符付きメッセージに演算子があるとき、セグメントを分割しない", () => {
      expect(parseTargets("jj describe -m \"a && b | c\"", BASE)).toEqual([
        { message: "a && b | c", cwd: BASE },
      ]);
    });
  });

  describe("lint対象外(message: null)", () => {
    it.each<[string]>([
      ["jj describe"],
      ["jj describe --stdin"],
      ["jj describe -m"],
      ["jj describe -m \"$msg\""],
      ["jj describe -m \"fix: $x\""],
      ["jj describe -m \"$(cat msg)\""],
      ["jj describe --message=\"$x\""],
      ["jj describe -m\"$x\""],
      ["jj describe -m \"feat: a\" -m \"$body\""],
    ])("[negative] %s のとき、メッセージを特定できない", (command) => {
      expect(parseTargets(command, BASE)).toEqual([
        { message: null, cwd: BASE },
      ]);
    });
  });

  describe("シェル構文の走査", () => {
    it("[positive] &&で連結されたとき、jjセグメントから抽出する", () => {
      expect(parseTargets("git status && jj describe -m \"feat: y\"", BASE)).toEqual([
        { message: "feat: y", cwd: BASE },
      ]);
    });

    it("[positive] describeの後段に@を動かすコマンドが連結されても、-m値をそのまま抽出する", () => {
      expect(parseTargets("jj describe -m \"feat: x\" && jj new", BASE)).toEqual([
        { message: "feat: x", cwd: BASE },
      ]);
    });

    it("[positive] ;で連結されたとき、jjセグメントから抽出する", () => {
      expect(parseTargets("git status; jj describe -m \"feat: y\"", BASE)).toEqual([
        { message: "feat: y", cwd: BASE },
      ]);
    });

    it.each<[string]>([
      ["ls -la"],
      ["jj log"],
      ["jj new"],
      ["jj -R /repo"],
      ["echo jj describe -m x"],
    ])("[negative] 非対象コマンド(%s)のとき、空になる", (command) => {
      expect(parseTargets(command, BASE)).toEqual([]);
    });

    it("[positive] コマンド置換の内部にjjがあるとき、対象にする", () => {
      expect(parseTargets("echo \"$(jj describe -m 'feat: x')\"", BASE)).toEqual([
        { message: "feat: x", cwd: BASE },
      ]);
    });

    it("[positive] バッククオートの内部にjjがあるとき、対象にする", () => {
      expect(parseTargets("echo `jj commit -m 'feat: x'`", BASE)).toEqual([
        { message: "feat: x", cwd: BASE },
      ]);
    });

    it("[positive] 代入値のコマンド置換の内部にjjがあるとき、対象にする", () => {
      expect(parseTargets("FOO=$(jj describe -r abc -m 'feat: x') git status", BASE)).toEqual([
        { message: "feat: x", cwd: BASE },
      ]);
    });

    it("[positive] サブシェルの内部にjjがあるとき、対象にする", () => {
      expect(parseTargets("(jj describe -m 'feat: x')", BASE)).toEqual([
        { message: "feat: x", cwd: BASE },
      ]);
    });

    it("[positive] ブレースグループの内部にjjがあるとき、対象にする", () => {
      expect(parseTargets("{ jj describe -m 'feat: x'; }", BASE)).toEqual([
        { message: "feat: x", cwd: BASE },
      ]);
    });

    it("[positive] forの本体にjjがあるとき、対象にする", () => {
      expect(parseTargets("for f in a b; do jj describe -r abc -m 'feat: x'; done", BASE)).toEqual([
        { message: "feat: x", cwd: BASE },
      ]);
    });

    it("[positive] ifの条件・then・elseにjjがあるとき、対象にする", () => {
      expect(parseTargets("if jj describe -m 'feat: x'; then jj commit -m 'feat: y'; else jj desc -m 'feat: z'; fi", BASE)).toEqual([
        { message: "feat: x", cwd: BASE },
        { message: "feat: y", cwd: BASE },
        { message: "feat: z", cwd: BASE },
      ]);
    });

    it("[positive] whileの条件と本体にjjがあるとき、対象にする", () => {
      expect(parseTargets("while jj describe -m 'feat: x'; do jj commit -m 'feat: y'; done", BASE)).toEqual([
        { message: "feat: x", cwd: BASE },
        { message: "feat: y", cwd: BASE },
      ]);
    });

    it("[positive] 関数定義の本体にjjがあるとき、対象にする", () => {
      expect(parseTargets("f() { jj commit -m 'feat: x'; }", BASE)).toEqual([
        { message: "feat: x", cwd: BASE },
      ]);
    });

    it("[positive] caseの各項にjjがあるとき、対象にする", () => {
      expect(parseTargets("case x in a) jj describe -m 'feat: x' ;; *) jj commit -m 'feat: y' ;; esac", BASE)).toEqual([
        { message: "feat: x", cwd: BASE },
        { message: "feat: y", cwd: BASE },
      ]);
    });

    it("[positive] 入れ子の複合構文の内部にjjがあるとき、対象にする", () => {
      expect(parseTargets("for f in a; do if true; then jj describe -m 'feat: x'; fi; done", BASE)).toEqual([
        { message: "feat: x", cwd: BASE },
      ]);
    });

    it("[negative] [[ ]]の内部の語を対象にしない", () => {
      expect(parseTargets("[[ jj == describe ]] && [[ -n jj ]]", BASE)).toEqual([]);
    });

    it("[positive] [[ ]]の内部のコマンド置換にjjがあるとき、対象にする", () => {
      expect(parseTargets("[[ -n $(jj describe -m 'feat: x') ]]", BASE)).toEqual([
        { message: "feat: x", cwd: BASE },
      ]);
    });

    it("[positive] [[ ]]の二項式・入れ子の条件式の内部のコマンド置換にjjがあるとき、対象にする", () => {
      expect(parseTargets("[[ ! ( $(jj describe -r abc -m 'feat: x') == $(jj commit -m 'feat: y') ) ]]", BASE)).toEqual([
        { message: "feat: x", cwd: BASE },
        { message: "feat: y", cwd: BASE },
      ]);
    });
  });

  describe("cd畳み込みで有効CWDを解決する", () => {
    it.each<[string, string[]]>([
      ["jj describe -m x", ["/base"]],
      ["cd /x && jj describe -m x", ["/x"]],
      ["cd sub && jj commit -m x", ["/base/sub"]],
      ["cd /x && cd y && jj describe -m x", ["/x/y"]],
      ["(cd /x && jj describe -m x)", ["/x"]],
      ["(cd /x) && jj describe -m x", ["/base"]],
      ["cd /x | jj describe -m x", ["/base"]],
      ["{ cd /x; }; jj describe -m x", ["/x"]],
      ["cd /x || jj describe -m x", ["/base"]],
    ])("[positive] %s のとき、有効CWDは %s になる", (command, expected) => {
      expect(cwds(command)).toEqual(expected);
    });

    it("[negative] cd - のとき、有効CWDを解決できない", () => {
      expect(cwds("cd - && jj describe -m x")).toEqual([null]);
    });
  });

  describe("複合演算子のsuccess path畳み込み", () => {
    it.each<[string, string[]]>([
      ["cd /x && cd /y ; jj describe -m x", ["/y"]],
      ["cd /x || cd /y && jj describe -m x", ["/x"]],
      ["false || cd /x && jj describe -m x", ["/x"]],
      ["cd /x && jj describe -m x || jj describe -m y", ["/x", "/x"]],
      ["cd /x ; cd /y ; cd /z && jj commit -m x", ["/z"]],
    ])("[positive] %s のとき、有効CWDは %s になる", (command, expected) => {
      expect(cwds(command)).toEqual(expected);
    });
  });

  describe("変数展開とチルダ", () => {
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

    it.each<[string, string[]]>([
      ["cd $HOME && jj describe -m x", ["/home/u"]],
      ["cd \"$HOME/p\" && jj describe -m x", ["/home/u/p"]],
      ["cd ${UNDEFINED:-/d} && jj describe -m x", ["/d"]],
      ["DIR=/x && cd $DIR && jj describe -m x", ["/x"]],
      ["export DIR=/x && cd $DIR && jj describe -m x", ["/x"]],
    ])("[positive] %s のとき、有効CWDは %s になる", (command, expected) => {
      expect(cwds(command)).toEqual(expected);
    });

    it.each<[string]>([
      ["cd $UNDEFINED && jj describe -m x"],
      ["cd $(pwd) && jj describe -m x"],
    ])("[negative] %s のとき、有効CWDを解決できない", (command) => {
      expect(cwds(command)).toEqual([null]);
    });
  });
});
