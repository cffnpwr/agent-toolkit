# Rust の書き方

本文の原則・表現をRustで適用するときの具体形。

## 値の集合と分岐の網羅

取りうる値は`enum`で閉じ、分岐は`match`の網羅検査に任せる。

```rust
enum Format {
    Text,
    Markdown,
    Json,
}

let output = match format {
    Format::Text => render_text(&rows),
    Format::Markdown => render_markdown(&rows),
    Format::Json => serde_json::to_string(&rows)?,
};
```

文字列と`if`の連鎖で分岐しない。

```rust
let format = "text";
let output = if format == "json" {
    serde_json::to_string(&rows)?
} else if format == "markdown" {
    render_markdown(&rows)
} else {
    render_text(&rows)
};
```

## 外部入力の検証

外部入力は型付きの構造体へデシリアライズし、型と値域を型に検査させる。

```rust
#[derive(Deserialize)]
struct Config {
    limit: NonZeroUsize,
    min_size: u64,
}

let config: Config = serde_json::from_str(&text)?;
```

動的な値へ読み込んでから手書きで検査しない。

```rust
let raw: serde_json::Value = serde_json::from_str(&text)?;
let limit = raw["limit"]
    .as_u64()
    .filter(|n| *n >= 1)
    .ok_or("limit")?;
```

## 複数の値の受け渡し

意味が位置から読めないタプルで渡さず、フィールド名で意味を示す。

```rust
struct Row {
    name: String,
    count: usize,
    size: u64,
}

let rows = vec![Row {
    name: "src".into(),
    count: 12,
    size: 34567,
}];
```

```rust
let rows = vec![("src".to_string(), 12, 34567)];
```

## 引数の受け取り

引数は、呼び出し側が持ちうる型を広く受けるトレイト境界で受け取り、内部で所有型へ変換する。

```rust
pub fn new(name: impl Into<String>, path: impl AsRef<Path>) -> Self
```

```rust
pub fn new(name: String, path: PathBuf) -> Self
```

## エラー型

ライブラリのエラー型はthiserrorで定義し、実行可能プログラムのトップレベルはanyhowで扱う。

```rust
#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("state `{0}` is not defined")]
    UndefinedState(String),
}
```

```rust
fn main() -> anyhow::Result<()> {
    let config = Config::read_from_file(path)?;
    Ok(())
}
```

エラーを文字列で返さない。

```rust
pub fn read(path: &str) -> Result<Config, String>
```

## ビルダー

ビルダーは消費型にし、メソッドチェーンで組み立てる。

```rust
let machine = TuringMachineBuilder::new()
    .blank("_")
    .initial("q0")
    .build()?;
```

可変参照で設定を積む形にしない。

```rust
let mut builder = TuringMachineBuilder::new();
builder.set_blank("_");
builder.set_initial("q0");
let machine = builder.build()?;
```
