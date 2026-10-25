# TypeScript

## 値の集合と分岐の網羅

- 取りうる値はユニオン型で閉じ、分岐はexhaustive検査ができるパターンマッチライブラリ（ts-pattern等）を使用する
- ライブラリを使えない場合は`switch`を使用する
- `if`の連鎖で分岐しない

### 良い例

```ts
type Format = "text" | "markdown" | "json";

const output = match(format)
  .with("text", () => renderText(rows))
  .with("markdown", () => renderMarkdown(rows))
  .with("json", () => JSON.stringify(rows))
  .exhaustive();
```

### 悪い例

```ts
let output: string;
if (format === "json") {
  output = JSON.stringify(rows);
} else if (format === "markdown") {
  output = renderMarkdown(rows);
} else if (format === "text") {
  output = renderText(rows);
} else {
  process.exit(1);
}
```

## 三項演算子

三項演算子をネストしない。

### 良い例

```ts
const label = match(size)
  .with(0, () => "empty")
  .when((s) => s < 1024, () => "small")
  .otherwise(() => "large");
```

### 悪い例

```ts
const label = size === 0 ? "empty" : size < 1024 ? "small" : "large";
```

## 外部入力の検証

- 外部入力はスキーマ検証ライブラリ（zod・arktype等）で検証する
- `typeof`と比較で手書き検証しない

### 良い例

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

### 悪い例

```ts
const raw = JSON.parse(text);
if (typeof raw.limit !== "number" || raw.limit < 1) {
  errors.push("limit");
}
```

## 複数の値の受け渡し

- 意味が位置から読めないタプルで渡さず、オブジェクトのキーで意味を示す
- Reactの`useState`等の慣習として用いられるものは例外とする

### 良い例

```ts
const rows = [{ name: "src", count: 12, size: 34567 }];
```

### 悪い例

```ts
const rows: [string, number, number][] = [["src", 12, 34567]];
```

## エラー型

- `Error`を継承するときは`override readonly name = "X" as const`とし、メッセージの既定値はコンストラクターで与える
- 下位のエラーを包むときは、元のエラーを`cause`に渡す
- 下位のエラーをそのまま投げ直したり、文字列に変換して包んだりしない

### 良い例

```ts
export class UnwrapError extends Error {
  override readonly name = "UnwrapError" as const;

  constructor(msg?: string) {
    super(msg ?? "Unwrap failed.");
  }
}
```

```ts
export class ConfigReadError extends Error {
  override readonly name = "ConfigReadError" as const;

  constructor(path: string, options?: ErrorOptions) {
    super(`Failed to read config file \`${path}\`.`, options);
  }
}

try {
  text = await readFile(path, "utf8");
} catch (error) {
  throw new ConfigReadError(path, { cause: error });
}
```

### 悪い例

```ts
export class UnwrapError extends Error {}
```

```ts
try {
  text = await readFile(path, "utf8");
} catch (error) {
  throw new Error(`Failed to read config file: ${String(error)}`);
}
```
