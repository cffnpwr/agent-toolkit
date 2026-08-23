---
ID: 5
date: 2026-08-20
status: accepted
---

# 検証に参照ライブラリ`skills-ref`を使わない

Agent Skills仕様が検証用に挙げる参照ライブラリ[`skills-ref`](https://github.com/agentskills/agentskills/tree/main/skills-ref)を、`SKILL.md`の検証に使わない。

## Context

仕様は[Validation](https://agentskills.io/specification#validation)節で、`skills-ref`を検証用の参照ライブラリとして挙げている。
自前の検証器を実装する前に、これを使うかどうかを検討する必要がある。

## Choices

1. `skills-ref`を使う
2. 自前の検証器を実装する

### 1. `skills-ref`を使う

#### Pros

- 仕様が挙げる参照ライブラリであり、追加の実装が要らない

#### Cons

- 作者が本番利用を想定していない
- READMEは「demonstration purposes only」であり「not meant to be used in production」と明記する
- 仕様と乖離している
- `strictyaml`を使うためYAMLの部分集合しか読めず、`name`にUnicodeを許し、小文字の`skill.md`を受け付ける
- 仕様に適合するスキルを落とし、仕様に反するスキルを通す
- 問題を文字列のリストで返す
- 種別で扱えないため、呼び出し側の分岐とテストが文言への依存になる

### 2. 自前の検証器を実装する

#### Pros

- 本番利用を前提に実装でき、仕様の解釈を自分で明示できる
- 問題を種別付きの構造で返せる

#### Cons

- `skills-ref`と異なり、検証ロジックの実装と保守を自分で負う

## Decision

選択肢2を採る。

`skills-ref`は作者が本番利用を想定しておらず、仕様とも乖離しており、問題を文字列のリストでしか返さない。
自前の検証器を実装し、仕様解釈を明示し、種別付きの結果を返す。

## Consequences

- 仕様の解釈・YAMLパーサの選定・トークン数の近似などの判断を自分で引き受ける
- 仕様の改定に自分で追従する必要がある
