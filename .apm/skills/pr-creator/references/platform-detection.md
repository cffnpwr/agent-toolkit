# プラットフォーム検出とCLIの差異

PR（Merge Request）作成における GitHub / GitLab の検出方法と、CLIの差異をまとめる。

## 検出

```bash
git remote get-url origin
```

| リモートURLに含まれる文字列 | プラットフォーム | CLI |
| --- | --- | --- |
| `github.com` | GitHub | `gh` |
| `gitlab.`（任意のホスト、self-hosted含む） | GitLab | `glab` |
| 上記以外 | 不明 | ユーザーに確認 |

複数リモートがある場合は `origin` を基準とする。`origin` が無ければユーザーに確認する。

## 用語の対応

| 概念 | GitHub | GitLab |
| --- | --- | --- |
| 変更提案 | Pull Request (PR) | Merge Request (MR) |
| マージ先 | base branch | target branch |
| マージ元 | head branch | source branch |
| テンプレート配置 | `.github/PULL_REQUEST_TEMPLATE.md` 等 | `.gitlab/merge_request_templates/*.md` |

## 作成コマンドの差異

**GitHub（gh）:**
```bash
gh pr create \
  --base <target> \
  --head <source> \
  --title "<title>" \
  --body-file <path> \
  --label "<label>"
```

**GitLab（glab）:**
```bash
glab mr create \
  --target-branch <target> \
  --source-branch <source> \
  --title "<title>" \
  --description "$(cat <path>)" \
  --label "<label>"
```

- GitHubは `--body-file` でファイルから本文を読める。GitLabの `glab mr create` は `--description` に文字列を渡すため、ファイル内容を展開する。
- ドラフトPR/MRにする場合: GitHubは `--draft`、GitLabは `--draft`。
- 既存ブランチのpush状況により、作成前にpushが必要な場合がある（`gh`/`glab` が促す）。
