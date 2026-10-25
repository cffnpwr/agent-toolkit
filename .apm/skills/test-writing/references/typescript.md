# TypeScript

## テストランナー

bunを使うプロジェクトでは`bun test`を使い、それ以外では`vitest`を使う。

### 良い例

```sh
# bunを使用する場合
bun test
```

### 悪い例

```sh
# bunを使用する場合
npx vitest run
```

## テストの配置

- テストファイルはテスト対象ファイルの隣に置く
- privateな関数はpublicな経路でテストする
- publicな経路で分岐を通せない場合は関数をexportする
- exportした関数はモジュール外へre-exportしない

### 良い例

```text
src
├── parser.test.ts
└── parser.ts
```

### 悪い例

```text
.
├── src
│   └── parser.ts
└── test
    └── parser.test.ts
```

## 構造

テスト対象ごとに`describe`を分け、ケースごとに`it`を書く。

### 良い例

```ts
import { describe, it, expect } from "vitest";
import { parse } from "./parser";

describe("parse", () => {
  it("[positive] 数字のみのとき数値へ変換する", () => {
    const input = "42";

    const result = parse(input);

    expect(result).toBe(42);
  });

  it("[negative] 空文字のときParseErrorを投げる", () => {
    expect(() => parse("")).toThrow(ParseError);
  });
});
```

### 悪い例

```ts
describe("parser", () => {
  it("works", () => {
    expect(parse("42")).toBe(42);
    expect(() => parse("")).toThrow(ParseError);
    expect(format(42)).toBe("42");
  });
});
```

## 正常系の検証

オブジェクトは`toEqual`で全体を比較し、プリミティブは`toBe`で比較する。

### 良い例

```ts
expect(parseConfig(text)).toEqual({ limit: 10, minSize: 0 });
```

### 悪い例

```ts
const config = parseConfig(text);
expect(config.limit).toBe(10);
expect(config.minSize).toBe(0);
```

## 異常系の検証

- `toThrow`・`toBeInstanceOf`にはエラーのクラスを渡す
- `toThrow`にメッセージの文字列を渡さない

### 良い例

```ts
expect(() => parse("")).toThrow(ParseError);
```

### 悪い例

```ts
expect(() => parse("")).toThrow("input is empty");
```

## パラメタライズ

同じ検証を入力だけ変えて実行する場合は、`it.each`を使う。

### 良い例

```ts
it.each([
  { in: "42", want: 42 },
  { in: "0", want: 0 },
])("[positive] 入力「$in」のとき「$want」へ変換する", ({ in: input, want }) => {
  expect(parse(input)).toBe(want);
});
```

### 悪い例

```ts
it("[positive] 数字のみのとき数値へ変換する", () => {
  for (const [input, want] of [["42", 42], ["0", 0]] as const) {
    expect(parse(input)).toBe(want);
  }
});
```

## テストダブル

- 関数・モジュールはランナー組み込みのモック（vitestの`vi.fn`・`vi.spyOn`・`vi.mock`、bunの`mock`・`spyOn`・`mock.module`）で差し替える
- HTTPはMSW（Mock Service Worker）でネットワーク層の応答を差し替える
- 時刻はランナー組み込みのフェイクタイマー（vitestの`vi.useFakeTimers`・`vi.setSystemTime`、bunの`setSystemTime`）で差し替える

### 良い例

```ts
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

const server = setupServer(
  http.get("https://api.example.com/user", () => HttpResponse.json({ id: 1 })),
);
```

### 悪い例

```ts
vi.spyOn(globalThis, "fetch").mockResolvedValue(
  new Response(JSON.stringify({ id: 1 })),
);
```

## カバレッジ

- vitestではC1カバレッジを`branches`のthresholdで検査する
- `lines`・`statements`・`functions`を一律100%にせず、テストしないコードを`exclude`で除外する
- `bun test`はC1カバレッジを計測できないため、手動で担保する

### 良い例

```ts
export default defineConfig({
  test: {
    coverage: {
      exclude: ["**/*.config.ts"],
      thresholds: { branches: 100 },
    },
  },
});
```

### 悪い例

```ts
export default defineConfig({
  test: {
    coverage: {
      thresholds: { lines: 100, statements: 100, functions: 100, branches: 100 },
    },
  },
});
```
