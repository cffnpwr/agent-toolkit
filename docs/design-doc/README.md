# agent-toolkit Design Doc

AI Agent向けのスキルとhookを、Harness非依存に宣言し、ホスト環境で再現的に動かすためのパッケージの設計。

## スコープと非スコープ

### スコープ

- スキルとhookのディレクトリ構成・配布の仕組み
- 外部ランタイム依存の宣言と供給方式
- 複数Harnessにまたがる動作の設計
- スキル・hookの追加と検証の流れ

### 非スコープ

- 個々のスキル・hookが扱うドメイン知識の内容
- Harness本体・APM本体の実装

## 目次

| ドキュメント | 内容 |
| --- | --- |
| [設計原則](./principles.md) | 全体を通しての原則 |
| [全体アーキテクチャ](./architecture.md) | リポジトリ構成、APM配布、Harnessとモデルの区別 |
| [スキル機構](./skills.md) | スキルの構成、依存宣言、段階的開示、スクリプト設計 |
| [Hook機構](./hooks.md) | hookの配置規約とHarness非依存の設計 |
| [外部ランタイム依存](./dependencies.md) | 依存の宣言・供給・検証の方針 |
| [運用](./operations.md) | スキル・hookの追加、検証、配布 |
