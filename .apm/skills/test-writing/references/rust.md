# Rust のテスト

言語非依存の方針（[SKILL.md](../SKILL.md)）を前提に、Rust 固有の手順を示す。

## ランナーと実行

標準の `cargo test` を使う。

```sh
cargo test                 # 全テスト
cargo test <name>          # 名前に <name> を含むテストのみ
cargo test -- --nocapture  # println! 等の標準出力を表示
```

## 配置

- **unit テスト**: 対象コードと同じファイルの末尾に `#[cfg(test)] mod tests` を置く。`tests` は子モジュールで、子モジュールは祖先モジュールの private 要素に到達できるため（`use super::*` で取り込む）、ロジックを持つ private もテストできる。
- **integration テスト**: クレート直下の `tests/` に置く。クレートを外部から使う視点で public API のみを検証する。

```rust
// src/foo.rs
fn parse(input: &str) -> Result<u32, ParseError> { /* ... */ }

#[cfg(test)]
mod tests {
    use super::*;

    // Given-When-Then
    #[test]
    fn positive_parses_digits_into_number() {
        let input = "42";                 // Given
        let result = parse(input);        // When
        assert_eq!(result, Ok(42));       // Then
    }

    #[test]
    fn negative_returns_empty_error_when_input_is_empty() {
        let result = parse("");
        // 型（バリアント）まで検証する。メッセージは見ない
        assert!(matches!(result, Err(ParseError::Empty)));
    }
}
```

命名は `positive_` / `negative_` を prefix に付け、以降は検証内容がわかる snake_case にする。

- **正常系は期待値全体との完全一致で検証する。** `assert_eq!(result, Ok(expected))` で結果全体を突き合わせる（構造体は `#[derive(PartialEq, Debug)]` が要る。`Result` を直接比較する場合は `E` にも `PartialEq` + `Debug` が要る）。フィールドごとに `assert_eq!` を並べない。
  - `E` が `PartialEq` / `Debug` を持たない場合は `assert_eq!(result.ok(), Some(expected))` とする。`.ok()` で `Result<T, E>` を `Option<T>` に落とし、`Ok` であることと内容一致を一度に検査でき、制約が `T` だけに下がる。ただし失敗時の出力は `None` となりエラー内容は見えない。
- **異常系はエラーのバリアントまで検証する。** `matches!(result, Err(ParseError::Empty))` でバリアントを検査する。メッセージ文言は検証しない。パニックを検証する場合は `#[should_panic(expected = "...")]`。
- `?` を使いたい場合は `Result<(), E>` 返却のテストにする。

## ケース展開（二層）

### 基本: 素の `#[test]` 関数を複数

ロジックやセットアップが異なるケースは、ケースごとに独立した `#[test]` 関数で書く。

### 同一ロジックを複数入力で回す場合: `rstest` の `#[case]`

同じ検証ロジックを入力だけ変えて回すケースは、`rstest` でパラメタライズする。各 `#[case]` は独立したテストとして生成・命名・実行される。

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

`#[case::<name>(...)]` でケース名を付け、正常系・異常系を `positive_` / `negative_` で区別する。共通の準備は `#[fixture]` 関数に切り出して引数で受け取る。

`Cargo.toml`（版は執筆時点の最新。実際には最新版を確認して指定する）:

```toml
[dev-dependencies]
rstest = "0.26"
```

## 非同期テスト

`async fn` のテストは素の `#[test]` では実行できない（コンパイルが通らない）。非同期ランタイムに応じたテスト属性を使う。tokio なら `#[tokio::test]`。

```rust
#[tokio::test]
async fn positive_fetches_and_parses() {
    let result = fetch_and_parse("id").await;
    assert!(result.is_ok());
}
```

`rstest` でパラメタライズする場合も、`#[rstest]` と非同期ランタイム属性を併用し、テスト関数を `async fn` にする。使う属性は対象プロジェクトのランタイムに合わせる。

## 境界モック

外部境界は trait で表し、テストでダブルに差し替える。生成には `mockall` を使う。

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
    // clock を対象へ注入して検証する
}
```

`Cargo.toml`（版は執筆時点の最新。実際には最新版を確認して指定する）:

```toml
[dev-dependencies]
mockall = "0.15"
```

内部モジュール同士はモックせず実物で繋ぐ。境界を差し替えられない場合は、依存を trait 境界へ寄せる設計を検討する。

## カバレッジ

`cargo-llvm-cov` を使う。

```sh
cargo llvm-cov                      # 要約を表示
cargo llvm-cov --html               # HTML レポート
cargo llvm-cov --lcov --output-path lcov.info  # CI 向け lcov
```

stable では **region coverage**（行より細かく条件領域を追う）が既定。真の分岐カバレッジ（C1）は nightly Rust で `--branch` を付けると得られるが、この機能は unstable。

```sh
cargo +nightly llvm-cov --branch    # C1（unstable, nightly 限定）
```

stable で C1 を担保する場合は、SKILL.md の方針どおり各分岐の真・偽双方を通すケースを人手で用意する。
