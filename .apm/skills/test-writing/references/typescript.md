# TypeScript のテスト

言語非依存の方針（[SKILL.md](../SKILL.md)）を前提に、TypeScript 固有の手順を示す。

## ランナー

対象プロジェクトが bun を使う（`bun.lock`／`bun.lockb`／`bunfig.toml` がある。`bun.lock` は 1.2 以降のテキスト、`bun.lockb` は 1.2 未満のバイナリ既定）なら `bun test`、それ以外は `vitest` を使う。両者とも `describe` / `it` / `expect`・`test.each`・組み込みモックを備え、API はおおむね共通。

```sh
# bun
bun test
bun test <path>

# vitest
npx vitest run              # 単発実行
npx vitest                  # watch
npx vitest run <path>
```

## 配置

テスト対象ファイルの隣にコロケートする（`foo.ts` に対し `foo.test.ts`）。vitest / bun どちらのデフォルト検出にも乗る。

TypeScript は export されていない関数を import できないため、「ロジックを持つ private をテストする」場合は、まず public 経路経由で分岐を通せないか試す。難しければその要素を export するが、テストのための re-export をモジュール境界の外へ漏らさない（public API を汚さない）。

## スタイル（BDD）

テスト対象ごとに `describe` を分け、`it` でケースを書く。Given-When-Then で本体を組む。

```ts
import { describe, it, expect } from "vitest"; // bun の場合は "bun:test"
import { parse } from "./parser";

describe("parse", () => {
  it("[positive] 数字のみのとき数値へ変換する", () => {
    const input = "42";              // Given
    const result = parse(input);     // When
    expect(result).toBe(42);         // Then
  });

  it("[negative] 空文字のとき ParseError を投げる", () => {
    // 型（クラス）まで検証する。メッセージは見ない
    expect(() => parse("")).toThrow(ParseError);
  });
});
```

`it` の名前は `[positive] ` / `[negative] ` を prefix に付け、「A が B のとき C」の形で入力条件と期待結果を書く。

- **正常系は期待値全体との完全一致で検証する。** オブジェクトは `expect(result).toEqual(expected)` で全体を突き合わせる（プリミティブは `toBe`）。フィールドごとに `expect` を並べない。
- **異常系はエラーの型・種別まで検証する。** スロー検証は `expect(fn).toThrow(ErrorClass)`（クラスを渡すと instanceof 判定）、値を直接持つ場合は `expect(err).toBeInstanceOf(ErrorClass)`。**メッセージ文字列は渡さない**（`toThrow("...")` はメッセージ照合になり脆い）。

### パラメタライズ

同一ロジックを複数入力で回すケースは `test.each` / `it.each`（両ランナー組み込み）を使う。

```ts
it.each([
  { in: "42", want: 42 },
  { in: "0", want: 0 },
])("[positive] $in のとき $want へ変換する", ({ in: input, want }) => {
  expect(parse(input)).toBe(want);
});
```

## 境界モック

- **モジュール / 関数境界はランナー組み込みで差し替える。** 関数は vitest の `vi.fn` / `vi.spyOn`、bun の `mock` / `spyOn`。モジュール全体は vitest の `vi.mock("./module", factory)`、bun の `mock.module("./module", factory)`。
- **HTTP / ネットワーク境界は `MSW`（Mock Service Worker）を使う。** リクエストをネットワーク層で捕捉し、実装のコードを変えずに応答を差し替える。
- **時刻・タイマー境界はフェイクタイマーを使う。** vitest は `vi.useFakeTimers()` / `vi.setSystemTime(date)`、bun は `setSystemTime(date)`（`bun:test`）。

```ts
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

const server = setupServer(
  http.get("https://api.example.com/user", () =>
    HttpResponse.json({ id: 1 }),
  ),
);
// beforeAll(() => server.listen()) / afterAll(() => server.close())
```

内部モジュール同士はモックせず実物で繋ぐ。

## カバレッジ

### vitest（C1 計測可）

`--coverage` で分岐カバレッジを含めて計測できる。プロバイダは `v8`（既定）と `istanbul` があり、どちらも branch を報告する。

```sh
npx vitest run --coverage
```

`vitest.config.ts` で threshold を設定する。C1 は `branches` で見る。SKILL.md の方針どおりテストしないコード（単純コード・IO 境界など）が存在するため、`lines` / `statements` / `functions` の目標を一律 100% にはせず、`exclude` で対象外を除いたうえで妥当な値にする。

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["**/*.config.ts"], // テスト対象外を除く
      thresholds: { branches: 100 },
    },
  },
});
```

### bun test（C1 計測不可）

`bun test --coverage` は functions / lines のみ報告し、**分岐カバレッジには対応していない**（[oven-sh/bun#7100](https://github.com/oven-sh/bun/issues/7100)、未解決）。SKILL.md の方針どおり、各分岐の真・偽双方を通すケースを人手で用意して C1 を担保する。

```sh
bun test --coverage
```
