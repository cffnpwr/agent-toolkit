import { describe, expect, test } from "bun:test";

import { findChainViolations } from "./command.ts";

describe("findChainViolations", () => {
  describe("違反パターン", () => {
    test("[positive] &&で連結されたとき、違反とする", () => {
      expect(findChainViolations("a && b")).toHaveLength(1);
    });

    test("[positive] ||で連結されたとき、違反とする", () => {
      expect(findChainViolations("a || b")).toHaveLength(1);
    });

    test("[positive] ;で区切られたとき、違反とする", () => {
      expect(findChainViolations("a; b")).toHaveLength(1);
    });

    test("[positive] 改行で区切られたとき、;と同様に違反とする", () => {
      expect(findChainViolations("a\nb")).toHaveLength(1);
    });

    test.each([
      "a && b && c",
      "a; b; c",
    ])("[positive] 3個以上の連結(%s)も違反とする", (command) => {
      expect(findChainViolations(command)).toHaveLength(1);
    });

    test("[positive] [[ ]]同士を&&で連結したとき違反とする(テスト式内部のTestLogicalとは別物)", () => {
      expect(findChainViolations("[[ -f a ]] && [[ -f b ]]")).toHaveLength(1);
    });
  });

  describe("許可パターン(素通り)", () => {
    test("[negative] 単一コマンドは通過する", () => {
      expect(findChainViolations("git status")).toEqual([]);
    });

    test("[negative] pipe連結は通過する", () => {
      expect(findChainViolations("a | b | c")).toEqual([]);
    });

    test("[negative] バックグラウンド実行(&)単体は通過する", () => {
      expect(findChainViolations("sleep 1 &")).toEqual([]);
    });

    test.each([
      "a & b",
      "a & b & c",
    ])("[negative] &のみで繋がれた%sは、banされた3演算子に含まれないため通過する", (command) => {
      expect(findChainViolations(command)).toEqual([]);
    });

    test("[positive] &で繋がれた並びに;・改行が1箇所でもあれば、そこは違反として検知する", () => {
      expect(findChainViolations("a & b; c")).toHaveLength(1);
    });

    test("[negative] [[ ]]内部のTestLogical(&&・||)は通過する", () => {
      expect(findChainViolations("[[ -f a && -f b ]]")).toEqual([]);
    });
  });

  describe("cd例外", () => {
    test("[negative] cd <dir> && <単一コマンド>は通過する", () => {
      expect(findChainViolations("cd /tmp && npm run build")).toEqual([]);
    });

    test.each([
      "cd -L /tmp && cmd",
      "cd -P /tmp && cmd",
    ])("[negative] %s(cd -L/-Pフラグ付き)も通過する", (command) => {
      expect(findChainViolations(command)).toEqual([]);
    });

    test("[positive] cdの後にさらに&&が続くとき、例外にしない", () => {
      expect(findChainViolations("cd /tmp && a && b")).toHaveLength(1);
    });

    test("[positive] 演算子に||が混じるとき、例外にしない", () => {
      expect(findChainViolations("cd /tmp && a || b")).toHaveLength(1);
    });

    test("[positive] 先頭がcd以外のとき、例外にしない", () => {
      expect(findChainViolations("echo /tmp && cmd")).toHaveLength(1);
    });

    test("[positive] cdに引数が無いとき、例外にしない", () => {
      expect(findChainViolations("cd && cmd")).toHaveLength(1);
    });

    test("[positive] cdに複数のディレクトリ引数があるとき、例外にしない", () => {
      expect(findChainViolations("cd /a /b && cmd")).toHaveLength(1);
    });

    test("[positive] cdに未対応フラグがあるとき、例外にしない", () => {
      expect(findChainViolations("cd -v /tmp && cmd")).toHaveLength(1);
    });

    test("[positive] cd例外の残り側の内部に連結があるとき、そちらは検知する", () => {
      expect(findChainViolations("cd /tmp && { build; test; }")).toHaveLength(1);
    });
  });

  describe("command -v例外", () => {
    test("[negative] command -v x || <fallback>は通過する", () => {
      expect(findChainViolations("command -v bun || echo missing")).toEqual([]);
    });

    test("[negative] リダイレクト付き既存の定型句(command -v x >/dev/null 2>&1 || { ...; ...; })は通過する", () => {
      expect(findChainViolations(
        "command -v bun >/dev/null 2>&1 || { echo \"bun not found\" >&2; exit 1; }",
      )).toEqual([]);
    });

    test("[positive] 演算子に&&が混じるとき、例外にしない", () => {
      expect(findChainViolations("command -v bun || a && b")).toHaveLength(1);
    });

    test("[positive] -v以外のフラグのとき、例外にしない", () => {
      expect(findChainViolations("command -V bun || echo missing")).toHaveLength(1);
    });

    test("[positive] 対象が2個以上あるとき、例外にしない", () => {
      expect(findChainViolations("command -v bun node || echo missing")).toHaveLength(1);
    });

    test("[positive] 先頭がcommand -v以外のとき、例外にしない", () => {
      expect(findChainViolations("bun --version || echo missing")).toHaveLength(1);
    });
  });

  describe("全複合構文への再帰", () => {
    test("[positive] for本体の内部の連結を検知する", () => {
      expect(findChainViolations("for f in *; do a && b; done")).toHaveLength(1);
    });

    test.each([
      { placement: "if節", src: "if a && b; then c; fi" },
      { placement: "then節", src: "if a; then b && c; fi" },
      { placement: "else節", src: "if a; then b; else c && d; fi" },
    ])("[positive] $placementの内部の連結を検知する", ({ src }: { placement: string; src: string; }) => {
      expect(findChainViolations(src)).toHaveLength(1);
    });

    test.each([
      { placement: "while節", src: "while a && b; do c; done" },
      { placement: "本体", src: "while a; do b && c; done" },
    ])("[positive] while $placementの内部の連結を検知する", ({ src }: { placement: string; src: string; }) => {
      expect(findChainViolations(src)).toHaveLength(1);
    });

    test.each([
      { kind: "サブシェル", src: "(a && b)" },
      { kind: "ブレースグループ", src: "{ a && b; }" },
    ])("[positive] $kindの内部の連結を検知する", ({ src }: { kind: string; src: string; }) => {
      expect(findChainViolations(src)).toHaveLength(1);
    });

    test("[positive] 関数定義の内部の連結を検知する", () => {
      expect(findChainViolations("f() { a && b; }")).toHaveLength(1);
    });

    test("[positive] ブレースグループ内部で複数Statementが並ぶとき、連結として検知する", () => {
      expect(findChainViolations("{ a; b; }")).toHaveLength(1);
    });

    test("[positive] case各節の内部の連結を検知する", () => {
      expect(findChainViolations("case $x in a) f && g;; esac")).toHaveLength(1);
    });

    test("[positive] 複合構文の内部でも例外(command -v)は成立する", () => {
      expect(findChainViolations("for x in a b; do command -v \"$x\" || echo missing; done")).toEqual([]);
    });
  });

  describe("コマンド置換・プロセス置換の内部", () => {
    test("[positive] コマンド置換$(...)内部の連結を検知する", () => {
      expect(findChainViolations("echo \"$(a && b)\"")).toHaveLength(1);
    });

    test("[positive] バッククオート内部の連結を検知する", () => {
      expect(findChainViolations("echo `a && b`")).toHaveLength(1);
    });

    test("[positive] プロセス置換内部の連結を検知する", () => {
      expect(findChainViolations("diff <(a && b) file")).toHaveLength(1);
    });

    test("[negative] コマンド置換内部が単一コマンドなら通過する", () => {
      expect(findChainViolations("echo \"$(git status)\"")).toEqual([]);
    });
  });

  describe("バイパス", () => {
    test("[negative] 先頭のCOMMAND_CHAIN_GUARD_DISABLE=1前置で全体をバイパスする", () => {
      expect(findChainViolations("COMMAND_CHAIN_GUARD_DISABLE=1 a && b")).toEqual([]);
    });

    test("[negative] 木の中の任意の位置にあるバイパス前置でも全体をバイパスする", () => {
      expect(findChainViolations("a && COMMAND_CHAIN_GUARD_DISABLE=1 b")).toEqual([]);
    });

    test.each([
      "COMMAND_CHAIN_GUARD_DISABLE=0 a && b",
      "COMMAND_CHAIN_GUARD_DISABLE=false a && b",
      "COMMAND_CHAIN_GUARD_DISABLE= a && b",
    ])("[positive] バイパス前置が偽値(%s)のとき、バイパスしない", (command) => {
      expect(findChainViolations(command)).toHaveLength(1);
    });
  });
});
