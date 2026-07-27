---
name: markdown-standards
description: >
  Markdownの文書品質を、markdownlint-cli2による静的解析とAIによる補完レビューで担保する。
  (1) Markdownを書く・編集するとき、
  (2) 既存のMarkdownの品質をレビューするとき、
  (3) markdownlintのエラーを修正するときに使う。
  markdownlint-cli2の実行、設定の優先順位、結果の解釈、誤検出の抑制、
  markdownlintでは検出できないルールを扱う。
compatibility: |
  Required: bun >= 1.2; packages: markdownlint-cli2（package.json / bun.lock 経由）
---

# Markdown品質 — markdown-standards

markdownlint-cli2による静的解析とAIによる補完レビューを組み合わせて、Markdownの文書品質を担保する。

## Requirements

使用前に依存パッケージをロックファイルから同期する（`bun install --frozen-lockfile --production`）。これは`node_modules/`のみを変更しgit管理外のためAgentが実行してよい。
依存の追加・更新、外部ツールの導入、代替手段へのフォールバックが必要な場合は、進行を停止しユーザーへエスカレーションする。

### 依存パッケージ

| 言語 | パッケージマネージャ | 定義ファイル | ロックファイル | インストールコマンド |
| --- | --- | --- | --- | --- |
| JavaScript / TypeScript | bun | `package.json` | `bun.lock` | `bun install --frozen-lockfile --production` |

```sh
bun install --frozen-lockfile --production
```

### 外部ツール

| ツール | バージョン要件 |
| --- | --- |
| bun | `>= 1.2`（`bun.lock`のテキスト形式がデフォルトになったバージョン） |

```sh
command -v bun >/dev/null 2>&1 || { echo "bun not found." >&2; exit 1; }
```

## markdownlint-cli2の実行

`SKILL_DIR`にこのSKILL.mdが置かれたディレクトリの絶対パスを設定する。同梱の`node_modules/`にはグローバルインストール不要で実行できるエントリポイントが入っている。

```sh
SKILL_DIR=<このSKILL.mdが置かれたディレクトリの絶対パス>
```

**コマンドは対象リポジトリのルートで実行する。** 設定の`gitignore: true`はコマンドを実行したディレクトリを起点に`.gitignore`を集めるため、リポジトリ外で実行すると走査範囲が無関係なディレクトリ全体へ広がる。対象ファイルはリポジトリルートからの相対パスで指定する。

```sh
# 単一ファイルをチェック
bun "$SKILL_DIR/node_modules/markdownlint-cli2/markdownlint-cli2-bin.mjs" \
  --config "$SKILL_DIR/.markdownlint-cli2.yaml" path/to/file.md

# リポジトリ全体をチェック
bun "$SKILL_DIR/node_modules/markdownlint-cli2/markdownlint-cli2-bin.mjs" \
  --config "$SKILL_DIR/.markdownlint-cli2.yaml" "**/*.md"

# 自動修正可能なエラーを修正
bun "$SKILL_DIR/node_modules/markdownlint-cli2/markdownlint-cli2-bin.mjs" --fix \
  --config "$SKILL_DIR/.markdownlint-cli2.yaml" "**/*.md"
```

対象リポジトリに独自の設定ファイルがある場合は`--config`を外し、markdownlint-cli2の自動探索に任せる。

インストール確認は次のコマンドで行う。MD032が検出されることを確認する。

```sh
cd "$(mktemp -d)"
printf '# 見出し\n\n説明文です。\n- 項目A\n' > check.md
bun "$SKILL_DIR/node_modules/markdownlint-cli2/markdownlint-cli2-bin.mjs" \
  --config "$SKILL_DIR/.markdownlint-cli2.yaml" check.md
```

> textlint等の日本語向けLinterが使用可能であれば、markdownlintが扱わない文章表現の問題も別途確認する。

## 設定の優先順位

markdownlint-cli2は次の順で設定ファイルを探索し、最初に見つかったものを使う。

1. `.markdownlint-cli2.jsonc`
2. `.markdownlint-cli2.yaml`
3. `.markdownlint-cli2.cjs` / `.markdownlint-cli2.mjs`
4. `.markdownlint.jsonc` / `.markdownlint.json`
5. `.markdownlint.yaml` / `.markdownlint.yml`
6. `.markdownlint.cjs` / `.markdownlint.mjs`
7. `package.json`（`markdownlint`キー）

対象リポジトリの設定が見つかった場合はそれをそのまま使う。同梱の既定設定を適用するのは、対象リポジトリに設定が無い場合に限る。

## 既定のルール構成

同梱の`.markdownlint-cli2.yaml`は全ルールを有効（`default: true`）にしたうえで、次を調整している。

```yaml
gitignore: true
config:
  default: true
  MD013:
    line_length: 120
    heading_line_length: 120
    code_blocks: false
    tables: false
  MD024:
    siblings_only: true
  MD033:
    allowed_elements:
      - details
      - summary
```

- `gitignore` — `.gitignore`で無視されるファイルをlint対象から外す。`node_modules/`・`.venv/`等をグロブで個別に除外する必要が無くなる
- **MD013**（line-length）— 上限を120文字とし、コードブロックと表を対象外にする。既定の`strict: false`は「上限を超えた領域に空白が無い行」を除外するため、分かち書きしない日本語の行と、行末が長いURLになる行は実質的に検出されない。検出されるのは空白区切りの語が上限を超えて続く行に限られる
- **MD024**（no-duplicate-heading）— `siblings_only: true`により、異なる親見出しの下での見出し重複を許可する（例: 複数の`### パラメータ`）
- **MD033**（no-inline-html）— GitHubの折りたたみ表現に必要な`<details>`・`<summary>`のみ許可し、他のインラインHTMLは禁止のままとする

`config:`ラッパーは`.markdownlint-cli2.yaml`のオプションファイル形式が要求する。

## 結果の解釈

各エラー行の形式: `file:line:col  rule-name/alias  message`

```text
README.md:10:1 error MD022/blanks-around-headings Headings should be surrounded by blank lines
README.md:24 error MD040/fenced-code-language Fenced code blocks should have a language specified
```

markdownlintの違反はすべてerrorであり、severityの区別は無い。`--fix`で自動修正できる違反が多い（MD060の表整形、MD009の行末空白、MD047の末尾改行など）ため、まず`--fix`を実行し、残った違反を手で直す。

## 誤検出の抑制

markdownlintが妥当な内容を誤検知したと判断した場合、抑制コメントを追加する前に、該当箇所・ルール名・誤検知と判断した理由をユーザーに示し許可を得る。ユーザーの許可を得たら、次のように囲む。

```markdown
<!-- markdownlint-disable MD013 -->

誤検出された内容。

<!-- markdownlint-enable MD013 -->
```

1行のみを対象にする場合は次のようにする。

```markdown
対象の行。 <!-- markdownlint-disable-line MD013 -->
```

よくある誤検出を次に示す。

- 異なる親見出しの下での見出し重複 → 抑制でなくMD024の`siblings_only: true`で対応する（既定設定では対応済み）
- 生成物と手書きが混在するファイル → 先頭の`<!-- markdownlint-disable -->`でファイル単位に抑制する

## markdownlintで検出できないルール（AIによる補完が必要）

以下はmarkdownlintのカバレッジ外のため、手動またはAIによる確認が必要。

### 日本語のリンクテキストの妥当性

MD059（descriptive-link-text）は「こちら」「詳細」のような内容を示さないリンクテキストを検出するが、英語にしか使えない。判定前に適用する正規化`/[\W_]+/g`（uフラグ無し）が非ASCII文字をすべて除去するため、日本語のリンクテキストはすべて空文字に潰れる（`node_modules/markdownlint/lib/md059.mjs`の`normalize()`）。`prohibited_texts`に日本語の語を足すと、日本語のリンクテキストが全件誤検出になる。

日本語では次を目視で確認する。

| 不可 | 可 |
| --- | --- |
| `[こちら](url)` | `[markdownlint-cli2のドキュメント](url)` |
| `[詳細](url)` | `[インストール手順](url)` |
| `[リンク](url)` | `[設定リファレンス](url)` |

### 画像の代替テキストの内容

MD045は代替テキストの有無のみを検査し、内容が意味をなすかは見ない。

- 不可: `![image](./screenshot.png)`
- 可: `![タイムアウト欄を表示した設定ダイアログのスクリーンショット](./screenshot.png)`

### 見出し階層の意味的な妥当性

MD001は見出しレベルが1段ずつ増えることを強制するが、階層が文書の構造を表しているかは検査しない。見出しレベルを文字サイズの調整に使わない。

### 空行の欠落による構造の変化

markdownlintは空行の欠落をMD022・MD031・MD032で検出するが、CommonMarkの解釈が変わるケースを取りこぼす。次の2つは検出されないため目視で確認する。

- リスト直後に空行なしで段落を置くと、その段落は直前のリスト項目に吸収される
- 段落直後に空行なしで`1.`以外から始まる番号付きリストを置くと、リストとして解釈されず段落の続きになる
