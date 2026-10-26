# プラットフォーム検出とCLIの差異

PR（Merge Request）作成におけるGitHub/GitLabの検出方法と、CLIの差異をまとめる。

## 検出

```bash
git remote get-url origin
```

| リモートURLに含まれる文字列 | プラットフォーム | CLI |
| --- | --- | --- |
| `github.com` | GitHub | `gh` |
| `gitlab.`（任意のホスト、self-hosted含む） | GitLab | `glab` |
| 上記以外 | 不明 | ユーザーに確認 |

複数リモートがある場合は`origin`を基準とする。
`origin`が無ければユーザーに確認する。

## 用語の対応

| 概念 | GitHub | GitLab |
| --- | --- | --- |
| 変更提案 | Pull Request (PR) | Merge Request (MR) |
| マージ先 | base branch | target branch |
| マージ元 | head branch | source branch |
| テンプレート配置 | `.github/PULL_REQUEST_TEMPLATE.md`等 | `.gitlab/merge_request_templates/*.md` |

## 作成コマンドの差異

GitHub（gh）では次のコマンドを使う。

```bash
gh pr create \
  --base <target> \
  --head <source> \
  --title "<title>" \
  --body-file <path> \
  --label "<label>"
```

GitLab（glab）では次のコマンドを使う。

```bash
glab mr create \
  --target-branch <target> \
  --source-branch <source> \
  --title "<title>" \
  --description "$(cat <path>)" \
  --label "<label>"
```

- GitHubは`--body-file`でファイルから本文を読める。GitLabの`glab mr create`は`--description`で本文を文字列として受け取るため、コマンド置換でファイルの内容を渡す
- ドラフトPR/MRにする場合: GitHubは`--draft`、GitLabは`--draft`
- headのブランチをpushしていない場合は、作成の前にpushが必要になる場合がある（`gh`・`glab`がpushを求めるメッセージを表示する）
