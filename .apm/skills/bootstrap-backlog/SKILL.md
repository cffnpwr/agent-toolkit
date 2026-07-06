---
name: bootstrap-backlog
description: backlogワークフロー（GitHub Projectによる個人タスク管理）の初期設定。GitHubのuser-level Project (v2)を新規作成または既存登録し、必須カスタムフィールド（Status / Type / Priority）を定義して、設定ファイルを書き出す。(1) backlogを初めてセットアップするとき、(2) 既存のbacklog設定を再構成したいとき、(3) 「bootstrap backlog」「backlogを初期化」と言われたときに使う。
disable-model-invocation: true
compatibility: |
  Required: gh CLI (authenticated; scopes: project, repo, read:user), jq
  No language runtime required. All logic is in the SKILL itself; no scripts.
---

# Bootstrap Backlog

backlog系スキル（create-backlog-item / show-backlog / register-project）の初期設定。環境ごとに1回、または再構成したいときに実行する。

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

認証スコープを次のコマンドで確認する。

```sh
gh auth status --hostname github.com
```

`project`・`repo`・`read:user`が揃っていなければ、ユーザーに次を案内して停止する。

> 必要なスコープが不足している。以下を実行してから再度起動してほしい。
>
> ```
> gh auth refresh -s project,repo,read:user
> ```

## Workflow

### Step 1: 既存設定の確認

`${XDG_CONFIG_HOME:-$HOME/.config}/backlog/config.toml`の有無を確認する。

存在しない場合は新規セットアップへ進む。存在する場合は現在の値を表示して尋ねる。

> 既存の設定がある。上書きしてよいか？

noなら何も変更せず終了する。

### Step 2: 入力の収集（1往復）

ユーザーに**1つのメッセージで**まとめて尋ねる。

> 以下を回答してほしい。デフォルト値はない、すべて指定が必要。
>
> 1. GitHubのowner（user名 or organization名）
> 2. Project: 既存のProjectを使う / 新規作成
>    - 既存の場合: Project number
>    - 新規の場合: Projectの名前

### Step 3: Projectのセットアップ

#### 既存Projectを使う場合

```bash
gh project view "$NUMBER" --owner "$OWNER" --format json
```

`id`（`PVT_...`）・`number`・`title`を控える。存在しない・アクセスできない場合はエラーを示して停止する。

#### 新規作成の場合

```bash
gh project create --owner "$OWNER" --title "$TITLE" --format json
```

`id`・`number`・`url`を控え、URLをユーザーに報告する。

### Step 4: フィールドの定義

必須フィールドは次の3つ。

| Name | Type | Options |
|---|---|---|
| Status | SINGLE_SELECT | Backlog, Doing, Done, Dropped |
| Type | SINGLE_SELECT | sbi, pbi |
| Priority | NUMBER | (none) |

`gh project field-list "$NUMBER" --owner "$OWNER" --format json`で既存フィールドを確認し、無いものだけを作成する。

```bash
gh project field-create "$NUMBER" \
  --owner "$OWNER" \
  --name "$NAME" \
  --data-type "$TYPE" \
  [--single-select-options "$OPT1,$OPT2,..."]
```

既存のSINGLE_SELECTフィールドのオプション構成が期待と異なる場合でも、オプションを`updateProjectV2Field`で更新してはならない。オプションIDが全件再発行され、**全アイテムのそのフィールド値が消える**（実挙動として確認済み）。この場合は停止する。対処（手動での値退避・移行）はユーザーと相談して決める。

型の異なるフィールドが既にある場合も停止し、手動での削除を依頼する。

作成後、`field-list`を再実行して各フィールドの`id`と（SINGLE_SELECTは）オプションIDを控える。

組み込みの`Repository`フィールドはIssue追加時に自動で入るため、設定不要。

### Step 5: config.tomlの書き出し

```bash
mkdir -p "${XDG_CONFIG_HOME:-$HOME/.config}/backlog"
```

次のスキーマで書き、`chmod 600`する。

```toml
[github]
owner = "<owner>"
project_number = <N>
project_id = "PVT_..."

[github.fields.status]
id = "PVTSSF_..."
options = { backlog = "<id>", doing = "<id>", done = "<id>", dropped = "<id>" }

[github.fields.type]
id = "PVTSSF_..."
options = { sbi = "<id>", pbi = "<id>" }

[github.fields.priority]
id = "PVTF_..."
```

### Step 6: 報告

```
Backlog setup complete.
- Project: <owner>/<project-number> (<url>)
- Config: ${XDG_CONFIG_HOME:-$HOME/.config}/backlog/config.toml
- Fields: Status, Type, Priority
```

後続スキル（create-backlog-item等）を自動で実行しない。

## Anti-patterns

- ❌ ユーザー入力にデフォルト値を使う
- ❌ 認証スコープ不足のまま続行する
- ❌ 既存configを確認なしで上書きする
- ❌ 既存SINGLE_SELECTフィールドのオプションを`updateProjectV2Field`で書き換える（全アイテムの値が消える）
