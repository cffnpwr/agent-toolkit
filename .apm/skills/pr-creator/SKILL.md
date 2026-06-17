---
name: pr-creator
description: GitHub/GitLabのPull Request（Merge Request）を一貫した形式・差分重視で作成する。ユーザーが「PRを作って」「プルリクを出して」「MRを作成して」「PR出して」のように作成を明示的に依頼した時に起動する。git remoteからプラットフォーム（GitHub/GitLab）を検出し、プロジェクトのPRテンプレートがあれば優先、無ければ同梱デフォルトを使う。コミット差分から「何を変更し（What）・なぜ変更し（Why）・どんな影響が出るか（Impact）」を組み立て、途中経路（試行錯誤・デバッグ過程）は書かない。差分から読めない動機・背景はユーザーに確認し、推測で埋めない。作成前に必ずドラフトを提示して承認を得る。
compatibility: |
  Required: gh CLI (GitHub), glab CLI (GitLab), git
  No language runtime required. All logic is in the SKILL itself; no scripts.
---

# PR Creator

GitHub/GitLab上にPull Request（GitLabではMerge Request）を、一貫した形式・差分重視で作成するスキル。

## Requirements

使用前に以下の依存を確認すること。ひとつでも欠けていれば進行を停止し、ユーザーへエスカレーションする。Agentは導入・修正・フォールバックを行わない。

### 外部ツール

| ツール | バージョン要件 |
| --- | --- |
| git | `>= 2.0` |
| gh | `>= 2.0`（GitHubの場合） |
| glab | `>= 1.0`（GitLabの場合） |

存在確認コマンドを次に示す。

```sh
command -v git >/dev/null 2>&1 || { echo "git not found." >&2; exit 1; }
# GitHubなら
command -v gh  >/dev/null 2>&1 || { echo "gh not found." >&2; exit 1; }
# GitLabなら
command -v glab >/dev/null 2>&1 || { echo "glab not found." >&2; exit 1; }
```

## 中核原則

1. **差分重視。** PR本文は「何を変更したか（What）」「なぜ変更したか（Why）」「どんな影響が出るか（Impact）」に重点を置く。大切なのは変更前後の差分であり、途中でどんな問題が起きどう解決したかの経路（試行錯誤・撤回した実装・デバッグ過程）は書かない。熱力学の状態量に似て、終状態だけが要る。
2. **事実を捏造しない。** 差分・コード・ユーザー入力から得られない情報は書かない。「おそらく」「たぶん」で埋めない。不確実な点は `[要確認]` を付けてユーザーに上げる。
3. **まず差分とコードを読む。** ユーザーに聞く前に、コミット差分・変更ファイル・コミットメッセージ・関連コードから埋められるものを埋める。
4. **ユーザーにしか分からないことは聞く。** 変更の動機・背景、レビュー時の注意点、破壊的変更を意図したか否か、優先度など、差分から読めないものはユーザーに確認する。質問は1回にまとめる。
5. **テンプレートに忠実。** プロジェクトのPRテンプレートがあれば、その節構成・見出し・順序を厳密に踏襲する。節の省略・追加・改名・並べ替えをしない。
6. **タイトルはConventional Commit形式で1行。** 変更の要点を1行で表す。1行で表現できない・抽象的になりすぎる場合は、PRのスコープが過大なので分割を提案する。
7. **承認後は一気通貫。** ドラフトをユーザーが承認したら、追加確認（ラベル・ベースブランチ等）を挟まず作成まで進め、結果のURLを報告する。

## ワークフロー

### Step 1: プラットフォームとリポジトリ文脈の検出

```bash
git remote get-url origin
```

リモートURLからプラットフォームを判定する。

- `github.com` を含む → GitHub（`gh` CLI）
- `gitlab.` を含む（任意のホスト）→ GitLab（`glab` CLI）
- それ以外 → ユーザーにプラットフォームを確認

CLIの使い方とプラットフォーム固有の差異は [references/platform-detection.md](references/platform-detection.md) を参照する。

### Step 2: ベースブランチとheadの確定

- どのブランチへマージするか（base、通常は `main`）と、どのブランチ/changeから出すか（head）を確定する。
- 不明なら、デフォルトブランチをbaseとして提示し確認する。

### Step 3: 差分の把握

リポジトリルートに `.jj` があれば `jj`、無ければ `git` で差分とコミット履歴を取る。

```bash
# jj管理リポジトリ
jj log -r "main..@"          # コミット一覧
jj diff -r "main..@"         # 累積差分

# git管理リポジトリ
git log --oneline main..HEAD
git diff main...HEAD
```

コミットメッセージ群から変更の意図を読み取る。変更ファイルから影響範囲を推定する。

### Step 4: プロジェクトPRテンプレートの確認

プロジェクトのテンプレートを同梱デフォルトより優先する。

**GitHub:**
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/PULL_REQUEST_TEMPLATE/*.md`（複数テンプレート）
- `.github/pull_request_template.md`

**GitLab:**
- `.gitlab/merge_request_templates/*.md`

複数該当する場合、変更内容に最も合うものを選ぶ。迷えばユーザーに確認する。プロジェクトテンプレートが無ければ同梱の [templates/default.md](templates/default.md) を使う。

**選んだテンプレートは全文を読んでから書く。** 記憶の「典型的なPRテンプレート」で書かない。見出し・順序・各節のルールを抽出し、ドラフトはそれを厳密に反映する。

### Step 5: 不足情報の特定とユーザーへの確認

テンプレートの節ごとに、差分から埋まるか・ユーザーが既に提供したか・聞く必要があるかを切り分ける。

**差分・コードから埋める:**
- 変更内容（What）
- 影響範囲（変更ファイル・公開APIの変化から）
- 関連Issue（コミットメッセージの `#123` や `Closes #123` から）

**ユーザーに聞く（差分から読めない）:**
- 変更の動機・背景（Why）
- レビュー時に特に見てほしい点
- 破壊的変更や移行手順の有無を意図したか

質問は1回にまとめて提示する。

### Step 6: PR本文のドラフト

選んだテンプレートに沿って、収集した情報で本文を組み立てる。

- **What/Why/Impact** を差分に基づいて記述する。
- **途中経路を書かない。** 「最初はAを試したがダメでBにした」「デバッグでCに気づいた」等の経路は本文に含めない。最終的な変更内容・理由・影響だけを書く。
- **コードブロック**: エラーメッセージ・コマンド・コードはフェンスで言語ヒント付きに。
- **機密情報**: トークン・認証情報・内部ホスト名・個人パスは `[TOKEN]` `[INTERNAL_HOST]` 等のプレースホルダに置換する。
- **言語**: リポジトリの既存PR/Issueの言語に合わせる。不明ならユーザーの入力言語に合わせる。

### Step 7: 確認と作成

ドラフトを**1回だけ**提示し、ユーザーが判断に必要な情報を全て含める。

> 以下の内容でPRを作成する。問題なければ「OK」、修正が必要なら指摘してほしい。
>
> - base: main ← head: feature/xxx
> - タイトル: TITLE
> - ラベル: [一覧、なしなら「なし」]
>
> ---
> (本文)

承認（「OK」「はい」等）後は、追加の質問・確認を挟まず以下を一連で実行する。

1. 本文を一時ファイル（`/tmp/pr-body.md` 等）に書く。
2. 作成コマンドを実行する。
3. URLを報告する。

**GitHub:**
```bash
gh pr create \
  --base main \
  --head feature/xxx \
  --title "TITLE" \
  --body-file /tmp/pr-body.md \
  --label "enhancement"   # 該当する場合
```

**GitLab:**
```bash
glab mr create \
  --source-branch feature/xxx \
  --target-branch main \
  --title "TITLE" \
  --description "$(cat /tmp/pr-body.md)" \
  --label "enhancement"   # 該当する場合
```

インライン `--body` ではなく `--body-file`（GitHub）/ ファイル経由（GitLab）を使い、整形とシェルエスケープの問題を避ける。

修正依頼の場合は、修正を反映して再度1回の確認形式で提示する。

## アンチパターン

このスキルがしてはいけないこと。

- ❌ 途中経路（「最初はXしたがダメでYにした」「デバッグでZと判明」）を本文に書く
- ❌ 差分から読めない変更理由・影響を捏造する
- ❌ テンプレートの見出しを改変・省略・追加・並べ替えする
- ❌ ユーザーの承認前にPRを作成する
- ❌ 1行で表現できない巨大PRをそのまま作る（スコープ過大として分割を提案する）
- ❌ 承認後に「ラベルはこれでよいか？」と追加確認で止まる
- ❌ 外部ツールを勝手にインストールする

## Examples

### 例1: バグ修正のPR

1. `git remote` → GitHub `acme/web`。
2. base=main、head=現在のブランチを確定。
3. `jj diff -r "main..@"` で差分把握。`src/auth.ts` の null チェック追加と判明。
4. `.github/PULL_REQUEST_TEMPLATE.md` を確認 → 無し → `templates/default.md` を全文読む。
5. ユーザーに確認: 「この変更の動機（報告されたバグか・自発的修正か）と、レビューで特に見てほしい点はあるか」。
6. What（null チェック追加）/Why（ユーザー回答）/Impact（認証フローのみ、破壊的変更なし）でドラフト。途中経路は書かない。
7. base/head/タイトル/ラベル/本文を1回提示 → 「OK」 → `gh pr create` → URL報告。

### 例2: リファクタのPR

1. GitLab検出。
2. `jj log -r "main..@"` で複数コミットの意図を読む。
3. プロジェクトの `.gitlab/merge_request_templates/refactor.md` を優先、全文を読む。
4. 影響範囲（公開APIの変化の有無）を差分から確認。
5. ユーザーに動機（保守性・性能のどちらが主目的か）を確認。
6. テンプレート見出しに厳密に従ってドラフト。
7. 1回確認 → 承認 → `glab mr create` → URL報告。
