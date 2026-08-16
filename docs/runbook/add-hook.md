# hookを追加する

次の2つを置く。
設計上の規約は[Hook機構](../design-doc/hooks.md)にある。

- `.apm/hooks/<hook名>.json`: hook定義ファイル
- `.apm/hooks/scripts/<hook名>/`: 実装。
  hook定義ファイルが指す起動スクリプトと本体を置く

外部依存は、同じディレクトリのREADMEの`## Requirements`節に記載する。

検証は、実装言語のツールでlint・型チェック・テストを流す。
CIは`.github/workflows/hooks-check.yaml`が定義しており、手元では同じものをそのhookのディレクトリで実行する。
