# approval-chain-guard

承認プロンプトが出る呼び出し(PermissionRequest)のうち、`&&`・`||`・`;`(改行含む)で複数コマンドを詰め込んだものを拒否し、1呼び出し1コマンドへの分割を促すhook。`|`は対象外。

- 介入点はPermissionRequest。承認プロンプトを出す直前にだけ発火するため、承認が要る呼び出しだけに作用する。
  承認の要否はharnessが判定し、hookは届いた呼び出しが連結かどうかだけを判定する。
- 判定は「1リストに複数のコマンドが並んでいるか」の構造判定であり、denylist/allowlistのような操作の種類による分類ではない。
- 到達可能な全ての複合構文(サブシェル・if・for・while・function・case等)の内部、およびcommand/process substitutionの内部まで走査する。
- `cd <dir> &&`単発は例外として通過する。
- 拒否はstdoutのdecision JSONで返し、終了コードは常に0または1にする。

## 入力の抽出と対応Harness

コマンドはhook入力の`tool_input.command`から取り出す。

| Harness | 対応 | 根拠 |
| --- | --- | --- |
| Claude Code | 対応 | `PermissionRequest`は承認を求める直前に発火し、`tool_name`・`tool_input`を受け取る(`tool_use_id`は無い)。[hooks reference](https://code.claude.com/docs/en/hooks#permissionrequest) |
| Codex | 対応 | 同名イベントを持ち、承認経路で発火する。`tool_name`は`"Bash"`、コマンドは`tool_input.command`(`codex-rs/hooks/src/events/permission_request.rs`・`codex-rs/core/src/tools/sandboxing.rs`) |
| Gemini CLI | 非対応 | 承認経路のイベントが無い。ツール関連は`BeforeToolSelection`・`BeforeTool`・`AfterTool`のみ(`packages/core/src/hooks/types.ts`の`HookEventName`) |
| Copilot | 対象外 | camelCaseの`toolArgs`を使い、コマンドのサブフィールド名が未文書化 |

## 検知対象

### 判定ロジック

コマンド文字列をシェル構文としてパースしたASTを、`Script`のトップレベルから再帰的に走査する。

- あるStatementのリスト(`Script.commands`、および到達した各複合構文の本体`CompoundList.commands`)に2個以上のStatementが並ぶとき、`;`・改行区切りの連結として違反にする。
  `;`と改行はAST上区別されないため同一に扱う。
- `AndOr`ノード(`&&`・`||`で結ばれた並び)は、下記の例外に一致しない限り違反にする。

### シェル記法の走査範囲

| 記法 | 例 | 走査 |
| --- | --- | --- |
| 演算子連結 | `&&`・`\|\|`・`;`・改行 | 対応(違反として検知) |
| pipe | `\|` | 対応(連結として扱わない。各segmentの内部は走査する) |
| バックグラウンド実行 | `a & b` | 対応(`&`だけで繋がれた並びは連結として扱わない) |
| コマンド置換 | `$(a && b)`・`` `a && b` `` | 対応(内部を走査。ネスト、代入値・リダイレクト先・パラメータ展開の値の中を含む) |
| プロセス置換 | `<(a && b)`・`>(a && b)` | 対応(内部を走査) |
| サブシェル・複合構文 | `( )`・`if`・`for`・`while`・`select`・`case`・`function`・`coproc`・`{ }`(brace group)等 | 対応(本体の内部まで走査する) |
| `[[ ]]`内部のテスト論理演算子 | `[[ a && b ]]` | 非対応(コマンド連結ではなく単一コマンド内のテスト式のため走査しない) |
| 文字列越しの実行 | `sh -c 'a && b'`・`eval "a && b"` | 非対応(引数の文字列がシェルとして再解釈される埋め込みチェーンはAST上見えないため追わない) |

## 例外

### `cd`例外

cwdがBash呼び出しごとにリセットされるharness制約への対処として、`cd <dir> && <単一コマンド>`のみ許容する。
走査中に出会う**あらゆる階層**の`AndOr`ノードに同じ条件で適用する(トップレベルに限らない)。

- 演算子が全て`&&`
- セグメントがちょうど2個(`cd`呼び出し＋残り1個)
- 先頭セグメントが`cd`単体の呼び出し。フラグは`-L`・`-P`のみ許容し、それ以外のフラグがあれば例外にしない。非フラグ引数(対象ディレクトリ)はちょうど1個
- 残り側のセグメントは通常どおり内部まで走査する。
  `cd dir && { a; b; }`のように残り側自体が複数コマンドなら、そちらは別途違反として検知する。

## 出力プロトコル

| 状況 | 出力 | 効果 |
| --- | --- | --- |
| 拒否 | exit 0 + stdoutに`{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"deny","message":"..."}}}` | Claude/Codexが呼び出しを拒否し、`message`をAgentへ渡す |
| 通過 | exit 0・無出力 | 何もしない |
| 実行不可 | exit 1 + stderr | `decision`なしとして通常の承認フローへ戻る(fail-open) |

拒否をJSONで返す理由は[ADR 0007](../../../../docs/adr/0007-permission-request-json-decision.md)を参照する。
`decision`には`behavior`・`message`以外を入れない。
Codexは未知フィールドを含む`decision`を不正として扱う(`codex-rs/hooks/src/schema.rs`の`deny_unknown_fields`)。

入力を抽出できないHarness(Copilot等)は通過となり、上の効果は生じない。
AI Agentへ渡す拒否理由・警告は簡単な英語で出力する。

## 拒否メッセージ

`message`には、分けられる形なら1呼び出しずつの分割案を、分けられない形なら検知箇所を入れる。

分割案は、連結がトップレベルの1箇所だけで、各セグメントが単純コマンドかpipelineのときに作る。

- 各項の文字列はソースのスライスをそのまま使い、番号付きで列挙する。
- 先頭が`cd <dir>`で演算子が全て`&&`のとき(`cd d && a && b`)は、`cd <dir>`を各項へ再前置する(`cd d && a`・`cd d && b`)。
  `cd d; a; b`のように`;`区切りのときは再前置せず、`cd d`・`a`・`b`の3項にする。
- `&&`・`||`の条件実行が分割で失われることを併記する。

複合構文の本体や置換の内部に違反がある場合、およびセグメントが複合構文の場合は、機械的に分けられないため検知箇所(`ラベル: 該当箇所`)を列挙し、各コマンドを単独の呼び出しにするよう促す。

## 構成

| ファイル | 責務 |
| --- | --- |
| `approval-chain-guard.sh` | 起動スクリプト(事前フィルタ・bun存在確認・依存同期) |
| `src/main.ts` | エントリ・全体の制御・出力 |
| `src/input.ts` | hook入力からコマンドを抽出 |
| `src/command.ts` | コマンドのパースと連結違反の検知・例外判定・分割案の算出 |
| `src/suggest.ts` | 拒否メッセージの組み立て |
| `src/types.ts` | 共有型 |

## Requirements

Hook実行時に内部で呼び出されるbunは実行時にホスト側で利用可能であることを前提とする。
依存パッケージは`package.json`・`bun.lock`で管理して同梱し、起動スクリプトがロックファイルから同期する。
bun不在・同期失敗時はfail-open。

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
