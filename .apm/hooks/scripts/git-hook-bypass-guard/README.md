# git-hook-bypass-guard

Coding Agentがgit hookを実行させないgitコマンドを実行する前に、ユーザーの承認を求めるhook。

## Requirements

- [Bun](https://bun.sh) 1.2以上

## 検知するコマンド

次のいずれかに当てはまるgitコマンドを検知する。

- 引数に`--no-verify`・`--no-validate`・`--no-post-rewrite`を指定する場合
- `git commit`・`git am`に`-n`（`--no-verify`の短縮形）オプションを指定する場合
- `git history`の`drop`・`fixup`・`reword`・`split`を実行する場合

`&&`・`;`・パイプ・コマンド置換等でつないだコマンドも1つずつ判定する。

## harnessごとの動作

| harness | 検知したときの動作 |
| --- | --- |
| Claude Code | ユーザーに承認を求める |
| Codex | コマンドをブロックし、ユーザーに承認を求めるようCoding Agentに指示する |
| GitHub Copilot CLI（`.claude/settings.json`のhookとして実行した場合） | Codexと同じ |
| 上記以外 | 対象外 |

## 承認後の再実行と無効化

Claude Code以外ではユーザーの承認を得た後に、Coding Agentが`GIT_HOOK_BYPASS_GUARD_DISABLE=1`を付けてコマンドを再実行する。
Claude Codeではこの指定を無視して承認を求める。

hook全体を無効化するにはhookを実行するharnessの環境で`GIT_HOOK_BYPASS_GUARD_DISABLE`を真値にする。
値が未設定・空・`0`・`false`・`no`・`off`（大文字小文字を区別しない）のときは偽値、それ以外のときは真値と判定する。

## 注意事項

- コマンド文字列を静的に解析するため、実行時に値が決まる語（`git commit $OPTS`等）は判定しない
- オプションの省略形（`--no-veri`）・gitのエイリアス・`sh -c`等の文字列越しの実行は検知しない
- 語の位置と意味は解釈しないため、`git commit -m --no-verify`のようにオプションの値として現れた語も検知する
- `-c core.hooksPath=...`等による設定の上書きは、[git-config-modify-guard](../git-config-modify-guard/README.md)が検知する
- Coding Agentがユーザーの承認を得ずに`GIT_HOOK_BYPASS_GUARD_DISABLE=1`を付けることはこのhookでは防げない
- Antigravity CLIではhook入力からコマンドを取り出せないため、何もせずに通過させる
- bunを利用できない場合・依存パッケージの同期に失敗した場合・hook入力を読めない場合は警告を出してコマンドを通過させる
