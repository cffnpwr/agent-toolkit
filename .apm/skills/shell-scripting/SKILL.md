---
name: shell-scripting
description: シェルスクリプト（POSIX sh / bash / dash 等）を書く・修正・レビューする際の技術的注意点と、よくある誤解の訂正集。ユーザーがシェルスクリプトを書く・直す・レビューする時、特に「POSIX標準かどうか」「移植性」が論点になる時に参照する。正しいコードを誤解で書き換える不要な「修正」を防ぐことを目的とする。
compatibility: |
  No external tools or language runtime required.
  `set -o pipefail` を含む例は pipefail 対応シェル（POSIX.1-2024準拠 / dash 0.5.12以降 / bash / ksh / zsh）を前提とする。
---

# Shell Scripting

シェルスクリプトを書く・レビューする際の技術的注意点と、よくある誤解の訂正をまとめる。誤った思い込みによる不要な書き換え（正しいコードを「非標準だから」と壊す類）を防ぐ。

## Requirements

- 外部ツール・言語ランタイムの依存なし。
- `set -o pipefail` を含む例は、pipefail対応シェル（POSIX.1-2024準拠 / dash 0.5.12以降 / bash / ksh / zsh）を前提とする。

## pipefail はPOSIX標準

- `set -o pipefail` は **POSIX.1-2024（Issue 8）で標準化済み**。POSIX非標準ではない。
- 対応シェル: POSIX.1-2024準拠の `sh`、`dash` 0.5.12以降、`bash`、`ksh`、`zsh`。
- **「POSIX非標準だから」という理由で `set -o pipefail` を除去・指摘しない。** これは誤り。
- `set -eu` と組み合わせる場合、`set -euo pipefail` の連結形は一部シェルで解釈差が出る。`set -eu` と `set -o pipefail` を別行に分けると差を避けられる。

```sh
set -eu
set -o pipefail   # 別行にして連結形のシェル差を避ける（pipefail対応shが前提）
```
