# prefer-jj

jjが使用可能なリポジトリでのシェルコマンド実行前(PreToolUse)に、jj相当のあるgit操作をブロックし、対応するjjコマンドへ誘導するhook。

- 介入点はPreToolUse。目的が操作の抑止であり、実行後では間に合わないため、実行前にコマンド文字列を解析する。
- 分類はdenylist(既定通過)。列挙したjj相当のgitサブコマンドのみブロックし、未登録のサブコマンドは全て通過する。
- 読取専用の操作(status・log等)も誘導対象とする。
- jjリポジトリ判定は`jj root --ignore-working-copy`の成否で行う。非jjリポジトリ・jj不在は対象外として通過する。
- 出力は移植性の高い終了コードに一本化する。
  ブロックはexit 2 + stderr、実行不可はexit 1 + stderr、通過・対象外はexit 0・無出力。

## 入力の抽出と対応Harness

コマンドはhook入力の`tool_input.command`から取り出す。
このフィールドはClaude(hooks docs, Bashツール)、Codex(`pre_tool_use.rs`)、Gemini(`ShellToolParams.command`)で確認済み。
CopilotはcamelCaseの`toolArgs`を使い、コマンドのサブフィールド名が未文書化のため対象外とする。

## 検知対象

### サブコマンド(denylist)

ブロックしてjjへ誘導するもの。誘導先は[jj-referenceスキル](../../../skills/jj-reference/SKILL.md)の対応表と整合させる。

| gitサブコマンド | jj誘導先 |
| --- | --- |
| `status` | `jj st` |
| `log` | `jj log` |
| `diff` | `jj diff` |
| `show` | `jj show` / `jj file show` |
| `ls-files` | `jj file list` |
| `blame` | `jj file annotate` |
| `add` | 不要(jjは作業コピーを自動snapshotする) |
| `commit` | `jj commit` / `jj describe` |
| `checkout` / `switch` | `jj new` / `jj edit`(ファイル復元は`jj restore`) |
| `restore` | `jj restore` |
| `reset` | `jj abandon` / `jj restore` / `jj squash` |
| `rebase` | `jj rebase` |
| `merge` | `jj new @ REV` |
| `cherry-pick` | `jj duplicate` |
| `revert` | `jj revert` |
| `stash` | `jj new @-` |
| `push` | `jj git push` |
| `fetch` | `jj git fetch` |
| `pull` | `jj git fetch` + `jj rebase` |
| `clone` | `jj git clone` |
| `init` | `jj git init` |
| `remote` | `jj git remote` |
| `branch` | `jj bookmark` |
| `worktree` | `jj workspace` |
| `sparse-checkout` | `jj sparse` |

`clone`/`fetch`にshallow/partial系フラグ(`--depth`・`--shallow-*`・`--filter`・`--unshallow`)が付く場合は、jj相当の無いgit専用操作として通過する。

検知しないもの(denylist未登録。jj相当が無い/限定的でgit専用):

`config`、`submodule`、`lfs`、`tag`、`apply`/`am`/`format-patch`、`bisect`、`grep`、`clean`、`rm`/`mv`、`reflog`、plumbing(`rev-parse`・`cat-file`・`ls-tree`等)。
根拠は[jjのgit互換性ドキュメント](https://docs.jj-vcs.dev/latest/git-compatibility/)を参照。

### シェル記法

コマンド文字列をシェル構文としてパースしたASTから、コマンド名が`git`(または`.../git`)のsimple commandを抽出する。走査範囲は以下のとおり。

| 記法 | 例 | 走査 |
| --- | --- | --- |
| クオート・エスケープ | `git commit -m "feat: x"` | 対応(解決済みの値で判定) |
| 演算子連結 | `&&`・`\|\|`・`;`・`\|`・改行 | 対応(simple commandごとに判定) |
| 先頭env代入 | `FOO=bar git commit` | 対応(代入を飛ばしてコマンド名を判定) |
| グローバルフラグ跨ぎ | `git -C /path commit` | 対応(値を取るフラグを読み飛ばしてサブコマンドを特定) |
| リダイレクト | `git status > /dev/null` | 対応(引数と区別) |
| コマンド置換 | `$(git status)`・`` `git status` `` | 対応(内部を走査。ネスト、代入値・リダイレクト先・パラメータ展開の値の中を含む) |
| プロセス置換 | `<(git status)`・`>(git status)` | 対応(内部を走査) |
| サブシェル・複合構文 | `( )`・`if`・`for`・`while`・`case`・関数定義 | 非対応(内部を走査しない) |
| 文字列越しの実行 | `sh -c 'git status'`・`eval`・`command git`・`env git` | 非対応(間接起動は追わない) |

非対応の記法は既定通過モデルの帰結として通過する。

## エスケープハッチ

| 経路 | 効果 |
| --- | --- |
| hookプロセスの環境変数`PREFER_JJ_DISABLE`を真値に設定 | セッション全体で無効化(起動スクリプトが即通過) |
| コマンド先頭に`PREFER_JJ_DISABLE=1`を前置(`PREFER_JJ_DISABLE=1 git ...`) | そのsimple commandのみ一時バイパス |

いずれの経路も、偽値(未設定・空・`0`・`false`・`no`・`off`。大文字小文字無視)では無効化しない。
偽値の集合はgit-configのbooleanの偽値に合わせる。

コマンド文字列内の前置代入はhookプロセスの環境に乗らないため、前置はコマンド単位のバイパスとしてのみ働く。
バイパスは前置したsimple command自身にのみ効き、その中のコマンド置換・プロセス置換の内部には及ばない。
ブロックメッセージには前置バイパスを案内する。

## 出力プロトコル

| 状況 | 出力 | 効果 |
| --- | --- | --- |
| ブロック | exit 2 + stderrにサブコマンド別のjj相当を提示 | Claude/Codex/Geminiにフィードバック |
| 通過 | exit 0・無出力 | 何もしない |
| 実行不可 | exit 1 + stderr | Claude/Codex/Geminiで非ブロック警告 |

入力を抽出できないHarness(Copilot等)は通過となり、上の効果は生じない。

exit 2 + 非空stderrの扱いは各Harnessの公式hook仕様・実装で確認した。
Claudeはstderrをモデルへ渡し、Codexはexit 2 + 非空stderrをBlockedとし、Geminiはツール出力をstderrで置換して継続する。
AI Agentへ渡すフィードバック・警告は簡単な英語で出力する。

## 構成

| ファイル | 責務 |
| --- | --- |
| `prefer-jj.sh` | 起動スクリプト(無効化判定・git事前フィルタ・jjリポジトリ判定・bun存在確認・依存同期) |
| `src/main.ts` | エントリ・全体の制御・出力 |
| `src/input.ts` | hook入力からコマンドを抽出 |
| `src/command.ts` | コマンドのパースとgit呼び出し(サブコマンド・引数)の抽出 |
| `src/classify.ts` | denylist分類とjj誘導メッセージの生成 |
| `src/types.ts` | 共有型 |

## 設定(環境変数)

| 変数 | 既定 | 用途 |
| --- | --- | --- |
| `PREFER_JJ_DISABLE` | (未設定) | 真値でhook全体を無効化(偽値: 空・`0`・`false`・`no`・`off`)。コマンド先頭への前置はそのsimple commandのみバイパス |

## Requirements

Hook実行時に内部で呼び出されるbun・jjは実行時にホスト側で利用可能であることを前提とする。
依存パッケージは`package.json`・`bun.lock`で管理して同梱し、起動スクリプトがロックファイルから同期する。
bun不在・同期失敗時はfail-open。jj不在・非jjリポジトリは対象外として通過する。

### 依存パッケージ

| 言語 | パッケージマネージャ | 定義ファイル | ロックファイル | 同期コマンド |
| --- | --- | --- | --- | --- |
| JavaScript / TypeScript | bun | `package.json` | `bun.lock` | `bun install --frozen-lockfile --production --ignore-scripts` |

依存パッケージの一覧・バージョンは`package.json`を一次ソースとする。
`apm install`は依存パッケージ本体を導入しないため、`package.json`・`bun.lock`もhook定義のcommandに列挙してコピー対象に含め、ホスト側の同期コマンドで導入する。

### 外部ツール

| ツール | バージョン要件 |
| --- | --- |
| bun | `>= 1.2` |
| jj | `>= 0.7` |
