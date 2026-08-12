# スキルの静的検証

`SKILL.md`を[Agent Skills仕様](https://agentskills.io/specification)とリポジトリ規約に対して検証する仕組みを定める。
検証は配布対象ではなく、リポジトリの開発ツールとして扱う。

## 検査の分類

検査ルールは、出自と規範の強さという独立した2つの軸を持つ。
出自は、[Agent Skills仕様](https://agentskills.io/specification)が定める条件か、本リポジトリのdesign docが定める追加規約かを表す。
規範の強さは、必須と推奨の2段階とする。

必須の違反はerror、推奨の違反はwarningとして表示する。
出自は表示に関与しない。

推奨の違反をerrorとして扱うと、仕様に適合するスキルを取り込めなくなる。

### 仕様外フィールド

仕様が列挙するフィールドは、`name`・`description`・`license`・`compatibility`・`metadata`・`allowed-tools`の6つである。
これ以外のフィールドの存在も、独立した検査項目として検査する。
仕様は列挙外のフィールドを禁じていないため、推奨とする。

仕様外フィールドの扱いは実装ごとに異なる。
拒否することが確認できているのは次の3経路に限られる（[Claude Codeのフロントマター仕様](https://code.claude.com/docs/en/skills#using-skill-frontmatter-outside-claude-code)）。

- claude.aiへのアップロード
- Skills API
- [`package_skill.py`](https://github.com/anthropics/skills/blob/main/skills/skill-creator/scripts/package_skill.py)

一方、次の2つの実装は仕様外フィールドを拒否せず黙って無視することが確認できている。

- OpenAIのCodexは仕様外フィールドを無視する（[codex-rs/skills/src/parser.rs](https://github.com/openai/codex/blob/d109393270432531ac0010542ae7973801e0d9d7/codex-rs/skills/src/parser.rs#L6-L20)）
- opencodeは仕様外フィールドを無視し、自身も仕様外の`slash`フィールドを読んでいる（[packages/core/src/skill.ts](https://github.com/anomalyco/opencode/blob/550d1ffd24718454925c4636e937878f0274de48/packages/core/src/skill.ts#L33-L38)）

拒否・無視のいずれも、この一覧の実装でのみ確認できている。
他の実装の挙動は未確認である。
個々の指摘メッセージが特定の実装を名指ししないのは、拒否する経路と無視する経路の両方が確認できているためである。

## 仕様の解釈

仕様の記述が一意に定まらない箇所がある。
いずれも**通す範囲が狭い側**を採る。
ここを通るスキルは、別の解釈を採る検証器でも通る。

### 文字数の単位

仕様は`name`を64文字以内、`description`を1024文字以内と定めるが、単位を書いていない。
UTF-16符号単位で数える。
コードポイント数を下回らないため、判定が安全側へ倒れる。

バイト数で数える解釈は成立しない。
UTF-8のバイト数で数えると、複数バイト文字を含む`description`のうち、
仕様に適合するものまで文字数超過として落としてしまう。

### `name`の文字種

仕様は`name`フィールドの文字種を次のように定めている。

> May only contain unicode lowercase alphanumeric characters (`a-z`, `0-9`) and hyphens (`-`)

この文言には、Unicodeの小文字・数字全般を許す読みと、`a-z0-9`に限る読みがある。
前者の読みでは、Unicode一般カテゴリがLowercase Letter（Ll）の`µ`（U+00B5、マイクロ記号）も許されてしまう。
Decimal Number（Nd）の`０`（U+FF10、全角数字）も同様である。
本検証は狭い側を採り、`a-z0-9`とハイフンに限る。
