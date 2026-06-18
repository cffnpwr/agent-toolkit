---
name: agents-md-creator
description: AIエージェント向け指示ファイル（AGENTS.md）を新規作成・改善する。ユーザーが「AGENTS.mdを作って/改善して」「グローバルのAGENTS.mdを整備して」「ユーザーレベルのエージェント指示を作って」のように作成・改善を明示的に依頼した時のみ起動する（不在検知での能動提案はしない）。対象は「リポジトリルートのAGENTS.md」と「グローバル（ユーザーレベル・全プロジェクト共通）のAGENTS.md」の2モードで、起動時に依頼の意図から判定し（曖昧なら確認）分岐する。新規作成と、既存AGENTS.md・CLAUDE.mdの監査改善の両方に対応する。
---

# AGENTS.md Creator

AGENTS.md（AIエージェント向けプロジェクト指示ファイル）の新規作成・改善を行うスキル。リポジトリルートとグローバル（ユーザーレベル）の2モードに対応する。

## 起動条件とモード判定

- 起動するのは、ユーザーがAGENTS.mdの**作成または改善を明示的に依頼した時のみ**。AGENTS.md不在の検知などによる能動提案はしない。
- 着手時にまず**モードを判定**する。判定は表現の有無でなく**対象の配置がどこか**の意図で行う。
  - 対象が**ユーザーレベル**（全プロジェクト共通。「グローバル」「ユーザーレベル」「全プロジェクトで」等の意図）なら**グローバルモード**。
  - 対象が**特定リポジトリ**（「このリポジトリ／このプロジェクト」等）なら**リポジトリモード**。`~/.claude` 等への言及があっても、「~/.claude を参考にこのリポジトリのAGENTS.mdを作る」のようにリポジトリ対象の文脈なら、その言及単独でグローバルと確定しない。
  - どちらとも取れる場合は**ユーザーに確認する**（推測で決めない）。
- モードごとに対象範囲・収集方法・推奨骨格・配置先・symlink扱いが異なる。共通原則は「基本原則」を参照。

### モードの対象範囲

- **リポジトリモード**: リポジトリルートのAGENTS.md 1枚のみ。モノレポのサブディレクトリ別ネストAGENTS.mdは対象外。
- **グローバルモード**: ツール中立な実体ファイル（ユーザーレベル・全プロジェクト共通のAGENTS.md）1枚を中心に、各ツールのネイティブ設定をsymlinkで一本化する。

## 2つのユースケース（両モード共通）

1. **新規作成**: AGENTS.mdが存在しない状態でゼロから生成する。
2. **改善**: 既存のAGENTS.md（またはCLAUDE.md等のネイティブ設定）を監査して差分提案する。

着手時に対象のAGENTS.mdの有無を確認し、どちらのユースケースかを判定する。AGENTS.mdが無くネイティブ設定（CLAUDE.md等）がある場合は、ユーザーの依頼内容（新規か改善か）に従う。依頼が新規/改善のいずれとも判別できない場合は**ユーザーに確認する**（推測で決めない）。

## 基本原則（両モード共通）

### 記述言語

生成・改善するAGENTS.mdおよび `docs` 配下の**記述言語はユーザーの使用言語に合わせる**（固定の英語にしない）。やり取りしている言語をそのまま使う。

### 推奨骨格 + 適応

推奨セクション群を骨格としつつ、**該当しないセクションは出さない**。空セクションや「なし」を残してはならない。
推奨骨格の定義はモードで異なる。

- リポジトリモード: [recommended-skeleton.md](references/recommended-skeleton.md)
- グローバルモード: [global-recommended-skeleton.md](references/global-recommended-skeleton.md)

### 段階的開示

- **AGENTS.md本体** = どのタスクでも**常時適用される**原則・規約・禁止事項・選好。
- **`docs/`** = 特定タスク時のみ必要な詳細手順・具体例・状況依存ガイド。

「常に読むべきか」の単一軸で振り分ける。常時適用なら本体、特定タスク時のみなら `docs`。
切り出し先はモードで異なる（リポジトリモードは `.agents/docs/`、グローバルモードは実体ファイルと同階層の `docs/`）。
具体的な判定基準は [progressive-disclosure.md](references/progressive-disclosure.md) をLOADして従う。

### 参照方式

本体から `docs` への誘導は、**デフォルトではプレーン参照**で行う（必要時にエージェントが読む段階的開示のため）。
**Markdownリンク形式 `[詳細なビルド手順](.agents/docs/build.md)` を推奨**する（クリック可能で辿れ、リンク切れも見つけやすい）。素のパス記述も許容するが推奨はMarkdownリンク（素のパス記述は [check_references.sh](scripts/check_references.sh) の検出対象外。手動確認する）。

`@`参照は禁止ではない。その内容を**どのタスクでも常時コンテキストに読み込ませたい**設計意図がある場合は使ってよい。

- 必要時のみ読めばよい情報 → プレーン参照（段階的開示）。
- どのタスクでも常にコンテキストに載せたい情報 → `@`参照も可。

なお `@`参照の自動展開対応はツールにより異なり、Claude以外のエージェントでは無効になりうる点に留意する。
参照方式・段階的開示の規範は [progressive-disclosure.md](references/progressive-disclosure.md) を単一の出典とする（重複記述のドリフトを避けるため、方針変更時はそこを起点に更新する）。

## リポジトリモード

### 内容収集（ハイブリッド方式）

最初から全項目を質問攻めにしない。

1. まずリポジトリを解析し、**コードから読み取れる事実**で下書きを作る（ビルド・テスト・lintコマンド、ディレクトリ構成、使用言語・フレームワーク、既存の規約）。
2. **コードから読み取れない意図だけ**をユーザーに確認する（設計方針、優先順位、禁止事項など）。

解析の具体的な観点・手順は [content-gathering.md](references/content-gathering.md) をLOADして従う。

### エントリポイント（CLAUDE.md symlink）

- AGENTS.mdは**実体ファイル**として生成する。CLAUDE.md symlinkは常時生成しない。
- 実行中のエージェントが**自身をClaudeと認識している場合のみ**、CLAUDE.md → AGENTS.md のsymlink作成をユーザーに提案する。
  判定基準と手順は [claude-md-entrypoint.md](references/claude-md-entrypoint.md) をLOADして従う。

### ワークフロー: 新規作成

1. ルートに `AGENTS.md` が無いことを確認する。
2. [content-gathering.md](references/content-gathering.md) をLOADし、リポジトリを解析してコードから読み取れる事実を収集する。
3. [recommended-skeleton.md](references/recommended-skeleton.md) をLOADし、該当するセクションだけで下書きを構成する。コードから読めない意図をユーザーに確認する。
4. [progressive-disclosure.md](references/progressive-disclosure.md) をLOADし、常時適用でない詳細を `.agents/docs/` に切り出す。本体からはプレーン参照で誘導する。
5. [AGENTS.md.template](templates/AGENTS.md.template)（リポジトリ専用）を雛形に、ルートへ `AGENTS.md`、詳細があれば `.agents/docs/*.md` を生成する。記述言語はユーザーの使用言語。
6. [claude-md-entrypoint.md](references/claude-md-entrypoint.md) をLOADし、CLAUDE.md symlink提案の要否を判定する。
7. 検証（「検証」を参照）。

### ワークフロー: 改善

1. 既存の `AGENTS.md`（無ければ `CLAUDE.md`）を読む。
2. [rubric-audit.md](references/rubric-audit.md) をLOADし、ルーブリックに沿って監査する。
3. ドリフト検知のため [content-gathering.md](references/content-gathering.md) をLOADしてリポジトリ実態を解析し、既存記述と突き合わせる。
4. 監査結果を**差分提案**としてユーザーに提示する。コードから読めない意図に関わる部分はユーザーに確認する。
5. 合意した修正を適用する。本体肥大化の解消で `.agents/docs` へ切り出す場合は [progressive-disclosure.md](references/progressive-disclosure.md) の基準に従う。
6. 検証（「検証」を参照）。

## グローバルモード

### 対象・配置・ツール検出

ツール中立な実体ファイル（AGENTS.md）1枚を中心に、各ツールのネイティブ設定をsymlinkで一本化する。実体ファイルの配置先（既定 `~/.config/agents/AGENTS.md`、dotfiles管理時はそのリポジトリ内）、ツール検出、symlink提案ポリシー（保守的＝実行エージェントのツールのみ）の詳細は [global-entrypoint.md](references/global-entrypoint.md) をLOADして従う。

### 内容収集（面談駆動）

グローバル設定は大半がコードから読めないユーザーの選好。**面談で収集する**のが基本で、既存グローバル設定・環境事実があれば補助的に取り込む。手順は [global-content-gathering.md](references/global-content-gathering.md) をLOADして従う。

### ワークフロー: 新規作成

1. [global-entrypoint.md](references/global-entrypoint.md) をLOADし、ツールを検出して実体のAGENTS.mdの配置先を決定する（dotfiles管理を考慮、曖昧ならユーザー確認）。実体ファイルが無いことを確認する。
2. [global-content-gathering.md](references/global-content-gathering.md) をLOADし、既存設定・環境を補助的に読み、面談で選好を収集する。
3. [global-recommended-skeleton.md](references/global-recommended-skeleton.md) をLOADし、該当するセクションだけで下書きを構成する。
4. [progressive-disclosure.md](references/progressive-disclosure.md) をLOADし、常時適用でない詳細を実体ファイルと同階層の `docs/` に切り出す。本体からはプレーン参照で誘導する。
5. [global-AGENTS.md.template](templates/global-AGENTS.md.template) を雛形に、配置先へ実体ファイル `AGENTS.md`、詳細があれば `docs/*.md` を生成する。記述言語はユーザーの使用言語。
6. [global-entrypoint.md](references/global-entrypoint.md) のsymlink提案ポリシーに従い、実行エージェントのツール設定（例: `~/.claude/CLAUDE.md`）を実体ファイルへsymlink化する提案の要否を判定する。実体ファイルは単独ではどのツールも読まないため、**実体ファイルへ到達するsymlinkが最低1つ存在する**ことを完了条件とする。提案が断られ到達経路が無い場合は死蔵状態をユーザーに明示する。
7. 検証（「検証」を参照）。

### ワークフロー: 改善

1. [global-entrypoint.md](references/global-entrypoint.md) をLOADし、ツールを検出して実体ファイル・ネイティブ設定の所在（symlinkの解決を含む）を把握する。既存の実体ファイル（無ければネイティブ設定）を読む。
2. [global-rubric-audit.md](references/global-rubric-audit.md) をLOADし、ルーブリックに沿って監査する。
3. 環境・ツールとの整合性検知のため [global-content-gathering.md](references/global-content-gathering.md) のステップ1で環境を読み取り、既存記述と突き合わせる。
4. 監査結果を**差分提案**としてユーザーに提示する。コードから読めない意図に関わる部分はユーザーに確認する。
5. 合意した修正を適用する。本体肥大化の解消で `docs` へ切り出す場合は [progressive-disclosure.md](references/progressive-disclosure.md) の基準に従う。
6. 検証（「検証」を参照）。

## 検証

生成・改善後、以下を確認する。

- 本体内のプレーン参照（`docs/*.md` へのリンク・記述）の参照先ファイルが実在するか（参照切れがないか）。
- 本体に `@`参照がある場合、それが「常時コンテキストに読み込ませたい」という設計意図に沿った意図的なものか（意図しない混入でないか）。
- 空セクションや「なし」だけのセクションが残っていないか。
- 本体が常時適用の情報だけで構成され、肥大化していないか。
- （グローバルモード）symlink構成が正しいか（ネイティブ設定が実体ファイルへの正しいsymlinkになっているか、実体コピーの二重管理・二重symlinkになっていないか）。
- （グローバルモード）実体ファイルへ到達するsymlinkが最低1つ存在するか（無ければどのツールも実体ファイルを読まない死蔵状態。ユーザーに明示）。

参照切れチェックを反復的・機械的に行いたい場合は [check_references.sh](scripts/check_references.sh) を実行してよい（任意。手動確認でも可。グローバルモードでは実体のAGENTS.mdのパスを渡す）。
