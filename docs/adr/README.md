# ADR

ADR(Architecture Decision Record)は、トレードオフを伴う判断を記録する。
何を選び、どの選択肢を却下したか、その理由を残す。

## 運用規約

- ファイル名は`NNNN-kebab-slug.md`とし、`NNNN`は4桁のゼロ埋め連番とする
- ID`0000`はテンプレート専用の予約枠とする
- front matterは`ID`・`date`・`status`の3キーを持つ
- `ID`は連番の数値とし、ファイル名の`NNNN`と一致させる
- `date`は作成日を入れ、以後は更新するたびにその日付へ更新する
- `status`は`proposed`・`accepted`・`deprecated`・`superseded by <ID>`のいずれかを取る
- 決定が覆った場合は、旧ADRの`status`を`superseded by <新ID>`に変え、新しいADRを立てる
- 旧ADRは削除しない

## 本文の構成

本文は[0000-adr-template.md](./0000-adr-template.md)の構成に従う。

## 索引

| ID | タイトル | status |
| --- | --- | --- |
| [0001](./0001-adopt-apm.md) | APMをパッケージ配布の仕組みに採用する | accepted |
| [0002](./0002-hook-exit-code-protocol.md) | hookの出力を終了コードへ一本化する | accepted |
| [0003](./0003-no-external-tool-install.md) | primitiveは外部ツールを導入せず、依存パッケージの同期にとどめる | accepted |
| [0004](./0004-yaml-parser.md) | YAMLパーサに`yaml`を採用する | accepted |
| [0005](./0005-skills-ref.md) | 検証に参照ライブラリ`skills-ref`を使わない | accepted |
| [0006](./0006-tokenizer.md) | トークン数の概算に`gpt-tokenizer`を使う | accepted |
