import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import type { GitCall } from "./types.ts";

import { classify } from "./classify.ts";
import { parseGitCalls } from "./command.ts";

const BASE = "/base";

// parseGitCallsとclassifyを通し、ブロック対象のサブコマンドを返す。
const blocked = (command: string): string[] => parseGitCalls(command, BASE)
  .filter((call) => classify(call) !== undefined)
  .map((call) => call.subcommand);

// 各git呼び出しの有効CWDを取り出す。
const cwds = (command: string, base: string | null = BASE): (string | null)[] => parseGitCalls(command, base)
  .map((call) => call.cwd);

describe("parseGitCalls", () => {
  test("[negative] jj git pushのとき、先頭語はjjなので抽出しない", () => {
    expect(parseGitCalls("jj git push", BASE)).toEqual([]);
  });

  test("[negative] コマンド名以外の位置にgitがあるとき、抽出しない", () => {
    expect(parseGitCalls("echo git commit", BASE)).toEqual([]);
    expect(parseGitCalls("grep \"git commit\" file", BASE)).toEqual([]);
  });

  test("[positive] &&で連結されたとき、第2セグメントのgitを抽出する", () => {
    expect(parseGitCalls("foo && git push", BASE)).toEqual([
      { subcommand: "push", args: [], cwd: BASE },
    ]);
  });

  test("[positive] グローバル値フラグ-Cを跨いでサブコマンドを特定する", () => {
    expect(parseGitCalls("git -C /path commit", BASE)).toEqual([
      { subcommand: "commit", args: [], cwd: BASE },
    ]);
  });

  test("[positive] 先頭env代入を飛ばしてgitを抽出する", () => {
    expect(parseGitCalls("FOO=bar git commit -m x", BASE)).toEqual([
      { subcommand: "commit", args: ["-m", "x"], cwd: BASE },
    ]);
  });

  test("[positive] 絶対パスのgitのとき、gitとして認識する", () => {
    expect(parseGitCalls("/usr/bin/git status", BASE)).toEqual([
      { subcommand: "status", args: [], cwd: BASE },
    ]);
  });

  test("[negative] PREFER_JJ_DISABLE=1の前置があるsimple commandは除外する", () => {
    expect(parseGitCalls("PREFER_JJ_DISABLE=1 git push", BASE)).toEqual([]);
  });

  test("[positive] PREFER_JJ_DISABLEの前置が偽値のとき、バイパスしない", () => {
    expect(parseGitCalls("PREFER_JJ_DISABLE=0 git push", BASE)).toEqual([
      { subcommand: "push", args: [], cwd: BASE },
    ]);
    expect(parseGitCalls("PREFER_JJ_DISABLE=false git push", BASE)).toEqual([
      { subcommand: "push", args: [], cwd: BASE },
    ]);
    expect(parseGitCalls("PREFER_JJ_DISABLE= git push", BASE)).toEqual([
      { subcommand: "push", args: [], cwd: BASE },
    ]);
  });

  test("[positive] バイパスはsimple command単位で、後続のgitは抽出する", () => {
    expect(parseGitCalls("PREFER_JJ_DISABLE=1 git push && git status", BASE)).toEqual([
      { subcommand: "status", args: [], cwd: BASE },
    ]);
  });

  test("[positive] コマンド置換の内部のgitを抽出する", () => {
    expect(parseGitCalls("echo \"$(git status)\"", BASE)).toEqual([
      { subcommand: "status", args: [], cwd: BASE },
    ]);
  });

  test("[positive] バッククオートの内部のgitを抽出する", () => {
    expect(parseGitCalls("echo `git log`", BASE)).toEqual([
      { subcommand: "log", args: [], cwd: BASE },
    ]);
  });

  test("[positive] 代入値のコマンド置換の内部のgitを抽出する", () => {
    expect(parseGitCalls("FOO=$(git status) ls", BASE)).toEqual([
      { subcommand: "status", args: [], cwd: BASE },
    ]);
  });

  test("[positive] プロセス置換の内部のgitを抽出する", () => {
    expect(parseGitCalls("diff <(git diff) file", BASE)).toEqual([
      { subcommand: "diff", args: [], cwd: BASE },
    ]);
  });

  test("[positive] サブシェルの内部のgitを抽出する", () => {
    expect(parseGitCalls("(git status)", BASE)).toEqual([
      { subcommand: "status", args: [], cwd: BASE },
    ]);
  });

  test("[positive] ブレースグループの内部のgitを抽出する", () => {
    expect(parseGitCalls("{ git status; }", BASE)).toEqual([
      { subcommand: "status", args: [], cwd: BASE },
    ]);
  });

  test("[positive] forの本体のgitを抽出する", () => {
    expect(parseGitCalls("for f in a b; do git add x; done", BASE)).toEqual([
      { subcommand: "add", args: ["x"], cwd: BASE },
    ]);
  });

  test("[positive] ifの条件・then・elseのgitを抽出する", () => {
    expect(parseGitCalls("if git fetch; then git status; else git log; fi", BASE)).toEqual([
      { subcommand: "fetch", args: [], cwd: BASE },
      { subcommand: "status", args: [], cwd: BASE },
      { subcommand: "log", args: [], cwd: BASE },
    ]);
  });

  test("[positive] elif節のgitを抽出する", () => {
    expect(parseGitCalls("if true; then ls; elif git status; then ls; fi", BASE)).toEqual([
      { subcommand: "status", args: [], cwd: BASE },
    ]);
  });

  test("[positive] whileの条件と本体のgitを抽出する", () => {
    expect(parseGitCalls("while git fetch; do git status; done", BASE)).toEqual([
      { subcommand: "fetch", args: [], cwd: BASE },
      { subcommand: "status", args: [], cwd: BASE },
    ]);
  });

  test("[positive] 関数定義の本体のgitを抽出する", () => {
    expect(parseGitCalls("f() { git status; }", BASE)).toEqual([
      { subcommand: "status", args: [], cwd: BASE },
    ]);
  });

  test("[positive] caseの各項のgitを抽出する", () => {
    expect(parseGitCalls("case x in a) git status ;; *) git log ;; esac", BASE)).toEqual([
      { subcommand: "status", args: [], cwd: BASE },
      { subcommand: "log", args: [], cwd: BASE },
    ]);
  });

  test("[positive] 入れ子の複合構文の内部のgitを抽出する", () => {
    expect(parseGitCalls("for f in a; do if true; then git status; fi; done", BASE)).toEqual([
      { subcommand: "status", args: [], cwd: BASE },
    ]);
  });

  test("[negative] [[ ]]の内部の語はコマンドとして抽出しない", () => {
    expect(parseGitCalls("[[ git == git ]] && [[ -n git ]]", BASE)).toEqual([]);
  });

  test("[positive] [[ ]]の内部のコマンド置換のgitを抽出する", () => {
    expect(parseGitCalls("[[ -n $(git status) ]]", BASE)).toEqual([
      { subcommand: "status", args: [], cwd: BASE },
    ]);
  });

  test("[positive] [[ ]]の二項式・入れ子の条件式の内部のコマンド置換のgitを抽出する", () => {
    expect(parseGitCalls("[[ ! ( $(git log) == $(git diff) || -z x ) ]]", BASE)).toEqual([
      { subcommand: "log", args: [], cwd: BASE },
      { subcommand: "diff", args: [], cwd: BASE },
    ]);
  });

  test("[negative] gitにサブコマンドが無いとき、抽出しない", () => {
    expect(parseGitCalls("git --version", BASE)).toEqual([]);
  });
});

describe("parseGitCalls: cd畳み込みで有効CWDを解決する", () => {
  test.each<[string, (string | null)[]]>([
    ["git status", ["/base"]],
    ["cd /x && git status", ["/x"]],
    ["cd sub && git status", ["/base/sub"]],
    ["cd /x && cd y && git status", ["/x/y"]],
    ["cd /x && git status && cd /y && git status", ["/x", "/y"]],
    ["(cd /x && git status)", ["/x"]],
    ["(cd /x) && git status", ["/base"]],
    ["cd /x | git status", ["/base"]],
    ["cd /x & git status", ["/base"]],
    ["{ cd /x; }; git status", ["/x"]],
    ["cd /x || git status", ["/base"]],
    ["cd - && git status", [null]],
    ["foo && cd /x && git status", ["/x"]],
  ])("%s", (command, expected) => {
    expect(cwds(command)).toEqual(expected);
  });
});

describe("parseGitCalls: 複合演算子のsuccess path畳み込み", () => {
  test.each<[string, (string | null)[]]>([
    ["cd /x && cd /y ; git status", ["/y"]],
    ["cd /x ; cd /y && git status", ["/y"]],
    ["cd /x && false ; git status", ["/x"]],
    ["cd /x || cd /y ; git status", ["/x"]],
    ["cd /x || cd /y && git status", ["/x"]],
    ["cd /x && git status || git log", ["/x", "/x"]],
    ["false || cd /x && git status", ["/x"]],
    ["cd /x ; cd /y ; cd /z && git status", ["/z"]],
  ])("%s", (command, expected) => {
    expect(cwds(command)).toEqual(expected);
  });
});

describe("parseGitCalls: 変数展開とチルダ", () => {
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
    ["cd && git status", ["/home/u"]],
    ["cd ~/x && git status", ["/home/u/x"]],
    ["cd $HOME && git status", ["/home/u"]],
    ["cd \"$HOME/p\" && git status", ["/home/u/p"]],
    ["cd ${HOME} && git status", ["/home/u"]],
    ["cd $UNDEFINED && git status", [null]],
    ["cd ${UNDEFINED:-/d} && git status", ["/d"]],
    ["DIR=/x && cd $DIR && git status", ["/x"]],
    ["DIR=/x; cd $DIR && git status", ["/x"]],
    ["export DIR=/x && cd $DIR && git status", ["/x"]],
    ["DIR=$HOME/p && cd $DIR && git status", ["/home/u/p"]],
    ["DIR=/x cd $DIR && git status", [null]],
    ["(DIR=/x) && cd $DIR && git status", [null]],
    ["cd $(pwd) && git status", [null]],
  ])("%s", (command, expected) => {
    expect(cwds(command)).toEqual(expected);
  });
});

describe("classify", () => {
  test("[positive] git statusのとき、jj stへ誘導する", () => {
    const [call] = parseGitCalls("git status", BASE);
    expect(call).toBeDefined();
    expect(classify(call as GitCall)).toContain("jj st");
  });

  test("[positive] git clone URLのとき、jj git cloneへ誘導する", () => {
    const [call] = parseGitCalls("git clone https://example.com/repo.git", BASE);
    expect(call).toBeDefined();
    expect(classify(call as GitCall)).toContain("jj git clone");
  });

  test("[negative] git clone --depth 1のとき、shallow例外で通過する", () => {
    expect(blocked("git clone --depth 1 https://example.com/repo.git")).toEqual([]);
  });

  test("[negative] git fetch --filterのとき、partial例外で通過する", () => {
    expect(blocked("git fetch --filter=blob:none origin")).toEqual([]);
  });

  test("[negative] git fetch --unshallowのとき、通過する", () => {
    expect(blocked("git fetch --unshallow")).toEqual([]);
  });

  test("[negative] git submodule updateのとき、git専用として通過する", () => {
    expect(blocked("git submodule update")).toEqual([]);
  });

  test("[negative] git configのとき、git専用として通過する", () => {
    expect(blocked("git config user.name")).toEqual([]);
  });

  test("[positive] 複合コマンドの各セグメントを個別に判定する", () => {
    expect(blocked("git fetch --depth 1 origin && git status")).toEqual(["status"]);
  });
});
