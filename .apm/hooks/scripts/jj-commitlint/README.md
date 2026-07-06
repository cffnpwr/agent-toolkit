# jj-commitlint

Harnessが`jj describe`/`jj commit`でコミット説明をセットした直後(PostToolUse)に、適用後のrevisionの実説明を読んでcommitlintに掛け、違反していれば是正させるhook。

- 介入点はPostToolUse。
  コマンド文字列から`-m`値を抽出せず、`jj log --no-graph --ignore-working-copy -r <revision> -T description`で適用後の実説明を読む(`--stdin`・変数展開・複数`-m`等に対する頑健性のため)。
- 対象サブコマンドと対象revisionの解決は[検知対象](#検知対象)を参照。
- 出力は移植性の高い終了コードに一本化する。
  違反はexit 2 + stderr、実行不可はexit 1 + stderr、通過・対象外はexit 0・無出力。
- 設定は`cffnpwr/actions`のcommitlint設定(CIと同一ルール)を使う。
  bunの`fetch`でraw取得しTTL付きでローカルにキャッシュする。
  取得失敗時は期限切れキャッシュにフォールバックする。

## 入力の抽出と対応Harness

コマンドはhook入力の`tool_input.command`から取り出す。
このフィールドはClaude(hooks docs, Bashツール)、Codex(`post_tool_use.rs`)、Gemini(`ShellToolParams.command`)で確認済み。
CopilotはcamelCaseの`toolArgs`を使い、コマンドのサブフィールド名が未文書化のため対象外とする。

## 検知対象

### サブコマンド

検知するもの:

| サブコマンド | 既定エイリアス | 対象revisionの解決 |
| --- | --- | --- |
| `describe` | `desc` | `-r`/`--revision`(密着形`-rVALUE`・`-r=VALUE`を含む)・位置引数のrevset。無指定は`@` |
| `commit` | `ci` | `@-`(commitは`@`に作用し、説明は新しい親に乗る) |

検知しないもの:

| サブコマンド | 状態 | 備考 |
| --- | --- | --- |
| `new -m` / `squash -m` / `split -m` | 未対応 | 説明を設定・変更しうるが対象外 |
| ユーザー定義alias | 検知不能 | `jj config`に依存し、コマンド文字列の静的解析では解決できない |

### シェル記法

コマンド文字列をシェル構文としてパースしたASTから、コマンド名が`jj`(または`.../jj`)のsimple commandを抽出する。走査範囲は以下のとおり(全行を実機確認済み)。

| 記法 | 例 | 走査 |
| --- | --- | --- |
| クオート・エスケープ | `-m "feat: x"`・`-m 'x'`・`foo\ bar` | 対応(解決済みの値で判定) |
| 演算子連結 | `&&`・`\|\|`・`;`・`\|`・改行 | 対応(simple commandごとに判定) |
| 先頭env代入 | `FOO=bar jj describe` | 対応 |
| リダイレクト | `jj describe > /dev/null` | 対応(引数と区別) |
| コマンド置換 | `$(jj describe)`・`` `jj describe` `` | 対応(内部を走査。ネスト、代入値・ヒアドキュメント・リダイレクト先・パラメータ展開の値の中を含む) |
| プロセス置換 | `<(jj describe)`・`>(jj describe)` | 対応(内部を走査) |
| 変数展開 | `-r $rev` | 値を解決しない(revisionとして解決できない対象はlint対象外) |
| サブシェル・複合構文 | `( )`・`{ }`・`if`・`for`・`while`・`case`・関数定義 | 対応(内部を再帰的に走査) |
| 条件式 | `[[ -n $(jj describe) ]]` | 対応(operand内の置換を走査) |
| 算術式 | `(( ))`・`$(( ))` | 非対応(内部を走査しない) |
| 文字列越しの実行 | `sh -c 'jj describe'`・`eval` | 非対応(文字列引数として扱う) |

## 出力プロトコル

| 状況 | 出力 | 効果 |
| --- | --- | --- |
| 違反 | exit 2 + stderr | 違反をClaude/Codex/Geminiにフィードバック |
| 実行不可 | exit 1 + stderr | Claude/Codex/Geminiで非ブロック警告 |
| 通過・対象外 | exit 0・無出力 | 何もしない |

入力を抽出できないHarness(Copilot等)は通過となり、上の効果は生じない。

exit 2 + 非空stderrの扱いは各Harnessの公式hook仕様・実装で確認した。
Claudeはstderrをモデルへ渡し、Codexはexit 2 + 非空stderrをBlockedとし、Geminiはツール出力をstderrで置換して継続する。
AI Agentへ渡す違反内容・警告は簡単な英語で出力する。

## 構成

| ファイル | 責務 |
| --- | --- |
| `commitlint.sh` | 起動スクリプト(jj事前フィルタ・bun存在確認・依存同期) |
| `src/main.ts` | エントリ・全体の制御・出力 |
| `src/input.ts` | hook入力からコマンドを抽出 |
| `src/command.ts` | コマンドのパースと対象revisionの解析 |
| `src/lint.ts` | jj説明取得・commitlint実行 |
| `src/config.ts` | 設定の取得とキャッシュ |
| `src/types.ts` | 共有型 |

## 設定(環境変数)

| 変数 | 既定 | 用途 |
| --- | --- | --- |
| `JJ_COMMITLINT_CONFIG_REPO` | `cffnpwr/actions` | 設定取得元リポジトリ(公開リポジトリ前提) |
| `JJ_COMMITLINT_CONFIG_PATH` | `.github/commitlint/default.config.ts` | 設定ファイルパス |
| `JJ_COMMITLINT_CONFIG_REF` | `main` | 取得ref |
| `JJ_COMMITLINT_CACHE_DIR` | `${XDG_CACHE_HOME:-$HOME/.cache}/jj-commitlint` | キャッシュ先 |
| `JJ_COMMITLINT_CACHE_TTL` | `3600` | キャッシュTTL(秒) |

`XDG_CACHE_HOME`は標準の外部変数として参照のみ行う。
設定取得は無認証のraw取得のため、取得元リポジトリは公開されている必要がある。

## Requirements

Hook実行時に内部で呼び出されるbun・jjは実行時にホスト側で利用可能であることを前提とする。
依存パッケージは`package.json`・`bun.lock`で管理して同梱し、起動スクリプトがロックファイルから同期する。
外部コマンドが存在しない場合・同期失敗時はfail-open。

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
