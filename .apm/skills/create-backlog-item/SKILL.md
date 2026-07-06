---
name: create-backlog-item
description: backlogのGitHub Projectに新しいバックログアイテム（SBI/PBI）を追加する。分類別テンプレートに沿ったIssueを対象リポジトリに作成し、Projectに登録してStatus / Type / Priorityを設定する。作業量が大きい・自然に分解できる場合はPBIとして子SBIに分割する。(1) バックログにアイテムを追加したいとき、(2) 「バックログに追加」「Issueを作って積んでおいて」と言われたとき、(3) 新しい作業をタスクとして記録したいときに使う。
compatibility: |
  Required: gh CLI (authenticated; scopes: project, repo), jq
  Requires bootstrap-backlog (config.toml).
---

# Create Backlog Item

Issueを作成し、backlogのProjectに必須フィールドを設定して登録する。

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

`${XDG_CONFIG_HOME:-$HOME/.config}/backlog/config.toml`を読む。必須キーは次のとおり。

- `github.owner`, `github.project_number`, `github.project_id`
- `github.fields.{status,type,priority}.id`とstatus / typeのオプションID

configが無ければ中止し、`bootstrap-backlog`の実行を案内する。

### Step 2: 入力の収集（1往復）

ユーザーに**1つのメッセージで**まとめて尋ねる。

> 以下を回答してほしい。
>
> 1. タイトル（72文字以内推奨）
> 2. 分類: bug / feature / improvement / task（迷ったら task）
> 3. 粒度: sbi / pbi（迷ったら sbi。複数サブタスクに分解できそうなら pbi）
> 4. 対象リポジトリ: `<owner>/<repo>`形式で指定（過去使用したリポジトリの一覧は後述。`type:*`ラベルが未整備の場合は確認のうえ整備する）
> 5. Priority: 0--100の整数（小さいほど高優先度。デフォルト値は設けない — 必ず帯を判断する。帯の目安は`references/priority-guide.md`）
> 6. テンプレートに沿った本文情報（後述、分類により異なる）

(4)のヒント一覧は、Projectの既存アイテムから導出する。

```bash
gh project item-list "$PROJECT_NUMBER" --owner "$OWNER" --format json --limit 500 \
  | jq -r '.items[].content.repository' \
  | sort -u
```

一覧は情報提供のみで、任意の`<owner>/<repo>`を受け付ける（「登録済み」によるゲートは無い）。

(5)のPriorityは`references/priority-guide.md`を読み、帯（分類と期日）で決める。

(6)は選ばれた分類のテンプレート（Step 5）を読み、定義されたセクションごとに入力を求める。Acceptance Criteriaは全分類で必須。

### Step 2.5: 対象リポジトリの`type:*`ラベル確認

Issue作成前に、4つの正準`type:*`ラベルが揃っているか確認する。

```bash
gh label list --repo "$OWNER/$REPO" --json name --jq '[.[].name] | map(select(startswith("type:"))) | sort'
```

`type:bug`・`type:feature`・`type:improvement`・`type:task`が揃っていればStep 3へ。

揃っていなければ、ここで直接ラベルを作らず`register-project`をインラインで起動する。

> `<owner>/<repo>`に`type:*`ラベルが揃っていない。`register-project`を実行してラベルを整備する。

`register-project`自身が差分を提示して明示的な承認を得る — 代理で事前承認しない。ユーザーが承認を拒否したら本スキルも中止する。成功したらStep 3へ、エラーならエラーを示して停止する。

### Step 3: 入力の検証

- タイトル: 非空、200文字以下
- 分類: `bug` / `feature` / `improvement` / `task`のいずれか
- 粒度: `sbi`または`pbi`
- リポジトリ: `^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$`に一致
- Priority: `0..100`の整数（帯の判断は`references/priority-guide.md`）
- Acceptance Criteria: 非空行が1つ以上
- 分類ごとの必須セクション（テンプレートのSection Rules参照）がすべて埋まっている

失敗したらどのフィールドかを報告して停止する。

### Step 4: PBIの子SBIフロー

PBIの場合、尋ねる。

> このPBIに紐づく子SBIを今、追加で作成するか？（PBIだけ作って後で子を追加することも可能）

yesなら、PBI作成後、子SBIごとにStep 2へ戻る（type=sbi固定、sub-issueでのリンクを提案）。

### Step 5: テンプレートの読み込み

分類に対応するテンプレート（本スキルディレクトリ基準）を読む。

| 分類 | テンプレート |
|---|---|
| `bug` | `references/templates/bug.md` |
| `feature` | `references/templates/feature.md` |
| `improvement` | `references/templates/improvement.md` |
| `task` | `references/templates/task.md` |

本文はテンプレートに**厳密に**従って組み立てる: 同じ見出し、同じ順序。各テンプレート末尾のSection Rulesが必須・任意と記載粒度を定める。任意セクションは内容が空なら見出しごと削除する（「なし」「N/A」と書かない）。

テンプレートはSBI・PBI共用。粒度はProjectのカスタムフィールドに記録し、Issue本文には書かない。内容の深さは粒度で変える。

- SBIは各セクションを簡潔に書く（1〜3行）
- PBIは特にBackground / Scope / Out of Scopeを厚めに書く

### Step 6: ドラフト確認

ドラフトを1回だけ提示する。

> 以下の内容でIssueを作成する。問題なければ「OK」と返答してほしい。修正があれば指摘してほしい。
>
> - リポジトリ: <owner>/<repo>
> - 分類: <category> (label: type:<category>)
> - 粒度: <sbi|pbi>
> - Priority: <N>
> - タイトル: <title>
>
> ---
> <full body>

明示的な承認後は、追加の確認なしで最後まで進める。

### Step 7: Issue作成

本文を一時ファイルに書き出す。

```bash
BODY_FILE=$(mktemp -t backlog-body.XXXXXX.md)
# 本文を "$BODY_FILE" に書く
```

`type:<category>`ラベル付きでIssueを作成する。

```bash
gh issue create \
  --repo "$OWNER/$REPO" \
  --title "$TITLE" \
  --body-file "$BODY_FILE" \
  --label "type:$CATEGORY"
```

ラベル不在で失敗した場合は`register-project`をインラインで起動して再試行する（ここで直接ラベルを作らない）。

Issue URLをstdoutから控える。sub-issueリンクに使うnode IDも取得する。

```bash
ISSUE_NODE_ID=$(gh issue view "$ISSUE_NUMBER" --repo "$OWNER/$REPO" --json id --jq .id)
```

一時ファイルを削除する。

### Step 8: Projectへの追加とフィールド設定

```bash
ITEM_ID=$(gh project item-add "$PROJECT_NUMBER" --owner "$OWNER" --url "$ISSUE_URL" --format json | jq -r .id)
```

組み込みの`Repository`フィールドは自動で入る。カスタムフィールドを設定する。

1. Status → `Backlog`
2. Type → `sbi`または`pbi`
3. Priority → 数値

```bash
# SINGLE_SELECT (Status / Type)
gh project item-edit --id "$ITEM_ID" --project-id "$PROJECT_ID" \
  --field-id "$FIELD_ID" --single-select-option-id "$OPTION_ID"

# NUMBER (Priority)
gh project item-edit --id "$ITEM_ID" --project-id "$PROJECT_ID" \
  --field-id "$FIELD_ID" --number "$PRIORITY"
```

いずれかの設定が失敗したら、どれかを報告して残りを続行する（Issue自体は存在するため、ズレは手動で修復できる）。

### Step 9: sub-issueリンク（該当時）

同一セッションで作成済みのPBIの子として作られたSBIはリンクする。

```bash
gh api graphql -f query='
  mutation($parentId: ID!, $childId: ID!) {
    addSubIssue(input: { issueId: $parentId, subIssueId: $childId }) {
      issue { number }
    }
  }
' -f parentId="$PARENT_NODE_ID" -f childId="$CHILD_NODE_ID"
```

`addSubIssue`が使えない場合のフォールバック: `gh issue edit`でSBI本文に`Parent: #<parent-number>`を追記する。可用性は初回にintrospectionで検出し、セッション内でキャッシュする。

### Step 10: 報告

```
Created: <type> #<number> "<title>"
Repo: <owner>/<repo>
Label: type:<category>
URL: <issue-url>
Project item: configured (Status=Backlog, Type=<type>, Priority=<N>)
[Sub-issue linked under #<parent-number>]
```

## Anti-patterns

- ❌ Acceptance Criteriaを省略する・空のまま通す
- ❌ `register-project`の承認を代理で済ませる（ユーザーが差分を見て承認する）
- ❌ `type:*`ラベルをインラインで直接作る（`register-project`の責務）
- ❌ テンプレートファイルを読まずに本文を書く
- ❌ テンプレートが定めるセクションを追加・削除する（空の任意セクションの省略を除く）
- ❌ 1対1のPBI/SBI構造を作る（PBIは子2つ以上、またはその計画があること）
- ❌ ドラフト承認後に追加の確認で止まる
- ❌ Issueに`type:<category>`ラベルを付け忘れる
- ❌ {bug, feature, improvement, task} 以外の分類を使う
