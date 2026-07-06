import { describe, expect, test } from "bun:test";

import { classify } from "./classify.ts";
import { parseGitCalls } from "./command.ts";

// parseGitCallsとclassifyを通し、ブロック対象のサブコマンドを返す。
const blocked = (command: string): string[] => parseGitCalls(command)
  .filter((call) => classify(call) !== undefined)
  .map((call) => call.subcommand);

describe("parseGitCalls", () => {
  test("[negative] jj git pushのとき、先頭語はjjなので抽出しない", () => {
    expect(parseGitCalls("jj git push")).toEqual([]);
  });

  test("[negative] コマンド名以外の位置にgitがあるとき、抽出しない", () => {
    expect(parseGitCalls("echo git commit")).toEqual([]);
    expect(parseGitCalls("grep \"git commit\" file")).toEqual([]);
  });

  test("[positive] &&で連結されたとき、第2セグメントのgitを抽出する", () => {
    expect(parseGitCalls("foo && git push")).toEqual([{ subcommand: "push", args: [] }]);
  });

  test("[positive] グローバル値フラグ-Cを跨いでサブコマンドを特定する", () => {
    expect(parseGitCalls("git -C /path commit")).toEqual([{ subcommand: "commit", args: [] }]);
  });

  test("[positive] 先頭env代入を飛ばしてgitを抽出する", () => {
    expect(parseGitCalls("FOO=bar git commit -m x")).toEqual([
      { subcommand: "commit", args: ["-m", "x"] },
    ]);
  });

  test("[positive] 絶対パスのgitのとき、gitとして認識する", () => {
    expect(parseGitCalls("/usr/bin/git status")).toEqual([{ subcommand: "status", args: [] }]);
  });

  test("[negative] PREFER_JJ_DISABLE=1の前置があるsimple commandは除外する", () => {
    expect(parseGitCalls("PREFER_JJ_DISABLE=1 git push")).toEqual([]);
  });

  test("[positive] PREFER_JJ_DISABLEの前置が偽値のとき、バイパスしない", () => {
    expect(parseGitCalls("PREFER_JJ_DISABLE=0 git push")).toEqual([
      { subcommand: "push", args: [] },
    ]);
    expect(parseGitCalls("PREFER_JJ_DISABLE=false git push")).toEqual([
      { subcommand: "push", args: [] },
    ]);
    expect(parseGitCalls("PREFER_JJ_DISABLE= git push")).toEqual([
      { subcommand: "push", args: [] },
    ]);
  });

  test("[positive] バイパスはsimple command単位で、後続のgitは抽出する", () => {
    expect(parseGitCalls("PREFER_JJ_DISABLE=1 git push && git status")).toEqual([
      { subcommand: "status", args: [] },
    ]);
  });

  test("[positive] コマンド置換の内部のgitを抽出する", () => {
    expect(parseGitCalls("echo \"$(git status)\"")).toEqual([
      { subcommand: "status", args: [] },
    ]);
  });

  test("[positive] バッククオートの内部のgitを抽出する", () => {
    expect(parseGitCalls("echo `git log`")).toEqual([{ subcommand: "log", args: [] }]);
  });

  test("[positive] 代入値のコマンド置換の内部のgitを抽出する", () => {
    expect(parseGitCalls("FOO=$(git status) ls")).toEqual([{ subcommand: "status", args: [] }]);
  });

  test("[positive] プロセス置換の内部のgitを抽出する", () => {
    expect(parseGitCalls("diff <(git diff) file")).toEqual([{ subcommand: "diff", args: [] }]);
  });

  test("[positive] サブシェルの内部のgitを抽出する", () => {
    expect(parseGitCalls("(git status)")).toEqual([{ subcommand: "status", args: [] }]);
  });

  test("[positive] ブレースグループの内部のgitを抽出する", () => {
    expect(parseGitCalls("{ git status; }")).toEqual([{ subcommand: "status", args: [] }]);
  });

  test("[positive] forの本体のgitを抽出する", () => {
    expect(parseGitCalls("for f in a b; do git add x; done")).toEqual([
      { subcommand: "add", args: ["x"] },
    ]);
  });

  test("[positive] ifの条件・then・elseのgitを抽出する", () => {
    expect(parseGitCalls("if git fetch; then git status; else git log; fi")).toEqual([
      { subcommand: "fetch", args: [] },
      { subcommand: "status", args: [] },
      { subcommand: "log", args: [] },
    ]);
  });

  test("[positive] elif節のgitを抽出する", () => {
    expect(parseGitCalls("if true; then ls; elif git status; then ls; fi")).toEqual([
      { subcommand: "status", args: [] },
    ]);
  });

  test("[positive] whileの条件と本体のgitを抽出する", () => {
    expect(parseGitCalls("while git fetch; do git status; done")).toEqual([
      { subcommand: "fetch", args: [] },
      { subcommand: "status", args: [] },
    ]);
  });

  test("[positive] 関数定義の本体のgitを抽出する", () => {
    expect(parseGitCalls("f() { git status; }")).toEqual([{ subcommand: "status", args: [] }]);
  });

  test("[positive] caseの各項のgitを抽出する", () => {
    expect(parseGitCalls("case x in a) git status ;; *) git log ;; esac")).toEqual([
      { subcommand: "status", args: [] },
      { subcommand: "log", args: [] },
    ]);
  });

  test("[positive] 入れ子の複合構文の内部のgitを抽出する", () => {
    expect(parseGitCalls("for f in a; do if true; then git status; fi; done")).toEqual([
      { subcommand: "status", args: [] },
    ]);
  });

  test("[negative] [[ ]]の内部の語はコマンドとして抽出しない", () => {
    expect(parseGitCalls("[[ git == git ]] && [[ -n git ]]")).toEqual([]);
  });

  test("[positive] [[ ]]の内部のコマンド置換のgitを抽出する", () => {
    expect(parseGitCalls("[[ -n $(git status) ]]")).toEqual([
      { subcommand: "status", args: [] },
    ]);
  });

  test("[positive] [[ ]]の二項式・入れ子の条件式の内部のコマンド置換のgitを抽出する", () => {
    expect(parseGitCalls("[[ ! ( $(git log) == $(git diff) || -z x ) ]]")).toEqual([
      { subcommand: "log", args: [] },
      { subcommand: "diff", args: [] },
    ]);
  });

  test("[negative] gitにサブコマンドが無いとき、抽出しない", () => {
    expect(parseGitCalls("git --version")).toEqual([]);
  });
});

describe("classify", () => {
  test("[positive] git statusのとき、jj stへ誘導する", () => {
    const calls = parseGitCalls("git status");
    expect(calls).toHaveLength(1);
    expect(classify(calls[0])).toContain("jj st");
  });

  test("[positive] git clone URLのとき、jj git cloneへ誘導する", () => {
    const calls = parseGitCalls("git clone https://example.com/repo.git");
    expect(calls).toHaveLength(1);
    expect(classify(calls[0])).toContain("jj git clone");
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
