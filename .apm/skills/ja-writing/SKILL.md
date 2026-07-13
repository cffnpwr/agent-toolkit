---
name: ja-writing
description: >
  日本語の文章品質を、textlintによる静的解析とAIによる補完レビューで担保する。
  (1) ドキュメント・README・コミットメッセージ・issue/PR本文・コードコメントなど日本語の文章を書くとき、
  (2) 既存の日本語文章の品質をレビューするとき、
  (3) textlintを実行して日本語文書を機械的にチェックするときに使う。
  textlintのセットアップと実行、結果の解釈、textlintでは検出できないルール（誤検出の少ないパターン）、
  誤検出時の抑制方法を扱う。
compatibility: |
  Required: bun >= 1.2; packages: textlint + 日本語向けルール群・prh（package.json / bun.lock 経由）
---

# 日本語ライティング品質 — ja-writing

textlintによる静的解析とAIによる補完レビューを組み合わせて、日本語の文章品質を担保する。

## Requirements

使用前に依存パッケージをロックファイルから同期する（`bun install --frozen-lockfile --production`）。これは`node_modules/`のみを変更しgit管理外のためAgentが実行してよい。
依存の追加・更新、外部ツールの導入、代替手段へのフォールバックが必要な場合は、進行を停止しユーザーへエスカレーションする。

### 依存パッケージ

| 言語 | パッケージマネージャ | 定義ファイル | ロックファイル | インストールコマンド |
| --- | --- | --- | --- | --- |
| JavaScript / TypeScript | bun | `package.json` | `bun.lock` | `bun install --frozen-lockfile --production` |

```sh
bun install --frozen-lockfile --production
```

### 外部ツール

| ツール | バージョン要件 |
| --- | --- |
| bun | `>= 1.2`（`bun.lock`のテキスト形式がデフォルトになったバージョン） |

```sh
command -v bun >/dev/null 2>&1 || { echo "bun not found." >&2; exit 1; }
```

## textlintの実行

作業中のリポジトリに独自のtextlint設定（`.textlintrc`・`.textlintrc.json`等）があれば、そちらを優先して使う。無い場合のみ、このスキルの`.textlintrc.json`を使う。

コマンドはこのSKILL.mdが置かれたスキルディレクトリを基準とする相対パスで示す（作業中のリポジトリの設定を使う場合は`--config`の値をそちらのパスに読み替える）。`bun x`はグローバルインストールなしに同梱の`node_modules/.bin/`を解決する。

```sh
# 単一ファイルをチェック
bun x textlint --config .textlintrc.json /absolute/path/to/file.md

# 複数ファイル・globをチェック
bun x textlint --config .textlintrc.json "**/*.md"

# 自動修正可能なエラーを修正
bun x textlint --fix --config .textlintrc.json /absolute/path/to/file.md
```

インストール確認は次のコマンドで行う。全ルールでエラーが検出されることを確認する。

```sh
bun x textlint --config .textlintrc.json assets/examples-ng.md
```

> Markdownファイルをチェックする際、`markdownlint`等のMarkdown用のLinterが使用可能であれば、textlintが扱わない構造的な問題（見出しレベル・リスト書式など）も別途確認する。

## 結果の解釈

各エラー行の形式: `line:col  severity  message  (rule-name)`

```
3:1  error  1文の長さは100文字以下にしてください (preset-ja-technical-writing/sentence-length)
```

- `error`: 必ず修正する
- `warning`: 見直しを検討する

## 誤検出の抑制

textlintが妥当な内容（固有名詞・コード用語・意図的なスタイル）を誤検知したと判断した場合、抑制コメントを追加する前に、該当箇所・ルール名・誤検知と判断した理由をユーザーに示し許可を得る。ユーザーの許可を得たら、次のように囲む。

```markdown
<!-- textlint-disable rule-name -->

誤検出された内容。

<!-- textlint-enable rule-name -->
```

1行のみを対象にする場合は次のようにする。

```markdown
対象の行。 <!-- textlint-disable-line rule-name -->
```

よくある誤検出を次に示す。

- 固有名詞による長い漢字連続（例: `日本電信電話株式会社`）→ `preset-ja-technical-writing/max-kanji-continuous-len`を抑制
- リスト項目末尾に意図的な句点があるもの → `period-in-list-item`を抑制
- `prh`ルールが文脈上妥当な表現を誤検知したもの → 該当箇所のみ`prh`を抑制する（安易な言い換えを強制しない）

## textlintで検出できないルール（AIによる補完が必要）

以下はtextlintのカバレッジ外のため、手動またはAIによる確認が必要。チェック項目は[references/ai-review-checklist.md](references/ai-review-checklist.md)にまとめている。

### AIによる補完レビューの手順

[references/ai-review-checklist.md](references/ai-review-checklist.md)の項目は、今回の文章作成の文脈（何を意図して書いたか・直前の議論内容など）を共有しない別エージェント（サブエージェント機能があれば使う。無ければ新規セッション）にレビューさせる。渡すのは対象テキストと同ファイルの内容のみとし、この文書作成の経緯や意図は伝えない。

理由: 文章を書いた本人（同一文脈を共有するエージェント）は自分の文章の妥当性を過大評価しやすい。単純なルール準拠確認に文脈は不要で、むしろ判定を甘くする方向にバイアスをかける。

レビュー依頼時は各チェック項目について違反箇所の引用を求め、違反の有無と該当箇所のみを返させる（文脈に基づく解釈や執筆意図の忖度をさせない）。
