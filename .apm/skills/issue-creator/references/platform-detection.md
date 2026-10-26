# プラットフォームの検出とCLIのリファレンス

リポジトリからGitHub・GitLabを判定する方法と、各プラットフォームのCLIでIssueを作成する方法をまとめる。

## プラットフォームの検出

```bash
git remote get-url origin
```

URLを次のパターンと照合する。

| URLのパターン | プラットフォーム |
| --- | --- |
| `github.com` | GitHub |
| `gitlab.com` | GitLab.com |
| `gitlab.<company>.<tld>` | セルフホストのGitLab |
| `git@github.com:...` | GitHub（SSH） |
| `git@gitlab.<host>:...` | GitLab（SSH） |

リモートがどのパターンにも一致しない場合は、ユーザーにプラットフォームを確認する。

リポジトリに複数のリモート（`origin`・`upstream`等）がある場合は、`origin`を優先する。
ユーザーが別のリモートを明示した場合は、そのリモートを使う。

## OWNER/REPOの取得

GitHubでは次のコマンドを使う。

```bash
gh repo view --json nameWithOwner --jq .nameWithOwner
```

GitLabでは次のコマンドを使う。

```bash
glab repo view --output json | jq -r .path_with_namespace
```

CLIが認証されていない場合は、`git remote get-url origin`の結果を手作業で解析する。

- `https://github.com/owner/repo.git` → `owner/repo`
- `git@github.com:owner/repo.git` → `owner/repo`
- `https://gitlab.example.com/group/subgroup/repo.git` → `group/subgroup/repo`（GitLabはグループの入れ子に対応する）

## プロジェクトのテンプレートの確認

### GitHub

```bash
ls .github/ISSUE_TEMPLATE/ 2>/dev/null
ls .github/issue_template.md 2>/dev/null
```

GitHubは2種類のテンプレート形式に対応する。

- Markdown（`.md`）は、ユーザーがそのテンプレートで「New issue」を押したときに表示されるMarkdownの本文である
- Issue forms（`.yml`）は、型付きのフィールドを持つ構造化されたフォームである

選んだ種類に対応する`.yml`のIssue formsがある場合は、次のように扱う。

- フォームを読み、必要なフィールドを把握する
- フィールドに対応するMarkdownの本文を書く（`gh issue create --body-file`が書き込むのはフォームのデータではなくMarkdownであるため）
- Markdownの見出しは、フォームのフィールドのラベルと一致させる

### GitLab

```bash
ls .gitlab/issue_templates/ 2>/dev/null
```

GitLabが対応するテンプレートはMarkdownのみである。
ファイル名から`.md`を除いた文字列がテンプレート名になる。

## Issueの作成

### GitHub

シェルエスケープの問題を避けるため、本文を必ず先にファイルへ書き出す。

```bash
cat > /tmp/issue-body.md <<'EOF'
## 概要
...
EOF

gh issue create \
  --repo OWNER/REPO \
  --title "TITLE" \
  --body-file /tmp/issue-body.md
```

ユーザーが明示的に依頼した場合のみ、次のオプションを追加する。

- `--label LABEL`（複数指定する場合は繰り返す）
- `--assignee USERNAME`（または`@me`）
- `--milestone NUMBER`
- `--project PROJECT`

Issueの種類（Bug・Feature・Task）は、ラベルではなくOrganizationレベルのメタデータである。
`gh issue create`は`--type`に対応していないため、Issueの種類を設定する場合は`gh api`を使う。

```bash
gh api repos/OWNER/REPO/issues \
  -X POST \
  -f title="TITLE" \
  -f body="$(cat /tmp/issue-body.md)" \
  -f type="Bug" \
  --jq '{number, html_url}'
```

### GitLab

```bash
cat > /tmp/issue-body.md <<'EOF'
## 概要
...
EOF

glab issue create \
  --repo OWNER/REPO \
  --title "TITLE" \
  --description-file /tmp/issue-body.md
```

追加できるオプションを次に示す。

- `--label LABEL`（複数指定する場合はカンマ区切り: `--label "bug,priority/high"`）
- `--assignee USERNAME`
- `--milestone TITLE`
- `--confidential`（セキュリティのIssue用。ユーザーが依頼した場合のみ）

GitLabには、ラベルと区別された「Issueの種類」の概念が無い。
分類にはラベルを使う。

## 既存のIssueの検索

作成する前に、必ず重複を確認する。

### GitHub

```bash
gh issue list --repo OWNER/REPO --search "KEYWORDS" --state all --limit 10
```

クローズ済みのIssueも含めて全文を検索する場合は、`--state all`を使う。

### GitLab

```bash
glab issue list --repo OWNER/REPO --search "KEYWORDS" --all --per-page 10
```

重複が見つかった場合は、ユーザーに提示し、次のどれを選ぶか質問する。

1. 既存のIssueにコメントを追加する
2. それでも新しいIssueを作成する（既存のIssueへリンクする）
3. 作成を中止する

## 認証の失敗

`gh`・`glab`が認証エラーを返した場合は、次のコマンドでの認証をユーザーに依頼する。

- `gh auth login`
- `glab auth login`

環境変数のトークンを、ユーザーへ伝えずに使わない。
トークンを使う場合は、ユーザーがそのことを把握している必要がある。
