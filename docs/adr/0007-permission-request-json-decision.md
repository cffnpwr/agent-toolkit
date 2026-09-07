---
ID: 7
date: 2026-09-07
status: accepted
---

# PermissionRequestイベントのhookは拒否をJSON decisionで伝える

`PermissionRequest`イベントで発火するhookは、拒否をstdoutのJSON(`hookSpecificOutput.decision`)で伝える。
[ADR 0002](./0002-hook-exit-code-protocol.md)が定める終了コードへの一本化は、このイベント以外では維持する。

## Context

approval-chain-guardは、承認プロンプトが出る呼び出しに限って、複数コマンドの連結をブロックする。
承認プロンプトに連結コマンドが丸ごと表示されると、何を承認しているのか読み取れないためである。

呼び出しが承認を要するかは、`PreToolUse`の入力からは分からない。
Claude Codeの`permission_mode`はセッションの権限モードであり、個々の呼び出しが自動承認されるかを示すフィールドは無い([hooks#common-input-fields](https://code.claude.com/docs/en/hooks#common-input-fields))。
Codex・Gemini CLIの入力にも相当するフィールドは無い。
Codexは`codex-rs/hooks/src/schema.rs`の`PreToolUseCommandInput`で確認した。
Gemini CLIは`packages/core/src/hooks/types.ts`の`BeforeToolInput`で確認した。

承認プロンプトの直前にだけ発火するイベントとして`PermissionRequest`がある。

| harness | `PermissionRequest`の有無と出力の扱い |
| --- | --- |
| Claude Code | 承認プロンプトを出す直前にだけ発火する。`decision`オブジェクトの無いexit 2は承認フローを変えず、stderrは捨てられる。拒否は`hookSpecificOutput.decision.behavior: "deny"`でのみ伝わり、`message`がモデルへ渡る([hooks#permissionrequest-decision-control](https://code.claude.com/docs/en/hooks#permissionrequest-decision-control)) |
| Codex | 同名イベントがあり、Claude Codeと同じ形のJSON(`hookSpecificOutput.hookEventName`・`decision.behavior`・`decision.message`)を受け付ける(`codex-rs/hooks/src/schema.rs`の`PermissionRequestCommandOutputWire`、`codex-rs/hooks/src/engine/output_parser.rs`の`parse_permission_request`)。exit 2 + 非空stderrも拒否として扱うが、Claude Codeとは揃わない。`decision`の未知フィールドは拒否する |
| Gemini CLI | 承認経路のhookが無い(`BeforeTool`のみ)。`packages/core/src/hooks/types.ts` |

ADR 0002がJSON出力を退けた理由は、ブロックを指示するキーがharnessごとに割れ、出し分けに呼び出し元の判別が要ることだった。
`PermissionRequest`に限れば、このイベントを持つ2つのharnessでキーが一致することを一次ソースで確認できる。

## Choices

1. `PermissionRequest`ではJSON decisionを使う
2. `PreToolUse`にとどまり、承認要否をhookで再実装する
3. `PreToolUse`にとどまり、不可逆コマンドのdenylistで承認要否を近似する

### 1. `PermissionRequest`ではJSON decisionを使う

このイベントに限り、拒否をstdoutの`hookSpecificOutput.decision`で伝える。
通過はexit 0・無出力、実行不可はexit 1 + stderrのままとし、exit 2は使わない。

#### Pros

- 承認要否の判定をharness自身に委ね、hookは構造判定だけを持つ
- 対応するharness(Claude Code・Codex)でJSONのキーが一致し、呼び出し元の判別が要らない
- 承認プロンプトが出ない呼び出し(allowルールで許可済み、auto modeで分類器が通した等)には発火せず、作業を妨げない

#### Cons

- Gemini CLIでは発火しない
- 出力プロトコルがイベントによって分かれ、hookの実装者が使い分けを覚える必要がある
- 各harnessのJSON仕様の変更に、このイベントを使うhookで追従しなければならない

### 2. `PreToolUse`にとどまり、承認要否をhookで再実装する

settingsのpermission rule(`allow`・`ask`・`deny`)をhookが読み、各サブコマンドを照合する。

#### Pros

- 終了コードへの一本化を保てる
- 3つのharnessで動く

#### Cons

- Bashルールの照合仕様(前方一致・ラッパー除去・read-onlyコマンド集合・リダイレクト検査)をharnessごとに再実装し、追従し続ける必要がある
- settingsの所在(managed・user・project・local)と優先順位もharnessごとに再実装する必要がある
- auto modeの分類器の判定は外部から取得できず、再実装しても一致しない

### 3. `PreToolUse`にとどまり、不可逆コマンドのdenylistで承認要否を近似する

`git push`・`rm -rf`等の不可逆操作を列挙し、連結に含まれるときだけブロックする。

#### Pros

- 終了コードへの一本化を保てる
- 3つのharnessで動く

#### Cons

- harnessの承認設定と一致せず、二重管理になる
- 未知の不可逆操作を取りこぼし、承認不要の操作を過剰にブロックする
- denylistの表現形式・設定経路・既定値の保守を抱える

## Decision

選択肢1を採る。

hookの目的は承認プロンプトの可読性であり、承認要否の判定はharnessが持つ情報でしか正確に決まらない。
選択肢2・3は判定をhookに複製し、harnessの設定と乖離する。
ADR 0002がJSONを退けた根拠(キーの不一致)は、`PermissionRequest`では成り立たないことを確認したため、このイベントに限って例外とする。

## Consequences

- `PermissionRequest`で発火するhookは、拒否をexit 0 + stdoutのJSONで伝える
- JSONの`decision`には両harnessが受理する`behavior`・`message`以外のフィールドを入れない
- 実行不可はexit 1 + stderrで、両harnessとも`decision`なしとして通常の承認フローに戻る
- `PermissionRequest`を使うhookはGemini CLIで発火せず、READMEに非対応と明記する
- ADR 0002は`PermissionRequest`以外のイベントで有効のまま
