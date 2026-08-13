---
ID: 1
date: 2026-08-14
status: accepted
---

# APMをパッケージ配布の仕組みに採用する

このリポジトリのprimitiveを、APM([microsoft/apm](https://github.com/microsoft/apm))のパッケージとして配布する。
primitiveは[APMが配布する最小単位](https://microsoft.github.io/apm/concepts/glossary/#primitive)。
harnessは[primitiveを実行するagent runtime](https://microsoft.github.io/apm/concepts/glossary/#harness)。
1つのソースを複数のharnessへ配置する手段としてAPMを採り、harnessごとの配布機構は使わない。

## Context

このリポジトリはAI Agent向けのprimitiveを配布する。
このADRを書いた時点の内容はスキルとhookだが、APMが扱う他の種別(instructions・prompts・agents・commands・MCP servers)も配布の対象になりうる。

同じprimitiveを、Claude Code・Codex・Antigravity CLI・GitHub Copilot CLIなど複数のharnessで使う。
harnessごとに配置先ディレクトリと期待するファイル形式が異なり、hookのイベント名の規約も異なる(Claude Codeの`PreToolUse`はGemini CLIでは`BeforeTool`)。
1つのソースを保ったまま、この差を吸収して配る手段を選ぶ必要がある。

## Choices

1. APMのパッケージとして配布する
2. harnessごとにネイティブの配布機構を使う
3. vercel-labs/skillsで配布する

### 1. APMのパッケージとして配布する

`apm.yml`と`.apm/`配下のprimitiveを持つパッケージとして配布し、`apm install`が各harnessのディレクトリへ配置する。

#### Pros

- 1つの`.apm/`ツリーから、APMが対応する12ターゲットへ配置できる([targets matrix](https://github.com/microsoft/apm/blob/main/docs/src/content/docs/reference/targets-matrix.md))
- スキルとhookを同じ仕組みで配れる
- hookのイベント名をターゲットごとに変換するため、hook定義ファイルは1つでよい([hook_integrator.py](https://github.com/microsoft/apm/blob/main/src/apm_cli/integration/hook_integrator.py))
- `apm.lock.yaml`がコミットSHAとファイルの内容ハッシュを固定する

#### Cons

- APM本体の導入が、このパッケージを使う環境の前提になる
- APMが対応していない種別・機能は扱えない(Claude CodeのLSP・monitors等)
- APMの仕様変更に追従する必要がある

### 2. harnessごとにネイティブの配布機構を使う

harnessが備える配布機構をそれぞれ使う。
Claude Code・Codex・GitHub Copilot CLI・Antigravity CLIはplugin、Gemini CLIはextensionを持つ。

#### Pros

- harnessの機能をそのまま使える。
  Claude Codeのpluginはskills・hooks・agents・MCP・LSP・monitorsを載せられる([Claude Code plugins](https://code.claude.com/docs/en/plugins))
- 配布のための追加ツールが要らない
- 公開とバージョン管理の経路が用意されている
  - Codexの[plugins](https://learn.chatgpt.com/docs/plugins)
  - GitHub Copilot CLIの[plugins](https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-cli-plugins)
  - Antigravity CLIの[plugins](https://antigravity.google/docs/cli/features)

#### Cons

- 対応するharnessの数だけ配布物が増え、同じ内容をharnessごとの形式へ写す必要がある
- 写した先が独立に更新されるため、内容が乖離する
- 各機構の配布範囲がその製品に閉じる(Codex pluginはChatGPTとCodexの共通ディレクトリから配布される)

### 3. vercel-labs/skillsで配布する

[vercel-labs/skills](https://github.com/vercel-labs/skills)のCLI(`npx skills add`)で、リポジトリのスキルを各agentのディレクトリへ配置する。

#### Pros

- 76以上のagentへ配置でき、対応範囲が広い
- symlinkとcopyを選べる
- パッケージマニフェストを持たなくても配れる

#### Cons

- READMEが定める配布単位はskillで、hookを配れない
- hookを別経路で配ることになり、配布の仕組みが2つに分かれる

## Decision

選択肢1を採る。

複数種別のprimitiveを、1つのソースから複数のharnessへ配れるのはAPMだけである。
選択肢3はスキルしか配れず、hookの配布経路を別に用意することになる。
選択肢2はharnessの機能を最大限使えるが、配布物がharnessの数だけ増え、内容の同期が継続的な負担になる。
APMが対応していない機能を使えないことは、hookの出力をharness非依存の手段へ一本化する判断([ADR 0002](./0002-hook-exit-code-protocol.md))と方向が一致しており、失うものが小さい。

## Consequences

- APM本体の導入が、このパッケージを使う環境の前提になる
- 依存パッケージ・外部ツールはAPMが供給しないため、各primitiveが自身の依存を宣言する([ADR 0003](./0003-no-external-tool-install.md))
- 配布できる範囲はAPMが対応するターゲットに限られる
- APMの配置仕様・イベント名の変換仕様が変わった場合、追従が必要になる
