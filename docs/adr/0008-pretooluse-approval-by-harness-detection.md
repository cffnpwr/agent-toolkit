---
ID: 8
date: 2026-11-16
status: accepted
---

# PreToolUseで承認を求めるhookは、Claude Codeを判別してJSONの`ask`を使う

ユーザーの承認を要する操作を扱う`PreToolUse`のhookは、呼び出し元がClaude Codeのときだけ、stdoutのJSONで`permissionDecision: "ask"`を返す。
Claude Code以外のharnessでは[ADR 0002](./0002-hook-exit-code-protocol.md)の終了コード（exit 2 + stderr）でブロックする。
Claude Codeの判別には環境変数`CLAUDE_CODE_SESSION_ID`とhook入力の`session_id`の一致を使う。

## Context

git-hook-bypass-guardとgit-config-modify-guardは、git hookを実行させないgitコマンド・gitの設定を書き換えるコマンドを扱う。
これらの操作は正当な場合もあるため、一律にブロックせず、ユーザーが実行の可否を決められるようにしたい。

ADR 0002はhookの出力を終了コードとstderrに限り、効果をブロック・非ブロック警告・通過の3値にした。
このため、ユーザーに承認を求める出力は使えない。

各harnessの、`PreToolUse`で承認を求める出力の扱いは次のとおり。

| harness | 承認を求める出力の扱い |
| --- | --- |
| Claude Code | `hookSpecificOutput.permissionDecision: "ask"`でユーザーに確認を求め、`permissionDecisionReason`を承認プロンプトに表示する（[hooks#pretooluse-decision-control](https://code.claude.com/docs/en/hooks#pretooluse-decision-control)）。auto modeでも通常は承認プロンプトへ送り、分類器は判定しない（[hooks#pretooluse-ask-decisions-in-auto-mode](https://code.claude.com/docs/en/hooks#pretooluse-ask-decisions-in-auto-mode)） |
| Codex | `PreToolUse`の`permissionDecision: "ask"`を未対応として扱い、hookを失敗とみなしてツールを実行する（openai/codex `codex-rs/hooks/src/engine/output_parser.rs:441-482`、特に459行目・`codex-rs/core/src/hook_runtime.rs:239-241` @ a7aab624。[hooks](https://learn.chatgpt.com/docs/hooks)） |
| GitHub Copilot CLI | `.claude/settings.json`のhookも実行し、Claude Codeと同じ形の入力を渡す。0以外の終了コードを拒否として扱う（github/docs `content/copilot/reference/hooks-reference.md:39,461-482,501` @ 983a7880） |
| Antigravity CLI | 終了コードの扱いが公式ドキュメントに記載されていない（[hooks](https://antigravity.google/docs/hooks)）。1.5.9では、0以外の終了コードでツールの実行を止めることを確認した |
| OpenCode | 外部コマンドを実行するhookを持たない（microsoft/apm `src/apm_cli/integration/targets.py:620` @ 64a7fb51） |

Claude Codeで承認を求め、Codexでブロックする単一の出力はない。
Codexは`ask`を未対応としてツールを実行するため、`ask`のJSONをそのまま返すとCodexではfail-openになる。
一方、Claude Codeはexit 2を受け取ると、確認を求めずにブロックする。
このため、出力を分けるには呼び出し元の判別が必要である。

ADR 0002は、判別の手がかりが識別子として文書化されていない入力フィールドの差異しかないことを理由に、JSON出力を退けた。
Claude Codeには判別に使える文書化された値がある。
Claude Codeは環境変数`CLAUDE_CODE_SESSION_ID`をhookのサブプロセスに設定し、その値はhook入力の`session_id`と一致する（[env-vars](https://code.claude.com/docs/en/env-vars)）。
他の候補は次の理由で使わない。

| 候補 | 使わない理由 |
| --- | --- |
| `CLAUDECODE` | IDE拡張も統合ターミナルに設定する（[env-vars](https://code.claude.com/docs/en/env-vars)）。Claude Codeが起動したシェルから別のharnessを起動した場合も、子プロセスに引き継がれる |
| `CLAUDE_PROJECT_DIR` | Gemini CLIも互換性のために設定する（google-gemini/gemini-cli `packages/core/src/hooks/hookRunner.ts:348-356` @ aeb6c04b） |

Codexはhookの環境にharnessを識別する環境変数を設定しない（openai/codex `codex-rs/hooks/src/registry.rs:83` @ a7aab624）。
そのため、Codexを直接判別できない。

## Choices

1. 終了コード（exit 2）だけでブロックする
2. 判別せずにJSONの`ask`を返す
3. Claude Codeを判別し、Claude Codeでは`ask`、それ以外ではexit 2を返す

### 1. 終了コード（exit 2）だけでブロックする

ADR 0002のとおり、検知したらexit 2 + stderrでブロックする。

#### Pros

- harnessによる分岐がなく、ADR 0002の出力プロトコルを変えない
- 終了コードの扱いを確認できたharnessで同じように働く

#### Cons

- Claude Codeでも、正当な操作をユーザーの承認で実行する手段がない
- ブロックされたCoding Agentがユーザーに実行を依頼する手間が毎回発生する

### 2. 判別せずにJSONの`ask`を返す

検知したら、全てのharnessでexit 0 + stdoutの`ask`のJSONを返す。

#### Pros

- harnessによる分岐がない
- Claude Codeではユーザーに承認を求められる

#### Cons

- Codexでは`ask`を未対応としてツールを実行するため、検知した操作がそのまま実行される
- `ask`を解釈しないharnessではhookが無作用になる

### 3. Claude Codeを判別し、Claude Codeでは`ask`、それ以外ではexit 2を返す

`CLAUDE_CODE_SESSION_ID`が空でなく、hook入力の`session_id`と一致するときにClaude Codeと判定する。
Claude Codeではexit 0 + stdoutの`ask`のJSONを返し、それ以外ではexit 2 + stderrを返す。

#### Pros

- Claude Codeでは、ユーザーが正当な操作を承認できる
- Claude Code以外では、ADR 0002と同じくブロックする
- 判別を誤ってClaude Code以外と判定した場合も、結果はブロックであり、操作は実行されない
- `session_id`との一致を条件にするため、Claude Codeから起動した別のharnessが環境変数を引き継いでも、Claude Codeとは判定しない

#### Cons

- 出力プロトコルがharnessで分かれ、hookの実装者が使い分けを覚える必要がある
- 他のharnessが`CLAUDE_CODE_SESSION_ID`に`session_id`と同じ値を設定すると、hookはそのharnessをClaude Codeと誤って判定する
- hookがClaude Codeと誤って判定したharnessが`ask`に対応していない場合、検知した操作が実行される
- Claude Codeの環境変数とJSON出力の仕様が変わると、このhookの実装を更新しなければならない
- Claude Code以外では正当な操作でもユーザーに承認を求められない

## Decision

選択肢3を採る。

選択肢1はClaude Codeで承認を求める手段を失い、選択肢2はCodexでfail-openになる。
選択肢3は文書化された環境変数と入力フィールドの一致でClaude Codeを判別する。
ADR 0002がJSONを退けた根拠（判別の手がかりが文書化されていない）は、Claude Codeの判別では成り立たないことを確認した。
Claude Codeと判定できない呼び出しはADR 0002のブロックに戻るため、Claude Code以外と誤って判定しても検知した操作は実行されない。

## Consequences

- 承認を要する`PreToolUse`のhookは、Claude Codeでexit 0 + stdoutの`ask`のJSONを返す
- Codex・GitHub Copilot CLIではexit 2 + stderrでブロックする
- exit 2のstderrではCoding Agentに対して、応答でユーザーに承認を求めてから、承認を得た場合に限り無効化の前置代入を付けて再実行するよう指示する
- 前置代入による無効化（`GIT_HOOK_BYPASS_GUARD_DISABLE=1 git ...`等）はClaude Code以外でだけ働き、そのコマンドだけを判定の対象から外す
- Claude Codeでは前置代入を無視して`ask`を返すため、Coding Agentが前置代入を付けてもユーザーの承認を省略できない
- Claude Code以外ではCoding Agentがユーザーの承認を得ずに前置代入を付けることを防げない
- Antigravity CLIはコマンドを`toolCall.args.CommandLine`に入れるため、hookはコマンドを取り出せずに通過させる
- Gemini CLIはこのhookの対象外とする
- OpenCodeは外部コマンドを実行するhookを持たないため、対象外とする
- allowルールと一致する呼び出しに対してhookが`ask`を返したときのClaude Codeの挙動は、公式ドキュメントで明記されていないため未確認である
- 承認プロンプトに応答する者がいない`-p`での実行では、Claude Codeが呼び出しを拒否することがある（[hooks#pretooluse-decision-control](https://code.claude.com/docs/en/hooks#pretooluse-decision-control)）
- ADR 0002は、この決定の対象外のhookで有効のまま
