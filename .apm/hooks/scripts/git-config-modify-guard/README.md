# git-config-modify-guard

Coding Agentがgitの設定を変更するコマンドを実行する前に、ユーザーの承認を求めるhook。

## Requirements

- [Bun](https://bun.sh) 1.2以上

## 検知するコマンド

次のいずれかに当てはまるgitコマンドを検知する。

- 設定を書き換える`git config`（`git config set`・`git config user.name x`・`--unset`・`--edit`等）
- `-c`・`--config-env`でそのコマンドの設定を上書きする
- 前置代入で次の環境変数を設定する
  - `GIT_CONFIG_COUNT`・`GIT_CONFIG_KEY_<n>`・`GIT_CONFIG_VALUE_<n>`
  - `GIT_CONFIG_GLOBAL`・`GIT_CONFIG_SYSTEM`・`GIT_CONFIG_NOSYSTEM`

設定の名前は問わない。
設定を読むだけの呼び出し（`git config get`・`git config --list`等）は検知しない。
`&&`・`;`・パイプ・コマンド置換等でつないだコマンドも1つずつ判定する。

## harnessごとの動作

| harness | 検知したときの動作 |
| --- | --- |
| Claude Code | ユーザーに承認を求める |
| Codex | コマンドをブロックし、ユーザーに承認を求めるようCoding Agentに指示する |
| GitHub Copilot CLI（`.claude/settings.json`のhookとして実行した場合） | Codexと同じ |
| Antigravity CLI・Gemini CLI・OpenCode | 対象外 |

呼び出し元がClaude Codeかは、環境変数`CLAUDE_CODE_SESSION_ID`とhook入力の`session_id`が一致するかで判定する。
理由は[ADR 0008](../../../../docs/adr/0008-pretooluse-approval-by-harness-detection.md)を参照する。

## 承認後の再実行と無効化

Claude Code以外ではユーザーの承認を得た後に、Coding Agentが`GIT_CONFIG_MODIFY_GUARD_DISABLE=1`を付けてコマンドを再実行する。
Claude Codeではこの指定を無視して承認を求める。
hook全体を無効化する方法は用意していない。

## 注意事項

- 書き換えるかを静的に決められない呼び出し（`git config $SUB a.b 1`・未知のオプション等）は判定しない
- gitのエイリアス・`sh -c`等の文字列越しの実行・`git config`以外による設定ファイルの書き換えは検知しない
- `export`・`env`で設定した`GIT_CONFIG_*`は検知しない
- Coding Agentがユーザーの承認を得ずに`GIT_CONFIG_MODIFY_GUARD_DISABLE=1`を付けることはこのhookでは防げない
- Antigravity CLIではhook入力からコマンドを取り出せないため、何もせずに通過させる
- bunを利用できない場合・依存パッケージの同期に失敗した場合・hook入力を読めない場合は警告を出してコマンドを通過させる
