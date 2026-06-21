---
name: skill-creator
description: 明示的で再現性のある依存宣言を備えたAgent Skillを作成するためのガイド。新しいスキルを作る、既存スキルを更新する、知識やスクリプトをスキルにまとめる、あるいはスキルの構成・依存宣言・エージェント向けスクリプト設計の指針が必要なときに使う。主な特徴は、compatibilityフロントマターフィールドとRequirements節による依存宣言、ロックファイルによる再現性（Pythonはuv、JavaScript/TypeScriptはpnpm、その他は言語ごとのパッケージマネージャ）、存在確認を伴う外部ツールの明示宣言、Agentによる導入・フォールバックの禁止、多言語スクリプト対応、quick_validate.pyによる検証、テンプレートからの雛形作成、エージェント向けスクリプト設計指針（非対話・構造化出力・冪等性・ヘルプ・終了コード）。ユーザーがスキルを作成・構成・検証したいとき、またはスキルの依存をどう宣言するか尋ねたときに起動する。
compatibility: |
  Required: Python 3.11+, uv; packages: PyYAML（pyproject.toml / uv.lock 経由）
  Scripts: quick_validate.py
---

# Skill Creator

明示的な依存宣言と検証を備えたAgent Skillを作成するためのガイド。

## 概要

このスキルは、Agent Skill（AI Agentの能力を専門知識・ワークフロー・ツールで拡張するモジュール式パッケージ）を作成するための指針とツールを提供する。スキルは、汎用エージェントをドメイン知識を備えた専門エージェントへ変える「オンボーディングガイド」と捉えるとよい。

**このskill-creatorの設計方針:**

1. **明示的な依存宣言** - スキルは外部ランタイム依存を`compatibility`フロントマターフィールドと`## Requirements`節で宣言し、両者を一致させる。
2. **ロックファイルによる再現性** - 依存パッケージは、スキルに同梱した定義ファイルとロックファイルでバージョンを固定する（Pythonはuv、JavaScript/TypeScriptはpnpm、その他は言語ごとのパッケージマネージャ）。
3. **再現的な操作のみ自律** - 依存パッケージはコミット済みロックファイルから`uv sync --frozen`等で同期する（git検知の更新を生まないためAgentが実行してよい）。依存の追加・更新、外部ツールの導入、フォールバックは行わず、停止・エスカレーションする。
4. **多言語スクリプト対応** - 標準ロックファイルを持つ言語はそれを使う。持たない言語は例外規約に従う（正確なバージョンを固定し、手動確認を明記）。
5. **検証** - `quick_validate.py`がフロントマターの構造と依存宣言の整合を検査する。
6. **エージェント向けスクリプト設計** - 非対話・構造化出力・冪等性・`--help`・終了コード。

## Requirements

使用前に依存パッケージをロックファイルから同期する。これは`.venv`のみを変更しgit検知の更新を生まないため、Agentが実行してよい。
依存の追加・更新、外部ツールの導入、代替手段へのフォールバックが必要な場合は、進行を停止しユーザーへエスカレーションする。依存宣言の変更と外部ツールの充足は環境側の責務とする。

### 依存パッケージ

| 言語 | パッケージマネージャ | 定義ファイル | ロックファイル | インストールコマンド |
| --- | --- | --- | --- | --- |
| Python | uv | `pyproject.toml` | `uv.lock` | `uv sync --frozen` |

ロックファイルから依存を同期する（Agentが実行してよい）。

```sh
uv sync --frozen
```

### 外部ツール

| ツール | バージョン要件 |
| --- | --- |
| python3 | `>= 3.11` |
| uv | `>= 0.5` |

存在確認（欠けていれば停止・エスカレーション。Agentは外部ツールを導入しない）。

```sh
command -v uv >/dev/null 2>&1 || { echo "uv not found." >&2; exit 1; }
```

同梱スクリプトは同期済み環境内で実行する。例: `uv run python scripts/quick_validate.py <skill-dir>`。

## クイックスタート

**新しいスキルを作成する:**

1. スキル構造を作成する。スキル名と同名のディレクトリを作り、[`templates/SKILL.md.template`](templates/SKILL.md.template)を読んで`{{SKILL_NAME}}`・`{{SKILL_TITLE}}`を置換し、`my-skill-name/SKILL.md`として書き出す。必要に応じて`scripts/`・`references/`・`assets/`を追加する。

2. `my-skill-name/SKILL.md`を編集する。
   - descriptionを完成させる
   - スキルの指示を実装する
   - 不要な雛形セクションを削除する

3. 依存を宣言する（依存が無ければ省略）。
   - `compatibility`フィールドと`## Requirements`節を記入する
   - 依存パッケージは定義ファイルとロックファイルを同梱する
   - 外部のCLI・インタプリタは外部ツールとして列挙する
   - [依存宣言ガイド](references/compatibility-guide.md)を参照する

4. 検証する。
   ```bash
   uv run python scripts/quick_validate.py my-skill-name/
   ```

## 詳細ドキュメント

包括的な指針は以下を参照する。

- **[ステップバイステップガイド](references/step-by-step-guide.md)** - 着想から公開可能なスキルまでの全工程
- **[依存宣言ガイド](references/compatibility-guide.md)** - 依存の判定と宣言
- **[スクリプトガイド](references/scripting-guide.md)** - エージェント向けスクリプトの設計と実行
- **[スクリプトリファレンス](references/scripts-reference.md)** - 同梱スクリプトのCLI使用法
- **[ワークフロー](references/workflows.md)** - 逐次・条件分岐のワークフローパターン
- **[出力パターン](references/output-patterns.md)** - テンプレート・例示によるスキル設計

## 中核原則

### スキルの種別

スキルは2種に大別される。どちらを作るかが設計判断全体を左右する。

**能力拡張スキル**は、エージェントがまだ持たない知識やツールを与える。
- ドメイン固有のAPI・スキーマ・ワークフロー
- 複雑な操作のための同梱スクリプト
- 記憶しきれない大きな参照ドキュメント
- 例: pdf-editor, github-workflow, database-migration

**嗜好エンコードスキル**は、エージェントの能力でなく振る舞いを調整する。
- コーディングスタイル・命名規約
- 出力形式の好み
- コミュニケーションの語調・言語ルール
- 例: ja-writing, code-quality-standards, commit-conventions

この区別が重要な理由は次のとおり。
- 能力拡張スキルはドメインを網羅的に扱う必要がある
- 嗜好エンコードスキルは正確で曖昧さのないルールが要る（曖昧な好みは一貫しない挙動を生む）

### 簡潔さが鍵

コンテキストウィンドウは、システムプロンプト・会話履歴・他スキルのメタデータ・ユーザー要求と共有される。AI Agentがまだ持たない情報だけを加える。

**前提: AI Agentはすでに賢い。** 各情報に「エージェントは本当にこの説明を必要とするか」「このトークンコストに見合うか」を問う。

冗長な説明より簡潔な例を優先する。

### 適切な自由度を設定する

タスクの脆さと多様性に応じて具体度を合わせる。

- **高自由度**（テキスト指示）: 妥当なやり方が複数あり、文脈依存の判断が要る場合
- **中自由度**（擬似コード・パラメータ化スクリプト）: 推奨パターンがあり、揺れは許容される場合
- **低自由度**（具体的なスクリプト）: 操作が脆く、一貫性が重要で、特定の手順が要る場合

### 依存宣言

スキルの外部ランタイム依存は、内容を一致させた2か所で宣言する。

1. **`compatibility`フロントマターフィールド** - 1〜2行の機械可読な要約。
2. **`## Requirements`節** - 正本となる詳細。依存パッケージ表（定義ファイル・ロックファイル・インストールコマンド）と、外部ツール表（バージョン要件・存在確認）からなる。

両者とも、**依存がある場合（同梱スクリプト・依存パッケージ・外部CLI）に必須**とし、**依存が無い場合は省略**する。外部依存の無いスキルはいずれも不要。

このモデルは3つのルールに立つ。

- 全ての外部依存の**明示的な宣言**。
- 同梱した定義ファイルとロックファイルによる**再現性**（標準ロックファイルを持つ言語）。
- 依存パッケージは**ロックファイルから同期**する（`uv sync --frozen`等。git検知の更新を生まないためAgentが実行してよい）。依存の追加・更新、外部ツールの導入、フォールバックは行わず、停止・エスカレーションする。

詳細は[依存宣言ガイド](references/compatibility-guide.md)を参照する。

### descriptionの設計思想

`description`フィールドは、エージェントがそのスキルを読み込むか判断する唯一の手がかり。
書き方が悪いと**起動不足**（必要時に読み込まれない）か**過剰起動**（無関係なタスクで読み込まれコンテキストを浪費）を招く。

**指針:**

- **目安は100〜200語。** 短すぎると起動不足、長すぎると信号が薄まる。
- **「いつ使うか」は本文でなく`description`に置く。** エージェントは読み込み判断の前にdescriptionを読む。起動条件が本文に埋もれていると、その条件では読み込まれない。
- **具体的な起動シナリオを明示列挙する。** 「(1)新しいスキルの作成、(2)既存スキルの更新、(3)スキルの検証のときに使う」は「スキル関連のタスクに使う」のような曖昧表現に勝る。
- **descriptionにMUST・NEVERを避ける。** 強いルールは、読み込み判断の指針でなく、エージェントの一般的振る舞いへの制約に聞こえる。
- **単一の言い回しに最適化しない。** ユーザーは同じ意図を様々に表現する。語そのものでなく意味空間を覆う。

**アンチパターン:**
- 「全てのスキル関連タスクに使う」 — 曖昧で起動不足
- スキル名の繰り返し — トークンの浪費で信号は増えない
- いつ読み込むかでなく全機能の列挙 — 周辺的一致で過剰起動

## スキルの構造

スキルは次の要素からなる。

```
skill-name/
├── SKILL.md (必須)
│   ├── YAMLフロントマター (name, description, compatibility)
│   └── Markdownの指示 (依存がある場合は ## Requirements)
└── 同梱リソース (任意)
    ├── scripts/          - 実行可能コード (Python/Bash/Node.js など)
    ├── references/       - 必要時に読み込むドキュメント
    ├── assets/           - 出力に使うファイル (テンプレート・画像 など)
    └── 依存ファイル       - 定義ファイル + ロックファイル (例: pyproject.toml + uv.lock)
```

### SKILL.mdのフロントマター

必須フィールド:
- **name**: ケバブケースの識別子（最大64文字）
- **description**: 何をするスキルでいつ使うか（最大1024文字、包括的に）

依存フィールド:
- **compatibility**: 1〜2行の依存要約。依存がある場合は必須、無い場合は省略（最大500文字）。

任意フィールド:
- **license**: ライセンス情報
- **allowed-tools**: ツール制限（プラットフォーム依存）
- **metadata**: 追加の構造化データ

### 同梱リソース

#### scripts/
決定的・反復的な操作のための実行可能コード。
- **含める時**: 同じコードを繰り返し書く場合、または決定的な信頼性が要る場合
- **利点**: トークン効率がよく信頼でき、コンテキストに読み込まずに実行できることもある
- **対応言語**: Python・Node.js/TypeScript・Bashを推奨。Ruby・PHP・Perl・PowerShell・R・Luaも対応
- **相対パスで参照**: `bash scripts/validate.sh "$INPUT"` — パスはスキルディレクトリ基準
- **同期済み環境内で実行**: `uv run python scripts/x.py`（Python）、`pnpm exec`/`pnpm run`（Node）。パッケージがグローバルに存在する前提に依存しない
- **依存はインライン化せず宣言する**: 依存パッケージはスキルに同梱した定義ファイル+ロックファイルに置く。インライン依存機構やワンオフのパッケージ実行は使わない

#### references/
必要時にコンテキストへ読み込むドキュメント。
- **含める時**: 詳細なAPIドキュメント・スキーマ・包括的ガイド・ポリシー
- **利点**: SKILL.mdを簡潔に保ち、必要時のみ読み込む
- **ベストプラクティス**: 1万語超のファイルはSKILL.mdにgrepパターンを記す

#### assets/
出力に使い、コンテキストには読み込まないファイル。
- **含める時**: テンプレート・画像・フォント・ボイラープレート・サンプルデータ
- **利点**: コンテキストを消費せず再利用でき、テンプレートベース生成を支える

## 対応スクリプト言語

スクリプトは以下のいずれの言語でも同梱できる。依存パッケージは定義ファイル+ロックファイルで宣言する。

### 標準ロックファイルのパッケージマネージャを持つ言語

| 言語 | パッケージマネージャ | 定義ファイル | ロックファイル | インストールコマンド |
| --- | --- | --- | --- | --- |
| JavaScript / TypeScript | pnpm | `package.json` | `pnpm-lock.yaml` | `pnpm install --frozen-lockfile` |
| Python | uv | `pyproject.toml` | `uv.lock` | `uv sync --frozen` |
| Ruby | bundler | `Gemfile` | `Gemfile.lock` | `bundle install` |
| PHP | composer | `composer.json` | `composer.lock` | `composer install` |

### 標準ロックファイルを持たない言語

Perl・PowerShell・R・Lua など: `## Requirements`節で正確なバージョンを固定し、手動確認の手順を明記する。インライン依存機構は使わない（再現性を損なうため）。

### Bashと依存の無いスクリプト

Bashスクリプトや標準ライブラリのみを使うスクリプトは、依存パッケージを宣言しない。インタプリタと外部CLIだけを外部ツールとして列挙する。

### コンパイル言語について

コンパイル言語（Go・Rust・C/C++・Java）は次の理由から非推奨。
- プラットフォーム依存のバイナリ
- コンパイルの必要性
- 配布の複雑さ

コンパイル系ツールがどうしても必要な場合:
- 既存のシステムバイナリを使う（外部ツールとして宣言する）
- スクリプトベースの代替を用意する
- コンテナ化を検討する

### エージェント向けのスクリプト設計

スキルに同梱するスクリプトは非対話実行向けに設計する。要点は次のとおり。

- **対話プロンプトを出さない** — エージェントはTTYプロンプトに応答できない。入力はフラグ・環境変数・stdinで受ける
- **`--help`出力** — エージェントがインターフェースを学ぶ主手段。説明・フラグ・使用例を含める
- **役立つエラーメッセージ** — 何が起き、何を期待し、次に何を試すかを示す
- **構造化出力** — 自由形式よりJSON/CSV/TSVを優先。データはstdout、診断はstderrへ
- **冪等性** — エージェントは再試行しうる。「無ければ作成」は「重複で失敗」より安全
- **`--dry-run`フラグ** — 破壊的操作はプレビューを許す
- **意味のある終了コード** — 失敗種別ごとに異なるコードを使い`--help`に明記する
- **予測可能な出力量** — 既定で要約や妥当な上限を設け、大きな出力は`--offset`や`--output FILE`で対応する

詳細と例は[references/scripting-guide.md](references/scripting-guide.md)を参照する。

## 段階的開示の設計

スキルは3段階の読み込みでコンテキストを効率管理する。

1. **メタデータ**（name + description） - 常にコンテキスト内（約100語）
2. **SKILL.md本文** - スキル起動時（500行未満を推奨）
3. **同梱リソース** - AI Agentが必要に応じて

**SKILL.mdが500行に近づいたら:**
- 内容をreferences/へ分割する
- SKILL.mdから明確に参照する
- 各ファイルをいつ読むか説明する

**大きなスキルのパターン:**

```markdown
# Large Skill

## Quick Start
[必須ワークフロー]

## Feature Categories

- **Feature A**: See [references/feature-a.md](references/feature-a.md)
- **Feature B**: See [references/feature-b.md](references/feature-b.md)
- **API Reference**: See [references/api.md](references/api.md)
```

## スクリプトクイックリファレンス

| スクリプト | 目的 | 全使用法は`--help`参照 |
|---|---|---|
| `quick_validate.py` | SKILL.mdの構造と依存宣言を検証 | `uv run python scripts/quick_validate.py --help` |

新規スキルは [`templates/SKILL.md.template`](templates/SKILL.md.template) を読み、`{{SKILL_NAME}}`・`{{SKILL_TITLE}}` を置換してSKILL.mdを作る（生成スクリプトは持たない）。

**使用法の詳細:** [references/scripts-reference.md](references/scripts-reference.md)を参照する。

## ヘルプ

**詳細なワークフロー:** [references/step-by-step-guide.md](references/step-by-step-guide.md)を参照する。

**依存宣言:** [references/compatibility-guide.md](references/compatibility-guide.md)を参照する。

**スクリプトのパターン:** [references/scripting-guide.md](references/scripting-guide.md)を参照する。

**スクリプトのCLI使用法:** [references/scripts-reference.md](references/scripts-reference.md)を参照する。

**ワークフローのパターン:** [references/workflows.md](references/workflows.md)を参照する。

**出力パターン:** [references/output-patterns.md](references/output-patterns.md)を参照する。

**よくある問題:**
- 検証エラー → SKILL.mdのフロントマター形式と必須フィールドを確認する
- 依存宣言エラー → `compatibility`と`## Requirements`の両方があり、各定義ファイルにロックファイルが揃っているか確認する
- Pythonバージョンエラー → Python 3.11+を使う
- PyYAML不在 → `uv sync --frozen`を実行する（`pyproject.toml`で宣言済み）
- スクリプトのハング → 対話プロンプトを確認する。入力は全てフラグ・環境変数・stdinから受ける
- スキルが起動しない → descriptionがそのシナリオを覆っているか確認する
