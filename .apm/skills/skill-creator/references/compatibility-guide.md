# 依存宣言ガイド

スキルの外部ランタイム依存を判定・文書化するための完全なガイド。

スキルは外部ランタイム依存を**一致していなければならない2か所**で宣言する。

1. `compatibility` フロントマターフィールド — 1〜2行の機械可読な要約。
2. SKILL.md本文の `## Requirements` セクション — 権威ある詳細。

スキルが依存（同梱スクリプト、パッケージ化された依存、外部CLI）を持つ場合は両者とも**必須**であり、依存を持たない場合は両者とも**省略**する。

スキルが「依存を持つ」のは、次のいずれかが存在する場合である。

- `scripts/` 配下の同梱スクリプト（Python、JavaScript、Bash、その他いずれの言語でも）。
- 定義ファイル（`pyproject.toml`、`package.json`、`Gemfile`、`composer.json`）を通じて宣言されたパッケージ化された依存。
- スキルが呼び出す外部CLIまたはインタプリタ（git、docker、jq、言語ランタイムそのもの等）。

純粋な指示・テンプレート・ワークフローのみで、スクリプト・パッケージ化された依存・外部CLIを持たないスキルは何も宣言しない。`compatibility` と `## Requirements` の両方を省略する。

## 依存の判定方法

自動的な評価ステップは存在しない。依存は手動で判定する。

1. `scripts/` を検査し、スキルが使うランタイムを特定するために言語ファイルを把握する。
2. スクリプトと各定義ファイルを読み、パッケージ化された依存を特定する。
3. スクリプトが呼び出す外部CLI／インタプリタを特定する（サブプロセス呼び出し、シェルアウト、インタプリタそのもの）。
4. 把握した内容を `compatibility` と `## Requirements` の両方で宣言する。

### スクリプト言語を確認する

```bash
# List all scripts
ls -la scripts/

# Count by extension
find scripts/ -type f -name "*.py"  | wc -l    # Python
find scripts/ -type f -name "*.js"  | wc -l    # JavaScript / TypeScript
find scripts/ -type f -name "*.sh"  | wc -l    # Bash
# Repeat for .rb, .php, .pl, .ps1, .r, .lua
```

### 依存パッケージを特定する

標準的なロックファイル方式のパッケージマネージャを持つ言語では、パッケージ化された依存は定義ファイルに記述され、ロックファイルで固定される。importから推測するのではなく、これらのファイルを読む。

```bash
# Python
cat scripts/pyproject.toml

# JavaScript / TypeScript
cat scripts/package.json

# Ruby
cat scripts/Gemfile

# PHP
cat scripts/composer.json
```

### 外部ツールを特定する

スクリプトは外部CLIへシェルアウトすることがある。それらを走査する。

```bash
# Bash scripts
grep -h -w -E "(git|docker|jq|curl|wget|convert|ffmpeg|pandoc)" scripts/*.sh \
  | grep -v "^#" | sort -u

# Python / Node subprocess calls
grep -h -E "subprocess|child_process|execa|spawn|exec" scripts/*.py scripts/*.js 2>/dev/null
```

言語インタプリタそのもの（例: `python`、`node`、`bash`）も外部ツールであり、「External tools」サブセクションに属する。

## `compatibility` フロントマターフィールド

環境が提供しなければならないものの1〜2行の機械可読な要約。`## Requirements` の詳細を反映するものであり、それを置き換えるものではない。

```yaml
# Python skill with packaged deps and the uv toolchain
compatibility: |
  Required: uv; Python deps via uv sync --frozen --no-dev (pyproject.toml + uv.lock)

# JavaScript / TypeScript skill
compatibility: |
  Required: bun; JS/TS deps via bun install --frozen-lockfile --production (package.json + bun.lock)

# Bash skill calling external tools
compatibility: |
  Required: Bash, git, jq

# Lock-deficient language (exception clause)
compatibility: |
  Required: Perl 5.36.0 exactly; modules JSON 4.10, LWP 6.72 (manual verification)
```

`compatibility` に `TODO` プレースホルダを残してはならない。検証はそれをエラーとして扱う。

## `## Requirements` セクション

権威ある詳細はSKILL.md本文に置く。前文と最大2つのサブセクションを持つ。

### 前文

Agentが従うべき規約を明記する。

```markdown
## Requirements

Sync packaged dependencies from the committed lockfile before use (e.g. `uv sync --frozen --no-dev`) —
this touches only gitignored paths (`.venv`, `node_modules`) and is safe for the Agent
to run. **Stop and escalate to the user** only if an external tool is missing, if
dependencies must be added or updated, or if a fallback would be needed — the Agent
never installs external tools, changes dependency declarations or lockfiles, or falls
back to alternatives.
```

### 「依存パッケージ」サブセクション

スキルがパッケージ化された依存を持つ場合にこのサブセクションを含める。定義ファイルとロックファイルをスキル内に同梱し、再現性のために両者を通じてバージョンを固定する。

````markdown
### Dependency packages

| Language | Package manager | Definition file  | Lockfile          | Install command  |
|----------|-----------------|------------------|-------------------|------------------|
| Python   | uv              | pyproject.toml   | uv.lock           | `uv sync --frozen --no-dev` |

Sync dependencies from the committed lockfile (safe for the Agent to run):

```bash
uv sync --frozen --no-dev
```
````

言語ごとのパッケージマネージャ（標準的なロックファイル方式のパッケージマネージャを**持つ**言語）。

| 言語 | パッケージマネージャ | 定義ファイル | ロックファイル | インストールコマンド |
|-----------------------|-----------------|------------------|-------------------|-------------------|
| JavaScript/TypeScript | bun             | package.json     | bun.lock          | `bun install --frozen-lockfile --production` |
| Python                | uv              | pyproject.toml   | uv.lock           | `uv sync --frozen --no-dev` |
| Ruby                  | bundler         | Gemfile          | Gemfile.lock      | `bundle install`  |
| PHP                   | composer        | composer.json    | composer.lock     | `composer install`|

ロックファイルは常に定義ファイルとともに同梱する。ロックファイルを伴わない定義ファイルは検証エラーになる。

### 「外部ツール」サブセクション

スキルが外部CLIまたはインタプリタを呼び出す場合にこのサブセクションを含める。どのツールでどのバージョンかを文書化する。インストール方法は文書化**しない** — インストールは環境固有であり対象外。

````markdown
### External tools

| Tool | Version requirement |
|------|---------------------|
| uv   | any                 |
| git  | 2.30+               |

Check that the tools exist:

```bash
command -v uv  >/dev/null 2>&1 || { echo "uv not found; stop and escalate." >&2; exit 1; }
command -v git >/dev/null 2>&1 || { echo "git not found; stop and escalate." >&2; exit 1; }
```
````

## 同梱スクリプトの実行

同梱スクリプトは、固定された依存を使うよう同期済み環境内で実行する。

```bash
# Python: run inside the uv environment
uv run python scripts/process.py <args>

# JavaScript / TypeScript: run through bun
bun scripts/process.ts <args>
bun run build
```

## 言語ごとの注意

### 標準ロックファイルのパッケージマネージャを持つ言語

JavaScript/TypeScript、Python、Ruby、PHPでは、上記の定義ファイルとロックファイルを通じてパッケージ化された依存を宣言する。バージョンはロックファイルで固定し、両ファイルを同梱する。ランタイムとパッケージマネージャ（JavaScript/TypeScriptは`bun`が両者を兼ねる、Pythonは`python`+`uv`、Rubyは`ruby`+`bundler`、PHPは`php`+`composer`）は「External tools」サブセクションに置く。

### Bash

Bashスクリプトにはパッケージ化された依存を扱うマネージャがない。通常は外部ツールのみに依存する。各外部CLIを「External tools」サブセクションに列挙する。一般的なシステムユーティリティ（`grep`、`sed`、`awk`、`cut`、`sort`、`find`、`tar`、`gzip`）は存在すると想定し列挙の必要はない。より普遍的でないツール（`git`、`docker`、`jq`、`curl`、`wget`、`ffmpeg`、`pandoc`）は列挙しなければならない。

### ロックファイルを欠く言語 — 文書化された例外

Perl、PowerShell、R、Lua、および類似の言語には標準的なロックファイル方式のパッケージマネージャがない。これらでは次のようにする。

1. インタプリタおよび全モジュールの**正確な**バージョンを `## Requirements` で固定する。
2. Agentが使用前に実行する手動の検証ステップを文書化する。
3. インラインの依存メカニズムは一切使わ**ない**。

````markdown
### External tools

| Tool      | Version requirement |
|-----------|---------------------|
| perl      | 5.36.0 exactly      |

### Dependency packages (manual verification)

This language has no lockfile package manager. The following modules must be present
at the exact versions shown:

| Module | Version |
|--------|---------|
| JSON   | 4.10    |
| LWP    | 6.72    |

```bash
perl -e 'use JSON 4.10; use LWP 6.72;' 2>/dev/null \
  || { echo "Required Perl modules missing or wrong version; stop and escalate." >&2; exit 1; }
```
````

## 検証

`quick_validate.py` は依存宣言を検査する。import解析は**行わない**。

次のいずれかの存在から**依存シグナル**を算出する。

- 依存定義ファイル（`pyproject.toml`、`package.json`、`Gemfile`、`composer.json`）。
- ロックファイル。
- `scripts/` 配下の任意のスクリプトファイル。

次の場合に**エラー**を報告する。

- `name` または `description` が欠落している（依存の有無に関係なく常に）。
- 依存シグナルが存在するのに `compatibility` フィールドが欠落している。
- 依存シグナルが存在するのに `## Requirements` セクションが欠落している。
- 定義ファイルが存在するのに対応するロックファイルがない。
- `compatibility` フィールドに `TODO` プレースホルダが含まれている。

依存シグナルがない場合、`compatibility` と `## Requirements` の両方は任意である。

依存を宣言した後に実行する。

```bash
uv run python scripts/quick_validate.py <skill-directory>
```

## まとめのチェックリスト

スキルを確定する前に。

- [ ] 依存を手動で判定した（`scripts/`、定義ファイル、外部コマンドを検査した）。
- [ ] スキルが依存を持つ場合: `compatibility` と `## Requirements` の両方が存在し一致している。
- [ ] スキルが依存を持たない場合: 両方が省略されている。
- [ ] `compatibility` が完備している（`TODO` がない）。
- [ ] `## Requirements` の前文が「依存パッケージはロックファイルから同期（Agentが実行してよい）、外部ツール不在・依存の追加更新・フォールバックが必要なら停止・エスカレーション」という規約を明記している。
- [ ] パッケージ化された依存が表で宣言され、定義ファイルとロックファイルの両方が同梱されている。
- [ ] 外部ツールがバージョン要件とともに列挙されている（インストール手順はない）。
- [ ] ロックファイルを欠く言語は正確なバージョンを固定し、手動チェックを文書化している。
- [ ] 検証が通る: `uv run python scripts/quick_validate.py .`
