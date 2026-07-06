---
name: show-backlog
description: backlogのGitHub Projectのアイテム一覧を表示する。リポジトリ・優先度・ステータス・粒度（SBI/PBI）・ラベルでフィルタでき、PBIを親、子SBIをネストしたツリー表示も可能。(1) バックログを見たいとき、(2) 「バックログを見せて」「タスク一覧を出して」と言われたとき、(3) 次に何をやるか決めたいときに使う。
compatibility: |
  Required: gh CLI (authenticated; scopes: project, repo), jq
  Requires bootstrap-backlog (config.toml).
---

# Show Backlog

backlogをフィルタ付きの表（またはPBIツリー）として描画する。読み取り専用。

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

## Workflow

### Step 1: 設定の読み込み

`${XDG_CONFIG_HOME:-$HOME/.config}/backlog/config.toml`を読む。必須: `github.owner`, `github.project_number`, 各フィールドID。無ければ中止し、`bootstrap-backlog`の実行を案内する。

### Step 2: フィルタの解釈

引数または対話で以下を受け付ける。

| フィルタ | 形式 | 意味 |
|---|---|---|
| `--project <owner/repo>` | 繰り返し可 | 組み込み`Repository`フィールドに完全一致（大文字・小文字を区別） |
| `--priority <op><N>` | 例: `<30`, `=50`, `>=60` | Priorityフィールドと比較 |
| `--label <name>` | 繰り返し可 | Issueラベルに一致（例: `type:bug`）。複数指定はAND |
| `--status <name>` | 繰り返し可 | Statusフィールドに一致 |
| `--type <sbi\|pbi>` | 単一 | Typeフィールドに一致 |
| `--pbi-tree` | フラグ | ツリー描画（PBI親 + SBI子） |
| `--limit <N>` | 単一 | 出力上限（デフォルト: 50） |

フィルタ未指定時のデフォルト: `--status Backlog --status Doing --limit 50`。

### Step 3: アイテムの取得

```bash
gh project item-list "$NUMBER" --owner "$OWNER" --format json --limit 500
```

フィルタはメモリ上で適用する（jq）。Priority昇順、次に作成日昇順でソートする。

#### ラベルの補完

`gh project item-list`の出力はIssueラベルを含まない場合がある。Cat（分類）列の表示と`--label`フィルタにはラベルの取得が要る。GraphQLのバッチクエリ、または対象を絞った`gh issue view <num> --repo <owner>/<repo> --json labels`で取得し、セッション内でキャッシュする。

分類の導出: `^type:(bug|feature|improvement|task)$`に一致する最初のラベル。無ければ`-`。

### Step 4: 描画

#### フラット（デフォルト）

```
| #    | T   | Cat   | Title                  | Repo            | Pri | Status   |
|------|-----|-------|------------------------|-----------------|-----|----------|
| #42  | sbi | task  | Aerospace 設定見直し    | cffnpwr/dotfiles| 50  | Doing    |
| #43  | pbi | feat  | 認証MVP                | cffnpwr/webapp  | 60  | Backlog  |
```

`#`はIssue番号。`T` = 粒度（sbi/pbi）。`Cat` = `type:*`ラベル由来の分類（`task`・`bug`・`feat`・`impr`。複数あれば最初、無ければ`-`）。空フィールドは`-`。

#### ツリー（`--pbi-tree`指定時）

```
| #    | T   | Title                  | Repo            | Pri | Status   |
|------|-----|------------------------|-----------------|-----|----------|
| #43  | pbi | 認証MVP                | cffnpwr/webapp  | 60  | Backlog  |
|  ↳#44| sbi |   ログイン画面実装      | cffnpwr/webapp  | -   | Done     |
|  ↳#45| sbi |   セッション管理        | cffnpwr/webapp  | -   | Backlog  |
| #46  | sbi | typo fix               | cffnpwr/dotfiles| 30  | Backlog  |
```

子は`↳`でインデントし、親のPriorityを継承する。親子関係はGraphQLのsub-issuesで取得する。

```bash
gh api graphql -f query='
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        subIssues(first: 50) { nodes { id number title } }
      }
    }
  }
'
```

セッション内でキャッシュする。

### Step 5: サマリ行

表の後に表示する。

```
<N> items shown (<M> total in project, filtered to <N>).
By type: sbi=<X>, pbi=<Y>.
By status: Backlog=<A>, Doing=<B>, Done=<C>, Dropped=<D>.
By category: bug=<A>, feature=<B>, improvement=<C>, task=<D>, (untagged)=<E>
```

### 上限の扱い

フィルタ結果が`--limit`を超えたら末尾に付ける。

```
... and <N> more (use --limit to see more).
```

## Anti-patterns

- ❌ アイテムの状態を変更する — 本スキルは読み取り専用
- ❌ 不正に見えるフィルタを黙って解釈する（確認する）
- ❌ ツリーモードでPBIの子を親の外に描画する
- ❌ `--limit`を無視して全件描画する
