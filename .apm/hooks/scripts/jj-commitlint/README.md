# jj-commitlint

Harnessがjjでコミット説明をセットする直前(PreToolUse)に、コマンドの`-m`/`--message`値をcommitlintに掛けるhook。
違反していればコマンドを実行前にブロックする。

- 介入点はPreToolUse。
  コマンド文字列から`-m`/`--message`値を静的に抽出してlintする。
  実行前に判定するため、コマンドの完了を待たずにhookが走る実行形態(バックグラウンド実行)や、後続コマンドによる作業コピーの移動の影響を受けない。
- メッセージを静的に特定できない呼び出しはlint対象外(fail-open)。
  [検知対象](#検知対象)を参照。
- 出力は移植性の高い終了コードに一本化する。
  違反はexit 2 + stderr、実行不可はexit 1 + stderr、通過・対象外はexit 0・無出力。
- 設定はまずlint対象リポジトリのcommitlint設定を自動探索し、ルールが定義されていればそれを優先する。
  無ければ同梱依存の`@cffnpwr/commitlint-config`パッケージをデフォルトとして`extends`で解決する。
  デフォルトは同梱node_modulesから解決するため、実行はオフラインで完結する。

## 入力の抽出と対応Harness

コマンドはhook入力の`tool_input.command`から取り出す。
このフィールドは次の一次ソースで確認済み。

- Claude: hooks docs(BashツールのPreToolUse入力)
- Codex: `codex-rs/hooks/src/events/pre_tool_use.rs`
- Gemini: `packages/core/src/hooks/types.ts`の`BeforeToolInput`(値は`tools/shell.ts`の`ShellToolParams.command`)

CopilotはcamelCaseの`toolArgs`を使い、コマンドのサブフィールド名が未文書化のため対象外とする。

## 検知対象

### サブコマンド

検知するサブコマンドは、`-m`/`--message`でコミット説明を設定する次のもの。

| サブコマンド | 既定エイリアス | `-m`の対象 |
| --- | --- | --- |
| `describe` | `desc` | 対象revisionの説明 |
| `commit` | `ci` | 対象revisionの説明 |
| `new` | - | 新規changeの説明 |
| `split` | - | 選択した変更を含む側のrevisionの説明 |
| `squash` | - | squash先revisionの説明 |
| `metaedit` | - | 対象revisionの説明 |

次のものは検知しない。

| サブコマンド | 状態 | 備考 |
| --- | --- | --- |
| ユーザー定義alias | 検知不能 | `jj config`に依存し、コマンド文字列の静的解析では解決できない |

### メッセージの解決

lint対象のメッセージはコマンドの`-m`/`--message`値から決める。
対象revision(`-r`・位置引数のrevset)はメッセージ内容に影響しないため解決しない。

| 記法 | 例 | 扱い |
| --- | --- | --- |
| 分離形 | `-m "feat: x"`・`--message "feat: x"` | 値をlint |
| 結合形 | `--message="feat: x"`・`-m"feat: x"`・`-m="feat: x"` | 値をlint |
| 複数指定 | `-m "feat: x" -m "body"` | jjの適用挙動(実測)に合わせ空行で連結してlint |
| `-m`無し(editor起動) | `jj describe` | lint対象外 |
| `--stdin` | `echo msg \| jj describe --stdin` | lint対象外(メッセージがstdin由来で静的に特定できない) |
| 値に展開を含む | `-m "$msg"`・`-m "$(cat f)"` | lint対象外(静的に解決できない) |

`-m ""`のような空メッセージは違反として扱う。

### シェル記法

コマンド文字列をシェル構文としてパースしたASTから、コマンド名が`jj`(または`.../jj`)のsimple commandを抽出する。
走査範囲は以下のとおり(全行を実機確認済み)。

| 記法 | 例 | 走査 |
| --- | --- | --- |
| クオート・エスケープ | `-m "feat: x"`・`-m 'x'`・`foo\ bar` | 対応(解決済みの値で判定) |
| 演算子連結 | `&&`・`\|\|`・`;`・`\|`・改行 | 対応(simple commandごとに判定) |
| 先頭env代入 | `FOO=bar jj describe` | 対応 |
| リダイレクト | `jj describe > /dev/null` | 対応(引数と区別) |
| コマンド置換 | `$(jj describe)`・`` `jj describe` `` | 対応(内部を走査。ネスト、代入値・ヒアドキュメント・リダイレクト先・パラメータ展開の値の中を含む) |
| プロセス置換 | `<(jj describe)`・`>(jj describe)` | 対応(内部を走査) |
| 変数展開 | `-m $msg` | 値を解決しない(メッセージを静的に特定できない対象はlint対象外) |
| サブシェル・複合構文 | `( )`・`{ }`・`if`・`for`・`while`・`case`・関数定義 | 対応(内部を再帰的に走査) |
| 条件式 | `[[ -n $(jj describe) ]]` | 対応(operand内の置換を走査) |
| 算術式 | `(( ))`・`$(( ))` | 非対応(内部を走査しない) |
| 文字列越しの実行 | `sh -c 'jj describe'`・`eval` | 非対応(文字列引数として扱う) |

## 出力プロトコル

| 状況 | 出力 | 効果 |
| --- | --- | --- |
| 違反 | exit 2 + stderr | Claude/Codex/Geminiでコマンドの実行をブロックし、違反をAgentにフィードバック |
| 実行不可 | exit 1 + stderr | Claude/Codex/Geminiで非ブロック警告 |
| 通過・対象外 | exit 0・無出力 | 何もしない |

入力を抽出できないHarness(Copilot等)は通過となり、上の効果は生じない。

exit 2 + 非空stderrの扱いは各Harnessの公式hook仕様・実装で確認した。
ClaudeはPreToolUseのexit 2でツール呼び出しをブロックし、stderrをモデルへ渡す(hooks docs)。
Codexはexit 2 + 非空stderrをBlockedとして実行を止める(`pre_tool_use.rs`)。
Geminiはexit 2 + 非JSONのstderrをdeny判定に変換して実行を止める(`hookRunner.ts`)。
AI Agentへ渡す違反内容・警告は簡単な英語で出力する。

## 構成

| ファイル | 責務 |
| --- | --- |
| `commitlint.sh` | 起動スクリプト(jj事前フィルタ・bun存在確認・依存同期) |
| `src/main.ts` | エントリ・全体の制御・出力 |
| `src/input.ts` | hook入力からコマンドを抽出 |
| `src/command.ts` | コマンドのパースと`-m`/`--message`値の抽出 |
| `src/lint.ts` | commitlint実行(リポジトリ設定を優先し、無ければ`@cffnpwr/commitlint-config`をデフォルト) |
| `src/types.ts` | 共有型 |

## Requirements

Hook実行時に内部で呼び出されるbunは実行時にホスト側で利用可能であることを前提とする。
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
