# スキルのワークフローパターン

スキルにおいて逐次・条件分岐ワークフローを実装するための指針。

## ワークフローパターンを使う場面

次の場合にワークフローパターンを使う。
- タスクが複数の逐次ステップを含む
- 条件に応じて異なる経路が存在する
- 判断点でユーザー入力や文脈が必要となる
- プロセスに明確な開始状態と終了状態がある

## 逐次ワークフロー

線形のステップ列に従うプロセス向け。

### パターン: ステップ・バイ・ステップ・プロセス

```markdown
## Workflow

### Step 1: [Action]
[Instructions for first step]

### Step 2: [Action]
[Instructions for second step]
[Dependencies on Step 1 output]

### Step 3: [Action]
[Instructions using results from Steps 1-2]
```

**例 - ドキュメント処理:**
```markdown
## Document Processing Workflow

### Step 1: Read Document
Use scripts/read_document.py to extract content and metadata.

### Step 2: Analyze Structure
Identify sections, headings, and key elements from extracted content.

### Step 3: Transform Content
Apply transformations based on analysis results.

### Step 4: Write Output
Generate final document using scripts/write_document.py.
```

## 条件分岐ワークフロー

条件やユーザーの意図に基づいて分岐するプロセス向け。

### パターン: 決定木

```markdown
## Workflow Decision Tree

**Determine user intent:**

1. **If creating new [item]** → See [Create Workflow](#create-workflow)
2. **If modifying existing [item]** → See [Modify Workflow](#modify-workflow)
3. **If analyzing [item]** → See [Analysis Workflow](#analysis-workflow)

### Create Workflow
[Steps for creation]

### Modify Workflow
[Steps for modification]

### Analysis Workflow
[Steps for analysis]
```

**例 - ファイル操作:**
```markdown
## File Operation Decision Tree

**Determine operation type:**

1. **If creating file** → See [File Creation](#file-creation)
2. **If reading file** → See [File Reading](#file-reading)
3. **If updating file** → See [File Update](#file-update)
4. **If deleting file** → Confirm intent, then use system delete

### File Creation
1. Determine format from user intent
2. Generate content structure
3. Write to file using scripts/write_file.py

### File Reading
1. Check file exists and is accessible
2. Read using scripts/read_file.py
3. Parse based on format

### File Update
1. Read existing content (see File Reading)
2. Apply modifications
3. Write back (see File Creation)
```

## ハイブリッドワークフロー

逐次パターンと条件分岐パターンを組み合わせる。

### パターン: 条件分岐ステップを含む逐次

```markdown
## Workflow

### Step 1: [Always Required]
[Instructions]

### Step 2: [Conditional]
**If condition A:**
- [Actions for A]

**If condition B:**
- [Actions for B]

**Otherwise:**
- [Default actions]

### Step 3: [Always Required]
[Instructions using Step 2 results]
```

**例 - データ処理:**
```markdown
## Data Processing Workflow

### Step 1: Load Data
Use scripts/load_data.py with file path.

### Step 2: Determine Processing Type
**If data is CSV:**
- Parse with CSV library
- Handle quoted fields

**If data is JSON:**
- Parse with JSON library
- Validate schema

**If data is XML:**
- Parse with XML library
- Extract namespaces

### Step 3: Transform Data
Apply transformations using parsed data structure from Step 2.

### Step 4: Output Results
Format and output using scripts/output_data.py.
```

## 反復ワークフロー

条件が満たされるまで繰り返すプロセス向け。

### パターン: 完了までループ

```markdown
## Iterative Workflow

1. Initialize state
2. **Repeat until [condition]:**
   - Perform operation
   - Check result
   - Update state
3. Finalize and output
```

**例 - バッチ処理:**
```markdown
## Batch Processing Workflow

### Setup
1. Get list of input files
2. Initialize results collection

### Processing Loop
**For each file:**
1. Load file using scripts/load_file.py
2. Process content
3. Collect results
4. Update progress

### Finalization
1. Aggregate all results
2. Generate summary report
3. Output combined results
```

## ワークフローのエラー処理

判断点でエラー処理を組み込む。

### パターン: 試行・フォールバック

```markdown
### Step N: [Operation]

**Primary approach:**
1. Attempt [operation] using [method A]

**If [operation] fails:**
2. Fall back to [method B]

**If still failing:**
3. Inform user: "[Error message with guidance]"
```

**例:**
```markdown
### Step 2: Parse Document

**Primary approach:**
1. Attempt parsing with scripts/parse_document.py

**If parsing fails (corrupted file):**
2. Try recovery mode: scripts/parse_document.py --recovery

**If still failing:**
3. Inform user:
   > "Document appears corrupted and cannot be parsed. Please verify file integrity."
```

## スクリプト統合を伴うワークフロー

指示を決定論的なスクリプトと組み合わせる。

### パターン: 指示 + スクリプト実行

````markdown
### Step N: [Task]

**AI Agent actions:**
1. [Analysis or decision-making]
2. [Parameter determination]

**Script execution:**

Invoke bundled scripts inside the synced environment:

```bash
uv run python scripts/[script].py --param [value]
```

**Post-execution:**
3. [Interpret results]
4. [Next actions based on results]
````

**例:**
````markdown
### Step 2: Extract Text

**Preparation:**
1. Analyze document type (PDF, DOCX, image)
2. Determine best extraction method

**Execute extraction:**
```bash
uv run python scripts/extract_text.py --input [file] --method [method]
```

**Process results:**
3. Clean extracted text (remove artifacts)
4. Structure into paragraphs
5. Return formatted text
````

## ワークフローにおける依存の考慮

ワークフローが同梱スクリプト・パッケージ化された依存・外部CLIツールに依存する場合、スキルはそれらの依存を2つの同期された場所で宣言する。すなわち `compatibility` フロントマターフィールド（1〜2行の要約）と `## Requirements` セクション（Dependency packagesテーブルおよび/またはExternal toolsテーブル）である。ワークフロー自体は使用前に依存パッケージをロックファイルから同期する（`uv sync --frozen --no-dev` 等はgit検知の更新を生まないためAgentが実行してよい）。外部ツールが不在、または依存の追加・更新やフォールバックが必要な場合は、Agentは停止してエスカレーションする。外部ツールの導入や依存宣言の変更はしない。

### パターン: 依存を意識したワークフロー

````markdown
## Workflow

### Requirements Check

Verify declared dependencies before running any step. For packaged
dependencies, sync the environment; for external tools, check existence and
version.

```bash
uv sync --frozen --no-dev   # Sync the bundled Python environment
ffmpeg -version             # Check external CLI tool
```

If a dependency is missing:
> "This skill requires [tool/package]. It is not installed. Please install it
> and re-run."

**Only proceed once all dependencies resolve.**

### Step 1: [First Operation]
[Continue with workflow]
````

**例:**
````markdown
## Image Processing Workflow

### Requirements Check

```bash
uv sync --frozen --no-dev   # Sync bundled Python deps (Pillow, imageio)
```

If the sync fails or the environment cannot be created:
> "This skill requires its bundled Python environment. Run `uv sync --frozen --no-dev` from the
> skill directory; if it fails, report the error."

### Step 1: Load Image
Run the script inside the synced environment:

```bash
uv run python scripts/load_image.py --input [file]
```

[Workflow continues...]
````

## まとめの指針

**逐次プロセスについて:**
- ステップに明確に番号を振る
- ステップ間の依存を明示する
- 期待される出力を示す

**条件分岐プロセスについて:**
- 決定木やif-then構造を使う
- 条件を明示する
- すべての分岐を提供する

**ハイブリッドプロセスについて:**
- パターンを適切に組み合わせる
- 構造を明確に保つ
- 深いネストを避ける（最大2〜3レベル）

**エラー処理について:**
- 失敗点を予期する
- フォールバックの選択肢を提供する
- 実行可能なエラーメッセージを与える

**スクリプト統合について:**
- スクリプトを実行する場面を示す
- 同梱スクリプトは同期された環境内で呼び出す（`uv run python scripts/x.py`）
- パラメータを明確に指定する
- 結果の使い方を説明する

**依存について:**
- `compatibility` フィールドと `## Requirements` セクションの両方で依存を宣言する
- 依存パッケージはロックファイルから同期する（`uv sync --frozen --no-dev` 等はAgentが実行してよい）
- 外部ツール不在・依存の追加更新・フォールバックが必要な場合は停止してエスカレーションする。外部ツールの導入や依存宣言の変更はしない
