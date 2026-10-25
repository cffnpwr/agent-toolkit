# check-response

Claude Code・CodexのLLMがユーザーに返した日本語の応答を検査し、違反があれば差し戻すhook。

## 概要

検査はtextlintと軽量モデルで行なう。
textlintの設定は`.textlintrc.json`・`.prh.yml`に置く。
`@cffnpwr/textlint-config`の設定を元に、`prh`の指摘をwarningにしている。
textlintには、kuromoji.jsの形態素解析で比喩的な動詞と連用中止を検出する規則を加えている。
軽量モデルは、hookを起動したharnessのCLI(`claude -p --model haiku`・`codex exec -m gpt-6-luna`)で呼び出す。
harnessは祖先プロセスの名前で判定する([ADR 0008](../../../../docs/adr/0008-harness-detection-by-process-ancestry.md))。

Stopで、ユーザーの最後の発言以降の未検査の応答を、textlint・文章の査読・未確認事項の検査で検査する。

textlintの指摘は、severityで2種類に分ける。

| severity | 扱い |
| --- | --- |
| error | 違反と確定した指摘。差し戻す |
| warning | 文脈によっては違反ではない候補。文章の査読で違反かを判定させ、違反と判定された場合だけ査読の指摘として扱う |

文章の査読には、前のターンの発言・応答を、新しいものから12000文字まで文脈として渡す。
文章の査読の入力からは、ツール呼び出しを除き、コードブロックを省略の表記に置き換える。
未確認事項の検査には、前のターンのツール呼び出しの名前と入力だけを、新しいものから12000文字まで渡す。

違反があればexit 2とstderrで差し戻す。
検査できない場合は、exit 1とstderrで警告し、ターンを止めない。

差し戻しを受けて書き直した応答は、同じターンの中で次の条件の場合だけ差し戻す。

- textlintの確定した指摘が残っている
- 前の差し戻しで報告した査読の指摘の引用が、書き直した応答にそのまま残っている

書き直した応答への新しい査読の指摘は差し戻さず、exit 1とstderrで警告する。
差し戻しは1つのターンで3回までとし、上限に達した後の違反もexit 1とstderrで警告する。

検査済みの応答・ターンごとの差し戻しの回数・最後の差し戻しで報告した査読の指摘は、`$XDG_CACHE_HOME/check-response/<session-id>`に記録する。
`XDG_CACHE_HOME`が未設定の場合は`~/.cache`を使う。

hookの実行ごとに、検査の内容と結果を`$XDG_STATE_HOME/check-response/log.jsonl`にJSON Linesで1行追記する。
`XDG_STATE_HOME`が未設定の場合は`~/.local/state`を使う。
ログが20 MiBを超えた場合は、追記の前に古い半分の行を削除する。
ログを書き込めない場合も、検査の結果は変わらない。

| キー | 内容 |
| --- | --- |
| `time` | 実行した日時(ISO 8601) |
| `session_id` | セッションのID |
| `harness` | 判定したharness。判定できない場合は`{"error": <理由>}` |
| `block_count` | 実行の時点で、同じターンで差し戻した回数 |
| `confirmed` | textlintの確定した指摘 |
| `needs_judgment` | textlintの判定が必要な指摘 |
| `reviews` | 査読ごとの指摘、または失敗の理由 |
| `warnings` | 警告 |
| `responses` | 検査した応答 |
| `outcome` | `block`・`warning`・`pass`・`skipped`(日本語の応答が無い) |

## 手動での実行

`src/main.ts`を引数付きで実行すると、hookとは別に検査を実行できる。

```sh
bun src/main.ts --text <file|-> [--no-llm]
bun src/main.ts --scan [--harness claude|codex] <transcript.jsonl>...
```

`--text`は、ファイル(`-`の場合は標準入力)の日本語の文章を、textlintと文章の査読で検査する。
textlintの確定した指摘・判定が必要な指摘・査読の指摘を分けて出力する。
確定した指摘か査読の指摘があればexit 1、無ければexit 0で終了する。
`--no-llm`を付けると、文章の査読を実行しない。
harnessを判定できない場合は、文章の査読を実行せずにstderrに理由を出力する。

`--scan`は、Claude Codeのtranscript・Codexのrolloutにある日本語の応答をすべてtextlintで検査する。
規則ごとの指摘の数を多い順に、例を3件まで添えて出力する。
transcriptの形式は`--harness`で指定する。
指定しない場合は、hookと同じ方法でharnessを判定する。

使い方に合わない引数の場合は、引数の誤りと使い方をstderrに出力してexit 2で終了する。

## Requirements

| 外部ツール | 用途 |
| --- | --- |
| bun | hookの実行 |
| claude | Claude Codeでの軽量モデルの呼び出し |
| codex | Codexでの軽量モデルの呼び出し |

依存パッケージは`package.json`・`bun.lock`で管理する。
起動スクリプトが、発火のたびに`bun install --frozen-lockfile --production --ignore-scripts`で同期する。

## 環境変数

| 変数 | 用途 |
| --- | --- |
| `CHECK_RESPONSE_DISABLE` | 真値でhookを無効にする。偽値は空・`0`・`false`・`no`・`off` |
| `CHECK_RESPONSE_HARNESS` | harnessを`claude`・`codex`で指定する。祖先プロセスによる判定より優先する |
