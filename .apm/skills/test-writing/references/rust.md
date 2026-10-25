# Rust

## テストの配置

- ユニットテストは対象コードと同じファイルの`#[cfg(test)] mod tests`に置き、`use super::*`でprivateな要素を取り込む
- integrationテストはクレート直下の`tests/`に置き、public APIのみを検証する
- privateな要素を検証する目的でpublicにしない

### 良い例

```rust
// src/foo.rs
fn parse(input: &str) -> Result<u32, ParseError> { /* ... */ }

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn positive_parses_digits_into_number() {
        let input = "42";

        let result = parse(input);

        assert_eq!(result, Ok(42));
    }
}
```

### 悪い例

```rust
// src/foo.rs
pub fn parse(input: &str) -> Result<u32, ParseError> { /* ... */ }

// tests/foo.rs
use mycrate::foo::parse;
```

## 命名

テスト関数名は`positive_`・`negative_`をprefixにし、検証内容をsnake_caseで書く。

### 良い例

```rust
#[test]
fn positive_parses_digits_into_number() {}

#[test]
fn negative_returns_empty_error_when_input_is_empty() {}
```

### 悪い例

```rust
#[test]
fn test_parse() {}
```

## 正常系の検証

- `assert_eq!`で結果全体を比較する
- 比較する型には`#[derive(PartialEq, Debug)]`を付ける
- エラー型が`PartialEq`・`Debug`を実装しない場合は、`result.ok()`を`Some(expected)`と比較する

### 良い例

```rust
let result = parse_config(text);
assert_eq!(result, Ok(Config { limit: 10, min_size: 0 }));
```

### 悪い例

```rust
let config = parse_config(text).unwrap();
assert_eq!(config.limit, 10);
assert_eq!(config.min_size, 0);
```

## 異常系の検証

- `matches!`でエラーのバリアントを検証する
- エラーメッセージは検証しない

### 良い例

```rust
let result = parse("");
assert!(matches!(result, Err(ParseError::Empty)));
```

### 悪い例

```rust
let result = parse("");
assert_eq!(result.unwrap_err().to_string(), "input is empty");
```

## パラメタライズ

- 同じ検証を入力だけ変えて実行する場合は、`rstest`の`#[case]`を使う
- ケース名は`#[case::<name>(...)]`で付け、`positive_`・`negative_`をprefixにする
- 共通の準備は`#[fixture]`関数に分離する
- 検証や準備が異なるケースは、別の`#[test]`関数にする

### 良い例

```rust
use rstest::rstest;

#[rstest]
#[case::positive_zero(0, 0)]
#[case::positive_one(1, 1)]
#[case::positive_small(10, 55)]
fn fibonacci_returns_expected(#[case] input: u32, #[case] expected: u32) {
    assert_eq!(fibonacci(input), expected);
}
```

### 悪い例

```rust
#[test]
fn positive_fibonacci_returns_expected() {
    for (input, expected) in [(0, 0), (1, 1), (10, 55)] {
        assert_eq!(fibonacci(input), expected);
    }
}
```

## 非同期テスト

- `async fn`のテストには、プロジェクトの非同期ランタイムのテスト属性（tokioなら`#[tokio::test]`）を使う
- `rstest`と併用する場合は、`#[rstest]`と非同期ランタイムのテスト属性の両方を付ける

### 良い例

```rust
#[tokio::test]
async fn positive_fetches_and_parses() {
    let result = fetch_and_parse("id").await;
    assert_eq!(result, Ok(Article { id: 1 }));
}
```

### 悪い例

```rust
#[test]
async fn positive_fetches_and_parses() {
    let result = fetch_and_parse("id").await;
    assert_eq!(result, Ok(Article { id: 1 }));
}
```

## テストダブル

プログラム外部へのアクセスはtraitで表し、テストダブルは`mockall`で生成する。

### 良い例

```rust
use mockall::automock;

#[automock]
trait Clock {
    fn now(&self) -> u64;
}

#[test]
fn negative_rejects_expired_token() {
    let mut clock = MockClock::new();
    clock.expect_now().return_const(2_000u64);
    // clockを対象へ注入して検証する
}
```

### 悪い例

```rust
fn is_expired(token: &Token) -> bool {
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
    token.expires_at < now
}
```

## カバレッジ

- カバレッジは`cargo-llvm-cov`で計測する
  - nightlyのRustを使用している場合は`--branch`をつけてC1カバレッジを計測する
  - stableでは手動でC1カバレッジを担保する

### 良い例

```sh
cargo +nightly llvm-cov --branch
```

### 悪い例

```sh
cargo llvm-cov
```
