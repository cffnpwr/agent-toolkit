# TypeScript の書き方

本文の原則・表現をTypeScriptで適用するときの具体形。

## 値の集合と分岐の網羅

取りうる値はユニオン型で閉じ、分岐はexhaustive検査ができるパターンマッチライブラリ（ts-pattern等）に任せる。
ライブラリを使えない場合の次善は`switch`とする（exhaustive検査ができないため好まない）。

```ts
type Format = "text" | "markdown" | "json";

const output = match(format)
  .with("text", () => renderText(rows))
  .with("markdown", () => renderMarkdown(rows))
  .with("json", () => JSON.stringify(rows))
  .exhaustive();
```

`string`のままにして`if`の連鎖で分岐しない。

```ts
const format: string = "text";

if (format === "json") {
  output = JSON.stringify(rows);
} else if (format === "markdown") {
  output = renderMarkdown(rows);
} else {
  output = renderText(rows);
}
```

三項演算子をネストしない。

## 外部入力の検証

外部入力はスキーマ検証ライブラリ（zod・arktype等）で検証し、境界の内側では検証済みの値を素のまま使う。

```ts
const Config = z.object({
  limit: z.number().int().min(1),
  minSize: z.number().int().min(0),
});

const result = Config.safeParse(JSON.parse(text));
if (!result.success) {
  exit(result.error.issues);
}
```

`typeof`と比較で手書き検証しない。

```ts
const raw = JSON.parse(text);
if (typeof raw.limit !== "number" || raw.limit < 1) {
  errors.push("limit");
}
```

## 複数の値の受け渡し

意味が位置から読めないタプルで渡さず、オブジェクトのキーで意味を示す。

```ts
const rows = [{ name: "src", count: 12, size: 34567 }];
```

```ts
const rows: [string, number, number][] = [["src", 12, 34567]];
```

## 型の置き場

型を使う主体が1つのファイルにあるなら、そのファイルに定義する。

```ts
// main.ts（Format を使うのはこのファイルだけ）
type Format = "text" | "markdown" | "json";
```

1つのファイル内でしか使わない型のために型定義ファイルを作らない。

```ts
// types.ts
export type Format = "text" | "markdown" | "json";
```

## エラー型

`Error`を継承するときは`override readonly name = "X" as const`とし、メッセージの既定値はコンストラクターで与える。

```ts
export class UnwrapError extends Error {
  override readonly name = "UnwrapError" as const;

  constructor(msg?: string) {
    super(msg ?? "Unwrap failed.");
  }
}
```

```ts
export class UnwrapError extends Error {}
```
