# 全体アーキテクチャ

## リポジトリ構成

このリポジトリはAPM([microsoft/apm](https://github.com/microsoft/apm))のパッケージとして配布する。
パッケージは[`apm.yml`を持つディレクトリ](https://microsoft.github.io/apm/concepts/glossary/#package)。
primitiveはAPMが配布する最小単位で、種別にはinstructions・skills・prompts・agents・hooks・commands・MCP serversがある。

primitiveは配布対象として`.apm/`配下に種別ごとのディレクトリで置く。

```text
.
├─ apm.yml              # パッケージのメタ情報
├─ docs/                # ドキュメント
├─ tools/               # 開発ツール
└─ .apm/
   ├─ skills/           # <スキル名>/SKILL.md + 同梱リソース
   └─ hooks/            # <hook名>.json + scripts/<hook名>/
```

スキルの内部構成はskill-creatorスキル、hookの配置規約は[Hook機構](./hooks.md)が定める。

## 配布の仕組み

`apm install`は依存を解決したうえで、`.apm/`配下の各primitiveを、対象として検出した各harnessのディレクトリへ配置する。
配置先のディレクトリと期待するファイル形式はharnessごとに異なり、APMがその差を吸収する。
どのharnessがどの種別のprimitiveを受け取れるかは[targets matrix](https://github.com/microsoft/apm/blob/main/docs/src/content/docs/reference/targets-matrix.md)が定める。

APMはprimitiveのファイルを配置するが、primitiveが実行時に使う依存パッケージ・外部ツールを導入する仕組みを持たない。
このため各primitiveは自身の外部依存を宣言し、実行環境に導入済みであることを前提に動作する([設計原則](./principles.md)・[ADR 0003](../adr/0003-no-external-tool-install.md))。

APMを採用した判断は[ADR 0001](../adr/0001-adopt-apm.md)に置く。
