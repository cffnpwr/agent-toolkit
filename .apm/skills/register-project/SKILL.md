---
name: register-project
description: 対象リポジトリに正準の `type:*` Issueラベル4種を整備し、backlogアイテムを起票できるようにする。(1) 「register-project」「プロジェクトを登録」「<owner>/<repo>を登録」と明示的に依頼されたとき、(2) `create-backlog-item` が対象リポジトリのラベル不足を検知してインラインで起動するときに使う。変更前に必ず計画を提示して承認を得る。
compatibility: |
  Required: gh CLI (authenticated; scopes: project, repo), jq
  Requires bootstrap-backlog (config.toml).
---

# Register Project

GitHubリポジトリに正準の`type:*` Issueラベル4種を整備する。冪等: 不足しているラベルだけを作成する。

独立した「登録リポジトリ一覧」は持たない。Projectアイテムの組み込み`Repository`フィールドが、使用中リポジトリの正本である。

## Requirements

使用前に以下の依存を確認する。ひとつでも欠けていれば進行を停止し、ユーザーへエスカレーションする。Agentは導入・フォールバックを行わない。

### 外部ツール

| ツール | バージョン要件 |
| --- | --- |
| gh | `>= 2.0` |
| jq | `>= 1.6` |

存在確認コマンドを次に示す。

```sh
command -v gh >/dev/null 2>&1 || { echo "gh not found." >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "jq not found." >&2; exit 1; }
```

## 保守的な振る舞い

- 変更前に**必ず計画を提示し、明示的な承認を得る**。他スキルからインラインで起動された場合も素通りしない
- 変更が不要な場合（全ラベルが色・説明まで一致）は、その旨を報告して確認なしで終了する

## Workflow

### Step 1: 設定の読み込み

`${XDG_CONFIG_HOME:-$HOME/.config}/backlog/config.toml`を読む。必須: `github.owner`, `github.project_number`。無ければ中止する。

> backlogがセットアップされていない。先に`bootstrap-backlog`を実行してほしい。

### Step 2: 対象リポジトリの解決

引数があれば`<owner>/<repo>`として解釈する。無ければ尋ねる。

> 登録するリポジトリを`<owner>/<repo>`形式で指定してほしい。

形式検証: `^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$`。

### Step 3: リポジトリの存在確認

```bash
gh repo view "$OWNER/$REPO" --json nameWithOwner --jq .nameWithOwner
```

失敗したら中止する。

> リポジトリ`<owner>/<repo>`が存在しない、またはアクセス権限がない。指定を見直してほしい。

### Step 4: ラベル状態の差分

```bash
gh label list --repo "$OWNER/$REPO" --json name,color,description
```

正準ラベルセットと比較する。

| Label | Color (hex) | Description |
|---|---|---|
| `type:bug` | `d73a4a` | Bug report or fix |
| `type:feature` | `0e8a16` | New functionality |
| `type:improvement` | `a2eeef` | Enhancement to existing functionality |
| `type:task` | `c5def5` | Internal work (refactor, deps, docs, chore) |

各正準ラベルを分類する。

- **missing** — 存在しない。作成する
- **matches** — 色・説明まで一致。何もしない
- **diverges** — 色または説明が異なる。**上書きしない**（ユーザーがカスタマイズした可能性）。情報として報告のみ

4つすべて`matches`なら報告して確認なしで終了する。

> `<owner>/<repo>`の`type:*`ラベルは既に揃っている。何もしない。

### Step 5: 計画の承認

差分を提示して明示的な承認を得る。

```
<owner>/<repo> に以下の変更を加える:
  + 作成: <missing のラベル一覧、色付き>
  ~ 既存(変更しない): <diverges のラベル一覧、"color/description が canonical と異なる" 注記付き>

実行してよいか？(y/n)
```

明示的な`y` / `yes`のみで進む。それ以外（`n`・空・無関係な回答）は中止する。

> 中止した。何も変更していない。

### Step 6: 不足ラベルの作成

`missing`の各ラベルについて実行する。

```bash
gh label create "type:bug" \
  --repo "$OWNER/$REPO" \
  --color "d73a4a" \
  --description "Bug report or fix"
```

1つでも失敗したらエラーを示してループを止め、作成済み・未作成を報告する。

### Step 7: 報告

```
Registered: <owner>/<repo>
- Created: <created labels>
- Existing (matches): <matches labels>
- Existing (diverges, left alone): <diverges labels, 実際の色を添える>
```

## Anti-patterns

- ❌ Step 5の承認を飛ばす — インライン起動時も同様
- ❌ 色・説明が異なる既存ラベルを上書きする（`diverges`として放置）
- ❌「登録済みリポジトリ一覧」を別に管理する（Projectの`Repository`フィールドが正本）
- ❌ Projectのカスタムフィールドに触れる（本スキルはラベル専用）
- ❌ 正準セットに無いラベルを作る
