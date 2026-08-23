# agent-toolkit Design Doc

AI Agent向けのprimitiveを宣言し、複数のharnessへ配布するAPMパッケージの設計。
primitiveは[APMが配布する最小単位](https://microsoft.github.io/apm/concepts/glossary/#primitive)で、
種別にskills・hooks・instructions・prompts・agents・commands・MCP serversがある。
harnessは[primitiveを実行するagent runtime](https://microsoft.github.io/apm/concepts/glossary/#harness)。

## スコープと非スコープ

### スコープ

- primitiveのディレクトリ構成と配布の仕組み
- 外部依存の宣言と供給の方針
- hookの設計上の規約

### 非スコープ

- 個々のスキル・hookが扱うドメイン知識の内容
- スキルの内部構成と作成手順(skill-creatorスキルが定める)
- harness本体・APM本体の実装

## 目次

| ドキュメント | 内容 |
| --- | --- |
| [設計原則](./principles.md) | 全体を通しての原則 |
| [全体アーキテクチャ](./architecture.md) | リポジトリ構成、配布の仕組み |
| [Hook機構](./hooks.md) | hookの配置、入出力、発火イベント、依存の扱い |
| [スキルの静的検証](./skills-check.md) | 検査の分類、仕様の解釈、仕様外フィールドの扱い、道具の選定 |
