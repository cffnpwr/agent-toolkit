---
ID: 6
date: 2026-08-20
status: accepted
---

# トークン数の概算に`gpt-tokenizer`を使う

`SKILL.md`本文のトークン数を、[`gpt-tokenizer`](https://github.com/niieani/gpt-tokenizer)の`o200k_base`エンコーディングで概算する。

## Context

仕様は`SKILL.md`本文を5000トークン以内に収めることを推奨するが、トークナイザを指定していない（ベンダ中立）。
Claudeのトークン数を正確に数える手段はAPIの`count_tokens`エンドポイントである（[Token counting](https://platform.claude.com/docs/en/build-with-claude/token-counting)）。
検証器はトークン数の計測手段を選ぶ必要がある。

## Choices

1. `gpt-tokenizer`（`o200k_base`）
2. APIの`count_tokens`エンドポイント

### 1. `gpt-tokenizer`（`o200k_base`）

#### Pros

- 更新が続いており、日本語の扱いも新しい
- Agent Skills仕様がベンダ中立であることと整合する

#### Cons

- Claude自身のトークナイザではないため、近似にとどまる

### 2. APIの`count_tokens`エンドポイント

#### Pros

- 近似ではなく、正確に計数できる

#### Cons

- 検査のたびにAPIを呼ぶため、ネットワーク・認証情報・費用がCIの前提になる
- 静的検証がオフラインで完結しなくなる

## Decision

選択肢1を採る。

Agent Skills仕様はベンダ中立であり、トークナイザを特定していない。
`count_tokens`エンドポイントは正確だが、検査のたびにAPI呼び出しを要求し、静的検証をオフラインで完結させる方針に反する。
`gpt-tokenizer`は更新が続いており、日本語の扱いも新しく、オフラインで完結する。

## Consequences

- トークン数の検査は近似であり、Claudeのトークナイザとは異なるため数値は目安として扱う
