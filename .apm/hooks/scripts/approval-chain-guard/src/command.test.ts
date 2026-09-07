import { describe, expect, test } from "bun:test";

import { analyzeChain } from "./command.ts";

describe("analyzeChain", () => {
  describe("違反パターン", () => {
    test("[positive] &&で連結されたとき、違反とする", () => {
      expect(analyzeChain("a && b").violations).toHaveLength(1);
    });

    test("[positive] ||で連結されたとき、違反とする", () => {
      expect(analyzeChain("a || b").violations).toHaveLength(1);
    });

    test("[positive] ;で区切られたとき、違反とする", () => {
      expect(analyzeChain("a; b").violations).toHaveLength(1);
    });

    test("[positive] 改行で区切られたとき、;と同様に違反とする", () => {
      expect(analyzeChain("a\nb").violations).toHaveLength(1);
    });

    test.each([
      "a && b && c",
      "a; b; c",
    ])("[positive] 3個以上の連結(%s)も違反とする", (command) => {
      expect(analyzeChain(command).violations).toHaveLength(1);
    });

    test("[positive] command -v x || <fallback>も、通常の||連結として違反とする", () => {
      expect(analyzeChain("command -v bun || echo missing").violations).toHaveLength(1);
    });

    test("[positive] [[ ]]同士を&&で連結したとき違反とする(テスト式内部のTestLogicalとは別物)", () => {
      expect(analyzeChain("[[ -f a ]] && [[ -f b ]]").violations).toHaveLength(1);
    });
  });

  describe("許可パターン(素通り)", () => {
    test("[negative] 単一コマンドは通過する", () => {
      expect(analyzeChain("git status").violations).toEqual([]);
    });

    test("[negative] pipe連結は通過する", () => {
      expect(analyzeChain("a | b | c").violations).toEqual([]);
    });

    test("[negative] バックグラウンド実行(&)単体は通過する", () => {
      expect(analyzeChain("sleep 1 &").violations).toEqual([]);
    });

    test.each([
      "a & b",
      "a & b & c",
    ])("[negative] &のみで繋がれた%sは、banされた3演算子に含まれないため通過する", (command) => {
      expect(analyzeChain(command).violations).toEqual([]);
    });

    test("[positive] &で繋がれた並びに;・改行が1箇所でもあれば、そこは違反として検知する", () => {
      expect(analyzeChain("a & b; c").violations).toHaveLength(1);
    });

    test("[negative] [[ ]]内部のTestLogical(&&・||)は通過する", () => {
      expect(analyzeChain("[[ -f a && -f b ]]").violations).toEqual([]);
    });
  });

  describe("cd例外", () => {
    test("[negative] cd <dir> && <単一コマンド>は通過する", () => {
      expect(analyzeChain("cd /tmp && npm run build").violations).toEqual([]);
    });

    test.each([
      "cd -L /tmp && cmd",
      "cd -P /tmp && cmd",
    ])("[negative] %s(cd -L/-Pフラグ付き)も通過する", (command) => {
      expect(analyzeChain(command).violations).toEqual([]);
    });

    test("[positive] cdの後にさらに&&が続くとき、例外にしない", () => {
      expect(analyzeChain("cd /tmp && a && b").violations).toHaveLength(1);
    });

    test("[positive] 演算子に||が混じるとき、例外にしない", () => {
      expect(analyzeChain("cd /tmp && a || b").violations).toHaveLength(1);
    });

    test("[positive] 先頭がcd以外のとき、例外にしない", () => {
      expect(analyzeChain("echo /tmp && cmd").violations).toHaveLength(1);
    });

    test("[positive] cdに引数が無いとき、例外にしない", () => {
      expect(analyzeChain("cd && cmd").violations).toHaveLength(1);
    });

    test("[positive] cdに複数のディレクトリ引数があるとき、例外にしない", () => {
      expect(analyzeChain("cd /a /b && cmd").violations).toHaveLength(1);
    });

    test("[positive] cdに未対応フラグがあるとき、例外にしない", () => {
      expect(analyzeChain("cd -v /tmp && cmd").violations).toHaveLength(1);
    });

    test("[positive] cd例外の残り側の内部に連結があるとき、そちらは検知する", () => {
      expect(analyzeChain("cd /tmp && { build; test; }").violations).toHaveLength(1);
    });

    test("[negative] 複合構文の内部でもcd例外は成立する", () => {
      expect(analyzeChain("for x in a b; do cd \"$x\" && build; done").violations).toEqual([]);
    });
  });

  describe("全複合構文への再帰", () => {
    test("[positive] for本体の内部の連結を検知する", () => {
      expect(analyzeChain("for f in *; do a && b; done").violations).toHaveLength(1);
    });

    test.each([
      { placement: "if節", src: "if a && b; then c; fi" },
      { placement: "then節", src: "if a; then b && c; fi" },
      { placement: "else節", src: "if a; then b; else c && d; fi" },
    ])("[positive] $placementの内部の連結を検知する", ({ src }: { placement: string; src: string; }) => {
      expect(analyzeChain(src).violations).toHaveLength(1);
    });

    test.each([
      { placement: "while節", src: "while a && b; do c; done" },
      { placement: "本体", src: "while a; do b && c; done" },
    ])("[positive] while $placementの内部の連結を検知する", ({ src }: { placement: string; src: string; }) => {
      expect(analyzeChain(src).violations).toHaveLength(1);
    });

    test.each([
      { kind: "サブシェル", src: "(a && b)" },
      { kind: "ブレースグループ", src: "{ a && b; }" },
    ])("[positive] $kindの内部の連結を検知する", ({ src }: { kind: string; src: string; }) => {
      expect(analyzeChain(src).violations).toHaveLength(1);
    });

    test("[positive] 関数定義の内部の連結を検知する", () => {
      expect(analyzeChain("f() { a && b; }").violations).toHaveLength(1);
    });

    test("[positive] ブレースグループ内部で複数Statementが並ぶとき、連結として検知する", () => {
      expect(analyzeChain("{ a; b; }").violations).toHaveLength(1);
    });

    test("[positive] case各節の内部の連結を検知する", () => {
      expect(analyzeChain("case $x in a) f && g;; esac").violations).toHaveLength(1);
    });
  });

  describe("コマンド置換・プロセス置換の内部", () => {
    test("[positive] コマンド置換$(...)内部の連結を検知する", () => {
      expect(analyzeChain("echo \"$(a && b)\"").violations).toHaveLength(1);
    });

    test("[positive] バッククオート内部の連結を検知する", () => {
      expect(analyzeChain("echo `a && b`").violations).toHaveLength(1);
    });

    test("[positive] プロセス置換内部の連結を検知する", () => {
      expect(analyzeChain("diff <(a && b) file").violations).toHaveLength(1);
    });

    test("[negative] コマンド置換内部が単一コマンドなら通過する", () => {
      expect(analyzeChain("echo \"$(git status)\"").violations).toEqual([]);
    });
  });

  describe("分割案", () => {
    test("[positive] トップレベルの&&連結のとき、セグメントごとに分ける", () => {
      expect(analyzeChain("git fetch && git push origin main").split)
        .toEqual(["git fetch", "git push origin main"]);
    });

    test("[positive] ;区切りのとき、Statementごとに分ける", () => {
      expect(analyzeChain("a; b; c").split).toEqual(["a", "b", "c"]);
    });

    test("[positive] pipelineのセグメントは1項にまとめる", () => {
      expect(analyzeChain("a | b && c").split).toEqual(["a | b", "c"]);
    });

    test("[positive] cd <dir> &&で始まる&&連鎖のとき、各項にcd <dir>を再前置する", () => {
      expect(analyzeChain("cd /tmp && a && b").split).toEqual(["cd /tmp && a", "cd /tmp && b"]);
    });

    test("[positive] cdを;で区切るとき、再前置せずcd単独の項にする", () => {
      expect(analyzeChain("cd /tmp; a; b").split).toEqual(["cd /tmp", "a", "b"]);
    });

    test("[positive] cdで始まっても演算子に||が混じるとき、再前置しない", () => {
      expect(analyzeChain("cd /tmp && a || b").split).toEqual(["cd /tmp", "a", "b"]);
    });

    test.each([
      { junction: "&&連結", src: "a && (b)" },
      { junction: ";区切り", src: "(a); b" },
    ])("[negative] $junctionのセグメントが複合構文のとき、分けられない", ({ src }: { junction: string; src: string; }) => {
      expect(analyzeChain(src).split).toBeUndefined();
    });

    test("[negative] より深い階層にも連結があるとき、分けられない", () => {
      expect(analyzeChain("a && echo \"$(b; c)\"").split).toBeUndefined();
    });

    test.each([
      { shape: "cd例外", src: "cd /tmp && echo \"$(a; b)\"" },
      { shape: "&だけで繋がれた並び", src: "x & echo \"$(a; b)\"" },
      { shape: "複合構文", src: "for f in *; do a && b; done" },
    ])("[negative] トップレベルが$shapeで、その内部だけが違反のとき、分けられない", ({ src }: { shape: string; src: string; }) => {
      expect(analyzeChain(src).split).toBeUndefined();
    });
  });
});
