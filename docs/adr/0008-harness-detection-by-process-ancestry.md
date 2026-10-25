---
ID: 8
date: 2026-10-25
status: accepted
---

# hookを起動したharnessを祖先プロセスの名前で判定する

check-responseは、hookを起動したharnessを、祖先プロセスのうち最初に見つかった名前`claude`・`codex`で判定する。
環境変数`CHECK_RESPONSE_HARNESS`が設定されていれば、判定結果より優先する。
判定結果は呼び出すCLIの選択とtranscriptの解釈にだけ使い、出力は[ADR 0002](./0002-hook-exit-code-protocol.md)の終了コードのままとする。

## Context

check-responseは、LLMが書いた日本語を軽量モデルで検査する。
軽量モデルは、hookを起動したharnessと同じCLI(`claude -p`・`codex exec`)で呼び出す。
ユーザーが使っているharnessのCLIと認証は存在が確実で、別のharnessのCLIは存在を前提にできないためである。
Stopで読むtranscriptの形式もharnessごとに異なる。
そのため、hookはどちらのharnessに起動されたかを知る必要がある。

[ADR 0002](./0002-hook-exit-code-protocol.md)が述べるとおり、hookの入力に呼び出し元を名乗るフィールドは無い。
入力フィールドの差(Codexの`turn_id`等)から推定はできるが、識別子として文書化されていない。

次を確認した。

- macOS・Homebrew版のClaude Code 2.1.310とCodex 0.164.0で、hookプロセスの祖先の`comm`がそれぞれ`claude`・`codex`だった
- Linux(Debian 12のコンテナ)では、シンボリックリンク`claude`経由で起動したプロセスの`/proc/<pid>/comm`が`claude`だった。
  このコンテナには`ps`が無い
- Codexのnpm版は、Node.jsのラッパーが`codex`という名前のネイティブバイナリを起動する(openai/codex `codex-cli/bin/codex.js:92,241`)
- Codexの中でClaude Codeを、またはその逆を起動した場合、hookに近い側の祖先が起動したharnessになる

IDE拡張・デスクトップアプリ経由で起動した場合のプロセス構成は確認していない。

## Choices

1. 祖先プロセスの名前で判定する
2. hook入力のフィールドの差で判定する
3. 環境変数による指定だけで判定する

### 1. 祖先プロセスの名前で判定する

hookプロセスから親をたどり、最初に見つかった`claude`・`codex`で判定する。
macOSでは`ps -o ppid=,comm= -p <pid>`、Linuxでは`/proc/<pid>/stat`・`/proc/<pid>/comm`を読む。
`comm`はパスを含む場合があるため、basenameを取る。

#### Pros

- harnessが実際に起動したプロセスを見るため、入力フィールドの仕様変更の影響を受けない
- 設定をせずに動く
- harnessを入れ子で起動した場合も、hookに近い側を選べる

#### Cons

- プロセス名は公式の識別子ではなく、配布形態(ラッパー・リネーム)によって変わりうる
- IDE拡張・デスクトップアプリ経由の構成は未確認で、判定できない場合がある
- OSごとにプロセス情報の読み方が異なる

### 2. hook入力のフィールドの差で判定する

`turn_id`の有無等、harnessごとに異なる入力フィールドから推定する。

#### Pros

- 外部コマンド・procfsを使わずに済む

#### Cons

- フィールドの差は呼び出し元の識別子として文書化されておらず、harnessの更新で成立しなくなる([ADR 0002](./0002-hook-exit-code-protocol.md))
- 他のharnessが同名のフィールドを追加すると誤判定する

### 3. 環境変数による指定だけで判定する

利用者がharnessを環境変数で指定する。

#### Pros

- 判定が確実で、実装が最も単純

#### Cons

- hookの環境変数はharnessごとに設定経路が異なり、利用者に設定の負担がかかる
- 同じ環境でClaude CodeとCodexを使い分ける場合、指定を切り替えられない

## Decision

選択肢1を採り、選択肢3の環境変数を上書きの手段として併用する。

祖先プロセスの名前は、確認したmacOS・Linuxの構成でharnessを判別でき、設定を要しない。
選択肢2は、ADR 0002がJSON出力を退けた理由と同じく、文書化されていない差に依存する。
選択肢3は確実だが、使い分けの場面で破綻するため、判定できない構成への上書きの手段にとどめる。

## Consequences

- 判定できない場合、hookはtranscriptを解釈せず、軽量モデルでも検査せずに警告を出す。
  textlintの違反があればexit 2、無ければexit 1で終了する
- 判定結果は呼び出すCLIの選択とtranscriptの解釈にだけ使い、出力プロトコルは終了コードのまま変えない
- 未確認の構成(IDE拡張・デスクトップアプリ・Windows)では、環境変数`CHECK_RESPONSE_HARNESS`の設定を利用者に求める
- harnessの配布形態がプロセス名を変えた場合、判定の追従が必要になる
