# APM hooks

APM(Agent Package Manager)が各Harnessにデプロイするhookを置く。
ここでのHarnessはhookプロトコルを実装するホスト実行環境(Claude Code、Codex CLI、Gemini CLI、GitHub Copilot CLI等)を指し、推論を行うAIモデルとは区別する。

`*.json`(直下のみ)がhookマニフェスト、`scripts/<hook名>/`がその実装。
マニフェストはネストしたサブディレクトリでは探索されない(APMの探索は`glob("*.json")`非再帰)。
そのため`scripts/`配下の開発ツーリング(`package.json`・`tsconfig.json`等)はマニフェストとして誤検知されない。

## jj-commitlint

Harnessが`jj describe`/`jj commit`でコミット説明をセットした直後(PostToolUse)に、適用後のrevの実説明を読んでcommitlintに掛け、違反していれば是正させるhook。

- 介入点はPostToolUse。
  コマンド文字列から`-m`値を抽出せず、`jj log --no-graph --ignore-working-copy -r <rev> -T description`で適用後の実説明を読む(`--stdin`・変数展開・複数`-m`等に対する頑健性のため)。
- 対象は`jj describe`(対象revは`-r`/`--revision`(密着形`-rVALUE`・`-r=VALUE`を含む)・位置引数のrevset、既定`@`)と`jj commit`(常に`@`に作用し説明は`@-`に乗る)。
  `squash`/`split`/`new`は対象外。
- 出力は移植性の高い終了コードに一本化する。
  違反はexit 2 + stderr、実行不可(fail-open)はexit 1 + stderr、通過・対象外はexit 0・無出力。
- 設定は`cffnpwr/actions`のcommitlint設定(CIと同一ルール)を使う。
  bunの`fetch`でraw取得しTTL付きでローカルにキャッシュする。
  取得失敗時は期限切れキャッシュにフォールバックする。

### 入力の抽出と対応Harness

コマンドはhook入力の`tool_input.command`から取り出す。
このフィールドはClaude(hooks docs, Bashツール)、Codex(`post_tool_use.rs`)、Gemini(`ShellToolParams.command`)で確認済み。
CopilotはcamelCaseの`toolArgs`を使い、コマンドのサブフィールド名が未文書化のため対象外とする。

### 出力プロトコル

| 状況 | 出力 | 効果 |
| --- | --- | --- |
| 違反 | exit 2 + stderr | 違反をClaude/Codex/Geminiにフィードバック |
| 実行不可(fail-open) | exit 1 + stderr | Claude/Codex/Geminiで非ブロック警告 |
| 通過・対象外 | exit 0・無出力 | 何もしない |

入力を抽出できないHarness(Copilot等)は通過(exit 0)となり、上の効果は生じない。

exit 2 + 非空stderrの扱いは各Harnessの公式hook仕様・実装で確認した。
Claudeはstderrをモデルへ渡し、Codexはexit 2 + 非空stderrをBlockedとし、Geminiはツール出力をstderrで置換して継続する。
AI Agentへ渡す違反内容・警告は簡単な英語で出力する。

### 構成

| ファイル | 責務 |
| --- | --- |
| `scripts/jj-commitlint/commitlint.sh` | 起動スクリプト(jj事前フィルタ・bun存在確認) |
| `scripts/jj-commitlint/main.ts` | エントリ・全体の制御・出力 |
| `scripts/jj-commitlint/input.ts` | hook入力からコマンドを抽出 |
| `scripts/jj-commitlint/command.ts` | コマンドのトークナイズと対象revの解析 |
| `scripts/jj-commitlint/lint.ts` | jj説明取得・commitlint実行 |
| `scripts/jj-commitlint/config.ts` | 設定の取得とキャッシュ |
| `scripts/jj-commitlint/types.ts` | 共有型 |

`command.ts`のトークナイザ・パーサには`command.test.ts`(`bun test`)でテストを置く。

### 設定(環境変数)

| 変数 | 既定 | 用途 |
| --- | --- | --- |
| `JJ_COMMITLINT_CONFIG_REPO` | `cffnpwr/actions` | 設定取得元リポジトリ(公開リポジトリ前提) |
| `JJ_COMMITLINT_CONFIG_PATH` | `.github/commitlint/default.config.ts` | 設定ファイルパス |
| `JJ_COMMITLINT_CONFIG_REF` | `main` | 取得ref |
| `JJ_COMMITLINT_CACHE_DIR` | `${XDG_CACHE_HOME:-$HOME/.cache}/jj-commitlint` | キャッシュ先 |
| `JJ_COMMITLINT_CACHE_TTL` | `3600` | キャッシュTTL(秒) |

`XDG_CACHE_HOME`は標準の外部変数として参照のみ行う。
設定取得は無認証のraw取得のため、取得元リポジトリは公開されている必要がある。

### Requirements

外部ツールがホスト側で利用可能であることを前提とする。
不在時はfail-open(警告して通し、導入はユーザーに委ねる)。
依存の導入・代替手段へのフォールバックが必要な場合は、進行を停止しユーザーへエスカレーションする。

#### 外部ツール

| ツール | 確認バージョン | 存在確認 |
| --- | --- | --- |
| bun | `1.3.14` | `command -v bun` |
| jj | `0.42.0` | `command -v jj` |
| `@commitlint/cli` | `20.5.3`(`bun x --bun`が初回取得・キャッシュ) | — |

上表は動作確認したバージョン。
下限は厳密には未検証のため要件として断定しない。

外部コマンド呼び出しは`jj`とbun(`bun x --bun`)に限る。
設定取得はbun組み込みの`fetch`を使い、`gh`等の追加コマンドには依存しない。
`bun`不在時は起動スクリプトが、設定取得失敗かつキャッシュ無し・`@commitlint/cli`取得失敗時は本体が、それぞれfail-open警告を出して通す。
