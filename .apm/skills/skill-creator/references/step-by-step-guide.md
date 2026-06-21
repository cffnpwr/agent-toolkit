# スキル作成 ステップバイステップガイド

着想から公開まで、Agent Skillを作成する完全なワークフロー。

## プロセス概要

1. 具体例を通じたスキルの理解
2. 再利用可能なスキル内容の計画
3. スキルの初期化
4. スキルの編集
5. 依存の宣言
6. スキルの検証
7. SubAgentレビュー
8. スキルの公開
9. イテレーション

## ステップ1: 具体例を通じたスキルの理解

**目的:** 具体例を通じて、スキルがどう使われるかを明確に理解する。

**省略してよい場合:** 使われ方が既に完全に明確な場合のみ省略する。

### アプローチ

スキルの使われ方の具体例を収集または生成する。

**ユーザーと協働する場合:**

- 「このスキルはどんな機能をサポートすべきか」
- 「使われ方の具体例を挙げられるか」
- 「このスキルを起動させるべきユーザーの発話はどのようなものか」
- 「考慮すべきエッジケースやバリエーションはあるか」

**単独で作成する場合:**

- 現実的な利用シナリオを生成する
- 異なるユーザー意図と言い回しを想像する
- 複雑さと文脈のバリエーションを考慮する
- 入力例と期待される出力を文書化する

### 例: Image Editor スキル

**答えるべき問い:**

- 機能: 編集、回転、リサイズ、フィルタ、フォーマット変換
- 利用例:
  - "Remove red-eye from this photo"
  - "Rotate image 90 degrees clockwise"
  - "Convert PNG to JPEG"
  - "Apply sepia filter"
- トリガー: "edit image", "modify photo", "rotate picture", "convert image format"

### 避けるべきこと

- 一度に多くの質問をすること（負担が大きい）
- 機能について曖昧であること
- エッジケースの考慮を省略すること
- 具体例を文書化しないこと

### 完了基準

以下を明確に理解している。

- スキルが何をするか
- ユーザーがどう起動するか
- どんなバリエーションが存在するか
- どんな出力が期待されるか

## ステップ2: 再利用可能なスキル内容の計画

**目的:** このスキルを再利用可能で効率的にするためのスクリプト・リファレンス・アセットを特定する。

### 分析プロセス

ステップ1の各具体例について以下を行う。

1. **ゼロからの実装を考える** - スキルなしでこれをどう実行するか。
2. **繰り返しを特定する** - 毎回書き直すコード／データは何か。
3. **脆さを特定する** - エラーを起こしやすい、または正確な実行を要する操作は何か。
4. **大量コンテンツを特定する** - SKILL.mdには大きすぎる情報は何か。

### 判断フレームワーク

**インラインの指示を書く（scripts/ ディレクトリを作らない）のは以下の場合:**

- タスクが、エージェントが直接実行できる短いシェルコマンドや編集の連続である
- 決定論的で再利用可能なコードが不要である
- 散文の指示で正しく行える程度に単純な操作である

**スクリプトを作るのは以下の場合:**

- 同じコードパターンが複数の例に現れる
- 操作が決定論的かつエラーのない実行を要する
- 複雑なアルゴリズムやデータ処理
- 特定のフラグ／オプションを伴う外部ツール連携
- テスト済みで同梱されたスクリプトなしでは正しく実行しづらいコマンド

**エージェント向けスクリプト設計:**

- 対話的プロンプトを使わない（エージェントは非対話シェルで動作する）
- フラグ、環境変数、stdin経由で入力を受け取る
- 利用例付きの `--help` 出力を実装する
- 構造化出力（JSON/CSV）をstdoutへ、診断情報をstderrへ出す
- 破壊的操作には `--dry-run` をサポートする
- 意味のある終了コードを使い、それを文書化する
- 操作を冪等にする（エージェントはリトライしうる）

**リファレンスファイルを作るのは以下の場合:**

- APIドキュメントやスキーマ情報
- 包括的なワークフローガイド
- ドメイン知識やポリシー
- 例とパターンのライブラリ
- SKILL.mdには詳細すぎる内容

**アセットを作るのは以下の場合:**

- コピーまたはカスタマイズされるテンプレート
- 画像、アイコン、フォント
- ボイラープレートコードやプロジェクト構造
- サンプルデータファイル

### 例: PDF Editor スキル

**分析:**

"Rotate this PDF 90 degrees":

- ゼロから: 毎回pypdfでPythonコードを書くことになる
- 繰り返し: PDF回転のコードパターン
- 判断: `scripts/rotate_pdf.py` を作る

"Fill out this PDF form":

- ゼロから: フィールド名を調べてから入力コードを書くことになる
- 繰り返し: フォーム入力ロジック
- 大量コンテンツ: 一般的なフィールド名のマッピング
- 判断: `scripts/fill_form.py` と `references/common-fields.md` を作る

"Merge multiple PDFs":

- ゼロから: pypdfでマージロジックを書くことになる
- 繰り返し: マージのコードパターン
- 判断: `scripts/merge_pdfs.py` を作る

**結果:**

```
pdf-editor/
├── scripts/
│   ├── rotate_pdf.py
│   ├── fill_form.py
│   └── merge_pdfs.py
└── references/
    └── common-fields.md
```

### 避けるべきこと

- 過剰設計（一度きりの操作にスクリプトを作らない）
- 過少設計（AI Agentに同じコードを繰り返し書き直させない）
- 重複（SKILL.mdとreferences/の両方に情報を置く）
- アセットの欠落（テンプレートは再作成せず同梱する）

### 完了基準

以下の明確なリストがある。

- 作成するスクリプト（言語選択を含む）
- 同梱するリファレンスファイル（内容の概要を含む）
- バンドルするアセット（取得元の特定を含む）

## ステップ3: スキルの雛形作成

**目的:** テンプレートからスキルのディレクトリ構造を作る。

### 省略してよい場合

スキルディレクトリが既に存在し、イテレーション中である場合のみ省略する。

### 手順

生成スクリプトは無い。次の手順で作る。

1. スキル名と同名のディレクトリを作る。
2. [`templates/SKILL.md.template`](../templates/SKILL.md.template) を読み、`{{SKILL_NAME}}`・`{{SKILL_TITLE}}` を置換して `<skill-name>/SKILL.md` として書き出す。
3. 必要に応じて `scripts/`・`references/`・`assets/` を追加する。

**スキル名の要件:**

- ケバブケース（小文字、ハイフン）
- 最大64文字
- 先頭・末尾のハイフン禁止
- 連続するハイフン禁止
- 親ディレクトリ名と一致

### 作成されるもの

```
<skill-name>/
├── SKILL.md        # テンプレートを置換したもの
├── scripts/        # 任意
├── references/     # 任意
└── assets/         # 任意
```

### 即座に行うこと

1. **SKILL.mdのTODOを確認する** - テンプレートのTODOセクションを埋める・削除する
2. **計画したリソースを作成する** - ステップ2のスクリプト・リファレンス・アセットを追加する

### 完了基準

- スキルディレクトリが存在する
- SKILL.mdテンプレートが配置されている
- リソースディレクトリがステップ2の計画と一致する
- プレースホルダファイルが削除または置換されている

## ステップ4: スキルの編集

**目的:** スキルの機能とドキュメントを実装する。

### 4.1 再利用可能なリソースを先に実装する

スクリプト・リファレンス・アセット（ステップ2）から始める。

**スクリプトについて:**

1. 機能を実装する
2. シバン行を追加する（`#!/usr/bin/env python3`）
3. 目的と使い方を説明するdocstringを追加する
4. `--help` 出力を実装する（エージェントがスクリプトのインターフェースを知る手段）
5. 対話的プロンプトを使わない — 入力はすべてフラグ、環境変数、stdin経由とする
6. 構造化出力（JSON/CSV）をstdoutへ、診断情報をstderrへ出す
7. 破壊的操作には `--dry-run` を追加する
8. 意味のある終了コードを使い、`--help` で文書化する
9. 同期済み環境内で直接実行してテストする（例: `uv run python scripts/script.py`）
10. 実行可能にする: `chmod +x scripts/script.py`

**同期済みの依存環境内でスクリプトを実行する:**

パッケージ化された依存を要するスクリプトは、その都度パッケージをインストールするのではなく、同梱されロックされた環境に対して実行しなければならない。言語ごとのパッケージマネージャのランナーを通じて実行する。例えば以下のとおり。

- Python: `uv run python scripts/extract.py`
- JS/TS: `pnpm exec node scripts/extract.js`
- Ruby: `bundle exec ruby scripts/extract.rb`
- PHP: `composer exec -- php scripts/extract.php`

依存がどう宣言され、ロックされるかはステップ5を参照。

**リファレンスについて:**

1. 包括的なドキュメントを書く
2. 100行を超える場合は目次を追加する
3. 例とコードサンプルを含める
4. 1万語を超える場合はgrepしやすい構造にする

**アセットについて:**

1. テンプレートファイルをコピー／作成する
2. ファイルが最終的に使える形であることを保証する
3. 必要なカスタマイズを文書化する

**テスト要件:** 代表的なスクリプトをテストして動作を確認する。パターンが同一なら全スクリプトのテストは不要だが、中核機能は検証する。

### 4.2 SKILL.mdのフロントマターを更新する

**name:** ディレクトリ名と一致させる（必須。`quick_validate.py` が検査する）

**description:** TODOを包括的な説明で更新する。

- スキルが何をするか（機能）
- いつ使うか（トリガーと文脈）
- 主要な能力や特徴
- 目安: 100〜200語（約500〜1000文字）。ハードリミットは1024文字
- すべての起動シナリオを含める

**例:**

```yaml
description: |
  Comprehensive PDF document processing with rotation, merging, splitting, form filling,
  and text extraction. Use when working with PDF files for: (1) rotating pages,
  (2) combining multiple PDFs, (3) extracting pages or content, (4) filling form fields,
  (5) extracting text for analysis. Triggers on "PDF", "rotate", "merge", "extract", "form".
```

`compatibility` フロントマターフィールドはステップ5で宣言する（スキルが依存を持つ場合のみ）。残りのフロントマターはTODOを残さないようにする。

### 4.3 SKILL.md本文を書く

**必須セクション:**

1. **Overview**（1〜2文） - このスキルが可能にすること

2. **Requirements** - 依存が存在する場合（ステップ5参照）:
   - パッケージ化された依存と外部ツールに関する正式な詳細
   - 使用前検証の前文とチェックコマンド

3. **Main Content** - 構造を選ぶ:
   - ワークフローベース（逐次的なプロセス）
   - タスクベース（操作のカテゴリ）
   - リファレンス／ガイドライン（標準）
   - 能力ベース（機能一覧）

4. **Resources**（任意） - 同梱したスクリプト／リファレンス／アセットを文書化する

**SKILL.mdを500行未満に保つ:**

- 詳細な内容はreferences/へ移す
- リファレンスへ明確にリンクする
- 各リファレンスをいつ読むべきか説明する

**文体:**

- 命令形（"Run the script" であって "You should run" ではない）
- 簡潔かつ実行可能
- 説明より例
- コメント付きのコードサンプル

### 完了基準

- 計画したすべてのリソースが実装されている
- SKILL.mdのフロントマターが依存フィールド（ステップ5）を除いて完成している
- SKILL.md本文が書かれている（500行未満）
- 例とコードサンプルが含まれている
- リファレンスへ明確にリンクされている

## ステップ5: 依存の宣言

**目的:** エージェントが使用前に検証できるよう、スキルの外部ランタイム依存を宣言する。

**省略してよい場合:** スキルに依存がない場合 — パッケージ化された依存を持つ同梱スクリプトも外部CLIツールもない場合 — はこのステップを丸ごと省略する。その場合、`compatibility` フロントマターフィールドと `## Requirements` セクションの両方を省く。

### 二箇所モデル

スキルが依存を持つ場合、**互いに一致しなければならない二箇所**で宣言する。

1. **`compatibility` フロントマターフィールド** — 1〜2行の機械可読な要約。
2. **SKILL.md本文の `## Requirements` セクション** — 正式な詳細。

依存は、スキルが同梱スクリプトを配布する、サードパーティライブラリをパッケージ化する、または外部CLIを呼び出すときに存在する。いずれかが真なら両箇所が必須。いずれも真でなければ両方を省く。

### 依存の特定

評価スクリプトは存在しない。`scripts/` を手作業で精査する。

- 存在する言語を列挙する（ファイル拡張子、シバン）。
- 各スクリプトを読み、サードパーティの `import` / `require` / `use` 文（その言語の標準ライブラリに含まれないもの）を確認する。
- スクリプトがシェルアウトする外部コマンドに注意する（例: `git`、`ffmpeg`、`libreoffice`）。
- SKILL.mdの指示がエージェントに直接実行させる外部CLIに注意する。

### `compatibility` フィールド

短い要約。例えば以下のとおり。

```yaml
compatibility: |
  Requires Python 3.11+ (deps via uv: pypdf, pdfplumber) and the `libreoffice` CLI.
```

### `## Requirements` セクション

これは正式な詳細である。前文では、依存パッケージはコミット済みロックファイルから同期してよいこと（`uv sync --frozen` 等はgit検知の更新を生まないためエージェントが実行してよい）、外部ツールの不在・依存の追加更新・フォールバックが必要な場合はSTOPしてユーザーへエスカレーションすること、外部ツールの導入や依存宣言・ロックファイルの変更は行わないことを述べることから始める。

続いて該当する表を含める。

**依存パッケージ表** — スキルがパッケージ化された依存を同梱する言語ごとに1行。

| 言語 | パッケージマネージャ | 定義ファイル | ロックファイル | インストールコマンド |
| --- | --- | --- | --- | --- |
| JS/TS | pnpm | `package.json` | `pnpm-lock.yaml` | `pnpm install --frozen-lockfile` |
| Python | uv | `pyproject.toml` | `uv.lock` | `uv sync --frozen` |
| Ruby | bundler | `Gemfile` | `Gemfile.lock` | `bundle install` |
| PHP | composer | `composer.json` | `composer.lock` | `composer install` |

定義ファイル **と** そのロックファイルをスキルディレクトリに同梱し、環境の存在を確認するためにエージェントが実行するチェックコマンドを与える（例えばPythonなら `uv run python -c "import pypdf"`）。

**外部ツール表** — スキルが必要とする外部CLIごとに1行。

| ツール | バージョン要件 |
| --- | --- |
| libreoffice | 7.0+ |
| ffmpeg | any |

各ツールについて、存在確認を与える（例えば `command -v libreoffice`）。

### 言語別パッケージマネージャ（ロックファイル標準）

各言語の標準的なパッケージマネージャを使い、そのロックファイルを同梱する。

- **JS/TS** → pnpm（`package.json` / `pnpm-lock.yaml` / `pnpm install --frozen-lockfile`）
- **Python** → uv（`pyproject.toml` / `uv.lock` / `uv sync --frozen`）
- **Ruby** → bundler（`Gemfile` / `Gemfile.lock` / `bundle install`）
- **PHP** → composer（`composer.json` / `composer.lock` / `composer install`）

スクリプトはその後、同期済み環境内で呼び出す（例: `uv run python scripts/x.py`）。

### ロックが不十分な言語

標準的なロックファイルワークフローを持たない言語（Perl、PowerShell、R、Lua）の場合:

- 必要な全パッケージの正確なバージョンを `## Requirements` セクションに固定する。
- チェックコマンドによる手動検証に頼る。
- インラインやロックファイルベースのインストール機構を試みない。

### 完了基準

- スキルに依存がない → `compatibility` と `## Requirements` の両方を省く。
- スキルに依存がある → 両方が存在し一致する。
- パッケージ化された各言語について定義ファイル＋ロックファイルを同梱する。
- すべての依存にチェックコマンドがある。

## ステップ6: スキルの検証

**目的:** 公開前にスキルがすべての要件を満たすことを保証する。

### コマンド

```bash
uv run python scripts/quick_validate.py <skill-directory>
```

### 検証される内容

**エラー（必ず修正する）:**

- SKILL.mdが存在する
- 有効なYAMLフロントマター形式
- 必須フィールドが存在する: name, description
- 名前形式: ケバブケース、最大64文字、親ディレクトリ名と一致
- 説明形式: 非空、最大1024文字
- `compatibility` 形式（存在する場合）: 非空、最大500文字
- 予期しないトップレベルフィールドは警告（仕様は `metadata` での拡張を認める）

**警告（対処すべき）:**

- 説明が短すぎる（50文字未満）
- スクリプトは存在するが `compatibility` / `## Requirements` が宣言されていない
- 依存は宣言されているがチェックコマンドが存在しない
- `compatibility` にTODOプレースホルダが含まれる

### 検証エラーの修正

**"'name' should be kebab-case":**

- 対処: ディレクトリをリネームし、nameフィールドを小文字とハイフンのみに更新する

**"'compatibility' field contains TODO":**

- 対処: 依存の宣言を完成させる（ステップ5）

**"Found scripts but no Requirements section":**

- 対処: 両箇所で依存を宣言する（ステップ5）。または本当に依存がないことを確認し、スクリプト／誤検出を削除する

### 完了基準

- 検証がエラーなく通る
- すべての警告が対処済み、または意識的に受容されている
- レビューと公開の準備ができている

## ステップ7: SubAgentレビュー

**目的:** 依存の正確さと全体的な品質の自動レビュー。

### 使うべき場合

- 検証が通った後
- 公開前
- 依存の網羅性に不安がある場合
- 複雑な多言語スキルの場合

### レビュータスク1: 依存の検証

**タスク:**

```
Review the dependency declaration for the skill at [path].

Checks to perform:
1. Inspect scripts/ for languages and third-party imports/requires.
2. For each language with packaged deps, confirm:
   - The definition file and lockfile are bundled.
   - The package manager matches the standard (Python→uv, JS/TS→pnpm,
     Ruby→bundler, PHP→composer).
3. Identify external CLIs the scripts shell out to or the SKILL.md tells the
   agent to run.
4. Confirm the `compatibility` frontmatter and the `## Requirements` section
   both exist and agree (or both are correctly absent for a no-dependency skill).
5. Confirm every dependency has a check command.

Report format:
- Missing dependencies: [list]
- Extra/unnecessary declarations: [list]
- compatibility vs Requirements agreement: [agree/disagree with details]
- Check commands: [present/missing per dependency]
- Overall assessment: [pass/fail with specific reasons]
- Recommendations: [improvement suggestions]
```

### レビュータスク2: 一般的な品質（任意）

**タスク:**

```
Perform quality review of skill at [path].

Review areas:
1. SKILL.md clarity and completeness
2. Proper use of progressive disclosure (references/ organization)
3. Example quality and relevance
4. Documentation consistency
5. Code quality in scripts (if applicable)

Report findings with specific suggestions for improvement.
```

### レビュー結果への対応

1. **欠落した依存に対処する** - ただちに（正しさの問題）
2. **余分な宣言を検討する** - 誤検出かもしれない
3. **欠落したチェックコマンドを追加する**
4. **品質の問題をイテレーションする** - 時間が許す範囲で

### 完了基準

- SubAgentレビューが完了している（または意識的に省略されている）
- 重大な問題が対処済み
- フィードバックに基づきスキルの品質が向上している

## ステップ8: スキルの公開

**目的:** スキルを利用可能にする。

このリポジトリはスキルをAPMで配布する。`.skill` のパッケージング手順は存在しない。

### プロセス

1. **スキルディレクトリ配下に配置する** — 例: `.apm/skills/<name>/`。すべての兄弟ファイル（SKILL.md、scripts/、references/、assets/、同梱した定義ファイルとロックファイル）をスキルディレクトリ内に置く。
2. APM設定の **`includes: auto`** が自動的に公開する。手動のパッケージングやビルド手順は不要。

### 配布されるもの

スキルディレクトリ内のすべて。

- SKILL.md
- scripts/ とその全内容
- references/ とその全内容
- assets/ とその全内容
- 同梱した依存の定義ファイルとロックファイル
- 維持されたディレクトリ構造

### 完了基準

- スキルディレクトリがスキルディレクトリ配下に配置され、兄弟ファイルが同梱されている
- `includes: auto` により取り込まれる
- 利用可能である

## ステップ9: イテレーション

**目的:** 実運用での利用に基づいてスキルを改善する。

### イテレーションすべき場合

- スキルを実タスクで使った後
- ユーザーが問題や混乱を報告したとき
- 依存が変わったとき（パッケージ更新、言語バージョン）
- 新機能が必要になったとき

### イテレーションワークフロー

1. **スキルを使う** - 実タスクで
2. **躓きに気づく** - AI Agentやユーザーがどこで詰まるか
3. **改善点を特定する** - SKILL.mdの明確さか、スクリプトの欠落か、例の不出来か
4. **変更を実装する**
5. **再検証**し、**再公開**する

### よくあるイテレーションのトリガー

**"AI Agent keeps asking for clarification":**

- SKILL.mdの例が曖昧すぎる可能性がある
- より具体的な例を追加する
- 判断ポイントを明確化する

**"Scripts frequently need patching":**

- スクリプトへのパラメータ追加を検討する
- references/ に一般的なバリエーションを文書化する
- スクリプトの利用例を追加する

**"Skill is slow (high token usage)":**

- SKILL.mdが冗長すぎる可能性がある
- 詳細をreferences/へ移す
- 段階的開示を改善する

**"Dependencies fail to resolve":**

- 定義ファイルとロックファイルが同期していない可能性がある — インストールコマンドを再実行し、ロックファイルを再同梱する
- チェックコマンドが不明瞭な可能性がある — コピー＆ペースト可能にする
- 必要な外部ツールが未宣言の可能性がある — `## Requirements` に追加する

### 完了基準

スキルが本番で確実に機能する。

- AI Agentがうまく使える
- 依存が宣言され検証可能である
- エラー率が低い
- ドキュメントが明確である

## サマリーチェックリスト

スキルを完成とみなす前に確認する。

**ステップ1-2: 計画**

- [ ] 具体的な利用例が文書化されている
- [ ] スクリプト／リファレンス／アセットが計画されている

**ステップ3-4: 実装**

- [ ] テンプレートからスキルの雛形を作成した
- [ ] リソースが実装・テストされている
- [ ] SKILL.mdのフロントマターが完成している（description、name）
- [ ] SKILL.md本文が書かれている（500行未満）

**ステップ5: 依存**

- [ ] 依存なし → `compatibility` と `## Requirements` の両方を省く
- [ ] 依存あり → 両方が存在し一致する
- [ ] パッケージ化された言語ごとに定義ファイル＋ロックファイルを同梱する
- [ ] 外部ツールがバージョン要件とともに列挙されている
- [ ] すべての依存にチェックコマンドがある

**ステップ6-7: 検証**

- [ ] quick_validate.py がエラーなく通る
- [ ] 警告が対処済み
- [ ] SubAgentレビューが完了している（または省略されている）
- [ ] 重大な問題が解決済み

**ステップ8: 公開**

- [ ] スキルがスキルディレクトリ配下に配置され、兄弟ファイルが同梱されている
- [ ] `includes: auto` により取り込まれる

**ステップ9: イテレーション**

- [ ] 実タスクでテストされている
- [ ] 将来のイテレーション用に問題が記録されている

**これで本番運用可能なスキルが完成。**
