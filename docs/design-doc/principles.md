# 設計原則

agent-toolkit全体に共通する設計上の原則を定める。
このリポジトリが配布するすべてのprimitiveに適用する。

## 前提

primitiveは[APMが配布する最小単位](https://microsoft.github.io/apm/concepts/glossary/#primitive)。
harnessは[primitiveを実行するagent runtime](https://microsoft.github.io/apm/concepts/glossary/#harness)。

外部依存とは、このリポジトリが配布するファイル以外で、primitiveの実行に必要なものを指す。
次の2種に分ける。

- 依存パッケージ: プログラミング言語のパッケージマネージャで導入するライブラリ
- 外部ツール: CLI・インタプリタ・パッケージマネージャ本体など、プログラミング言語のパッケージマネージャでは導入しない実行ファイル

## 外部依存は実行環境に導入済みであることを前提とする

APMはprimitiveのファイルを各harnessへ配置するが、primitiveが実行時に使う外部依存を導入する仕組みを持たない([全体アーキテクチャ](./architecture.md))。
各primitiveは自身の外部依存を宣言し、それが実行環境に導入済みであることを前提に動作する。
依存の導入は環境側の責務であり、primitiveの責務ではない([ADR 0003](../adr/0003-no-external-tool-install.md))。

## 外部依存を明示宣言する

依存パッケージは、同梱した定義ファイルとロックファイルでバージョンを固定する。
外部ツールは、バージョン要件とともに列挙する。
宣言の場所と書き方は、スキルはskill-creatorスキル、hookは[Hook機構](./hooks.md)が定める。

## 決定論的な操作のみ自律実行する

結果が入力から一意に決まり、変更がprimitiveの内部に閉じる操作は、停止・エスカレーションなしに実行してよい。
コミット済みロックファイルからの依存同期(`bun install --frozen-lockfile`・`uv sync --frozen`等)がこれに当たる。
変更は`node_modules`・`.venv`に閉じ、インストールされるバージョンはロックファイルが固定する。

外部ツールの導入、依存の追加・更新、代替手段へのフォールバックは行わない。
primitiveが宣言するバージョンと実行時のバージョンが一致しなくなるためである([ADR 0003](../adr/0003-no-external-tool-install.md))。
外部依存を満たせない場合、対話で使うスキルは進行を停止してユーザーへエスカレーションし、非対話で発火するhookは停止の代わりに警告して通す([Hook機構](./hooks.md))。

## Harness非依存に設計する

primitiveは複数のharnessへ配布される。
特定のharness専用の制御手段に依存せず、対応する全harnessで成立する手段へ一本化する([ADR 0002](../adr/0002-hook-exit-code-protocol.md))。
対応できないharnessでは無作用へ劣化させ、誤判定で操作を阻害しない。
