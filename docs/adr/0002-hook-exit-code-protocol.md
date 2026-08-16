---
ID: 2
date: 2026-08-14
status: accepted
---

# hookの出力を終了コードへ一本化する

hookが結果を伝える手段を、終了コードとstderrに限る。
harnessが備えるstdoutのJSON出力プロトコルは使わない。
harnessは[primitiveを実行するagent runtime](https://microsoft.github.io/apm/concepts/glossary/#harness)。
primitiveは[APMが配布する最小単位](https://microsoft.github.io/apm/concepts/glossary/#primitive)。

## Context

hookは複数のharnessへ配布される([ADR 0001](./0001-adopt-apm.md))。
hookを受け取るharnessは[targets matrix](https://github.com/microsoft/apm/blob/main/docs/src/content/docs/reference/targets-matrix.md)が定め、hookの概念を持たないOpenCodeは配置対象から外れる。

各harnessは、結果を伝える系統を2つ持つ。
終了コードの扱いは次のとおり。

| harness | 終了コードの扱い |
| --- | --- |
| Claude Code | exit 2でブロック、stderrをモデルへ渡す([hooks](https://code.claude.com/docs/en/hooks)) |
| Codex | exit 2 + 非空stderrをブロックとして扱う([hooks](https://learn.chatgpt.com/docs/hooks)) |
| Gemini CLI | exit 2でstderrを理由としてブロックし、ターンは継続する([hooks reference](https://github.com/google-gemini/gemini-cli/blob/main/docs/hooks/reference.md)) |
| Antigravity CLI | 公式ドキュメントに記載がない([hooks](https://antigravity.google/docs/hooks)) |

stdoutのJSONは、harnessごとにキーが異なる。

| harness | ブロック | 追加コンテキスト | 入力の書き換え |
| --- | --- | --- | --- |
| Claude Code | `hookSpecificOutput.permissionDecision`(`allow`・`deny`・`escalate`) | `additionalContext` | `updatedInput` |
| Codex | `permissionDecision`・`decision`(`block`) | `hookSpecificOutput.additionalContext` | `updatedInput` |
| Gemini CLI | `decision`(`allow`・`deny`)＋`reason` | `hookSpecificOutput.additionalContext` | `hookSpecificOutput.tool_input` |
| Antigravity CLI | `decision`(`allow`・`deny`・`ask`・`force_ask`・`deny_unless_prior_grant`)＋`reason` | なし | なし |

キーを出し分けるには呼び出し元のharnessを判別する必要がある。
しかしhookが受け取る入力に、呼び出し元を名乗るフィールドはない。
命名はsnake_case(Claude Code・Codex・Gemini CLI)とcamelCase(Antigravity CLI・GitHub Copilot CLI)に分かれる。
harnessごとに増減するフィールドもある(Codexの`model`・`permission_mode`・`turn_id`、Gemini CLIの`timestamp`)。
これらから推定はできるが、いずれも呼び出し元の識別子としては文書化されていない。

## Choices

1. 終了コードとstderrへ一本化する
2. harnessごとのJSON出力プロトコルを使う

### 1. 終了コードとstderrへ一本化する

ブロックはexit 2 + stderr、実行不可はexit 1 + stderr、通過はexit 0・無出力とする。

#### Pros

- harnessによる分岐を持たず、実装が1つで済む
- 終了コードの扱いを確認できたharnessで、同じコードが同じように働く
- 各harnessのJSON出力仕様が変わっても影響を受けない
- 入力を抽出できないharnessでは無作用(exit 0)へ劣化し、誤判定で操作を阻害しない

#### Cons

- 条件付きの許可、ユーザーへのescalate、入力の書き換え、追加コンテキストの注入を使えない
- ブロックの理由をstderrの文字列でしか渡せない
- 効果がharnessで揃わない(Gemini CLIのexit 2はツール出力の置換で、ターンは継続する)

### 2. harnessごとのJSON出力プロトコルを使う

呼び出し元のharnessに合わせてstdoutへJSONを出し、そのharnessの制御機能を使う。

#### Pros

- 拒否に加えて、ユーザーへの確認、入力の書き換え、追加コンテキストの注入を使える
- ブロックの理由を構造化して渡せる

#### Cons

- ブロックを指示するキーがharnessで割れる(`permissionDecision`と`decision`)。
  出し分けには呼び出し元の判別が要るが、その手がかりは識別子として文書化されていない入力フィールドの差しかない
- 全harnessへ同一のJSONを出す形は、未知フィールドの扱いが各harnessの実装依存であり、公式には保証されていない
- 入力仕様が未文書化のharnessには書けない
- 各harnessのJSON仕様の変更に、個々のhookで追従しなければならない

## Decision

選択肢1を採る。

選択肢2の制御機能は実在するが、ブロック指示のキーが割れているため、使うには呼び出し元のharnessを判別する必要がある。
判別はharnessごとの入力フィールドの差から推定できるものの、その差は識別子として文書化されておらず、harnessの更新で成立しなくなる。
判別が外れると、ブロック指示が意図した効果を持たない。

終了コードは扱いを確認できたharnessで、判別なしに同じ実装が働く。
失う制御機能に対して、harness非依存で確実に働くことを優先する。

## Consequences

- hookの効果は、ブロック・非ブロック警告・通過の3値に限られる
- ユーザーへの確認や入力の書き換えを要する要件は、hookでは実現しない
- 効果のharness差は残る(Gemini CLIではブロックでなくツール出力の置換になる)
- 入力を抽出できないharnessでは、hookは無作用になる
