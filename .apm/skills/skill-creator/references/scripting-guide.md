# スクリプトガイド

スキルにおける依存の宣言と、エージェント向け実行を想定したスクリプト設計の完全なリファレンス。

## 依存の宣言

依存はインライン化せず宣言する。同梱スクリプトがサードパーティパッケージを必要とする場合、定義ファイルとロックファイルをスキル内に同梱し、依存を2か所で宣言する。

- `SKILL.md` の `compatibility` フロントマターフィールド。
- `SKILL.md` の `## Requirements` セクション。

依存が存在する場合は両方とも必須であり、スキルに依存が無い場合は両方とも省略する。依存の宣言をスクリプトソース内に埋め込んではならない。

### 言語ごとのパッケージマネージャ

| 言語 | パッケージマネージャ | 定義ファイル | ロックファイル | インストールコマンド |
|----------|---------|------------|----------|--------------|
| JavaScript / TypeScript | bun | `package.json` | `bun.lock` | `bun install --frozen-lockfile --production` |
| Python | uv | `pyproject.toml` | `uv.lock` | `uv sync --frozen --no-dev` |
| Ruby | bundler | `Gemfile` | `Gemfile.lock` | `bundle install` |
| PHP | composer | `composer.json` | `composer.lock` | `composer install` |

定義ファイルとロックファイルの両方をスキルに同梱し、環境を完全に再現可能にする。

### 同梱スクリプトの実行

同梱スクリプトは同期済み環境内で実行する。パッケージがグローバルにインストールされていると仮定してはならない。

```bash
# Python — run inside the uv-managed environment
uv run python scripts/extract.py

# JavaScript / TypeScript — run inside the bun-managed environment
bun scripts/extract.ts
bun run extract
```

### ロックファイルを欠く言語

Perl、PowerShell、R、Lua は標準的なロックファイルの仕組みを欠く。これらについては次のようにする。

- `## Requirements` セクションで正確なバージョンを固定する。
- スクリプトを実行する前に、固定したバージョンが存在することをエージェントが確認するための手動検証手順を文書化する。

これらの言語ではインラインの依存の仕組みを使わない。

### エージェントが行ってよい操作・行わない操作

依存パッケージはコミット済みロックファイルから同期する（`uv sync --frozen --no-dev`・`bun install --frozen-lockfile --production` 等）。これは `.venv`・`node_modules` 等のgit管理外のみを変更しgit検知の更新を生まないため、エージェントが自律実行してよい。一方、外部ツールの導入、依存宣言・ロックファイルの変更（依存の追加・更新）、代替手段へのフォールバックは行わず、停止してユーザーへエスカレーションする。依存宣言の変更はスキルの実行前に行う作業であり、タスクの途中で即興で行うものではない。

---

## エージェント向けのスクリプト設計

エージェントは次に何をするかを判断するために stdout と stderr を読む。以下の設計上の選択により、スクリプトはエージェント向けパイプライン内で信頼できるものになる。

### 対話プロンプトを使わない

**必須要件。** エージェントは非対話シェルで動作するため、TTYプロンプト、パスワードダイアログ、確認メニューに応答できない。対話入力でブロックするスクリプトは無限にハングする。

すべての入力はコマンドラインフラグ、環境変数、stdin で受け取る。

```
# Bad: hangs waiting for input
$ python scripts/deploy.py
Target environment: _

# Good: clear error with guidance
$ python scripts/deploy.py
Error: --env is required. Options: development, staging, production.
Usage: python scripts/deploy.py --env staging --tag v1.2.3
```

### `--help` で使い方を文書化する

`--help` の出力は、エージェントがスクリプトのインターフェースを学ぶ主要な手段である。簡潔な説明、利用可能なフラグ、例を含める。

```
Usage: scripts/process.py [OPTIONS] INPUT_FILE

Process input data and produce a summary report.

Options:
  --format FORMAT    Output format: json, csv, table (default: json)
  --output FILE      Write output to FILE instead of stdout
  --verbose          Print progress to stderr

Examples:
  scripts/process.py data.csv
  scripts/process.py --format csv --output report.csv data.csv
```

簡潔に保つ。出力は他のすべてと並んでエージェントのコンテキストウィンドウに入る。

### 役立つエラーメッセージを書く

エージェントがエラーを受け取ると、そのメッセージが次の試行を直接形作る。

```
# Bad — wastes a turn
Error: invalid input

# Good — actionable
Error: --format must be one of: json, csv, table.
       Received: "xml"
```

### 構造化出力を使う

自由形式のテキストより JSON、CSV、TSV を優先する。構造化された形式は `jq`、`cut`、`awk` などのツールと組み合わせられる。

```
# Bad — hard to parse programmatically
NAME          STATUS    CREATED
my-service    running   2025-01-15

# Good — unambiguous field boundaries
{"name": "my-service", "status": "running", "created": "2025-01-15"}
```

**データと診断を分離する。** 構造化データを stdout へ、進捗メッセージや警告を stderr へ送る。

### その他の考慮事項

| 観点 | 指針 |
|---------|----------|
| **冪等性** | エージェントはコマンドを再試行することがある。「重複時に失敗」より「存在しなければ作成」のほうが安全。 |
| **入力の制約** | 曖昧な入力は明確なエラーで拒否する。enum や閉じた集合を使う。 |
| **`--dry-run`** | 破壊的または状態を変える操作については、何が起こるかをエージェントがプレビューできるようにする。 |
| **終了コード** | 失敗の種類（見つからない、引数が不正、認証失敗）ごとに異なるコードを使い、`--help` に文書化する。 |
| **安全なデフォルト** | 破壊的操作には `--confirm` や `--force` フラグを要求することを検討する。 |
| **出力サイズ** | エージェントのハーネスは 10〜30K 文字を超える出力を切り詰めることがある。デフォルトは要約とし、大きな出力のために `--offset` または `--output FILE` をサポートする。 |
