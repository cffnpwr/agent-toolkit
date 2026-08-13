# Hook機構

hookは、[harnessのライフサイクルイベントで実行されるprimitive](https://microsoft.github.io/apm/concepts/glossary/#hook)。
`.apm/hooks/`に置き、個別hookの実装はこの方針に従う。

## 配置

```text
.apm/hooks/
├─ <hook名>.json    # hook定義ファイル
└─ scripts/         # 実装
```

- APMはhook定義ファイルを`.apm/hooks/`直下の`glob("*.json")`で探索する([plugin_exporter.py](https://github.com/microsoft/apm/blob/main/src/apm_cli/bundle/plugin_exporter.py)・[validation.py](https://github.com/microsoft/apm/blob/main/src/apm_cli/models/validation.py))。
  サブディレクトリは対象外のため、`scripts/`配下の`package.json`・`tsconfig.json`等がhook定義ファイルとして誤検知されることはない。
- hook定義ファイルが指定するイベント名は、APMがターゲットごとに変換する(`PreToolUse`はGemini CLIでは`BeforeTool`)([hook_integrator.py](https://github.com/microsoft/apm/blob/main/src/apm_cli/integration/hook_integrator.py))。
- hookを受け取るharnessは[targets matrix](https://github.com/microsoft/apm/blob/main/docs/src/content/docs/reference/targets-matrix.md)が定める。
  hookの概念を持たないOpenCodeはskipされる。

## 入力と出力

### 入力

- hookが必要とする情報(コマンド文字列等)は、各harnessのhook入力フィールドから取り出す。
  フィールド名・構造はharnessごとに異なるため、対応するharnessの公式仕様・実装を確認してから列挙する。
- 入力を抽出できないharnessでは無作用(exit 0)へ劣化する設計とし、誤判定で操作を阻害しない。
- どのharnessに対応し、どれを対象外とするかは、確認できたフィールドの有無で決める。
  未文書化のフィールドを推測で使わない。

### 出力

効果は終了コードとstderrへ一本化する。
harness固有のJSON出力プロトコルには頼らない([ADR 0002](../adr/0002-hook-exit-code-protocol.md))。

| 状況 | 出力 | 意味 |
| --- | --- | --- |
| 違反・ブロック | exit 2 + stderr | 違反内容をAgentにフィードバックさせる |
| 実行不可(fail-open) | exit 1 + stderr | 非ブロックの警告として通す |
| 通過・対象外 | exit 0・無出力 | 何もしない |

終了コードの意味と各harnessでの実挙動は、各harnessの公式hook仕様・実装で確認する(記憶や推測で断定しない)。
AI Agentへ渡すフィードバック・警告は簡単な英語で出力する。

## 発火イベントの選択

- 操作を止めることが目的なら、操作が適用される前のイベントを選ぶ。
  適用後では変更が済んでおり間に合わない。
  適用前は実状態を読めないため入力を解析して対象を判定することになり、誤判定で正当な操作を阻害しないよう、対象と確信できるときだけ作用させる。
- 操作結果の検証が目的なら、適用後のイベントを選び、結果を一次ソースとして読み直す。
  入力から意図を再構成する場合と違い、入力の渡し方(引数・標準入力・変数展開等)に左右されない。
  結果の読み取りが実行形態に妨げられる場合は、適用前に入力から判定する。
- 選べるイベントと発火の条件は各harnessの公式hookドキュメント、hook定義ファイルのイベント名との対応は[hook_integrator.py](https://github.com/microsoft/apm/blob/main/src/apm_cli/integration/hook_integrator.py)を参照する。

## 依存の扱い

- hookの外部依存は、当該hookのREADME(`.apm/hooks/scripts/<hook名>/README.md`)の`## Requirements`節に記載する([設計原則](./principles.md))。
- 依存パッケージは、それを読み込むディレクトリが自身の定義ファイル・ロックファイルで宣言する。
- 起動スクリプトは、本体を起動する前に、shellで対象外の入力を除外する。
- 起動スクリプトが外部ツールの存在確認を行い、不在時はfail-open警告を出して通す。
- 同梱した依存パッケージは、起動スクリプトがロックファイルから同期してから本体を起動する。
  発火ごとにロックファイルどおりの同期を実行し(同期済みなら確認のみで安価に済み、ファイルの存在に基づく判定の偽陰性を避ける)、同期失敗時はfail-open警告を出して通す。
- 依存の導入・代替手段へのフォールバックはhookが行わず、ユーザーへ委ねる([ADR 0003](../adr/0003-no-external-tool-install.md))。
  hookは非対話で発火するため、進行の停止に代えて警告して通す。
