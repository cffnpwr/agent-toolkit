# スキルの出力パターン

スキルにおいて、望ましい出力と品質基準を定義するための指針。

## 出力パターンを使う場面

次の場合に出力パターンを使う。
- 出力形式が特定されている（構造化データ、ドキュメント、コード）
- 品質基準を満たす必要がある（スタイル、網羅性、正確性）
- 説明より例の方が効果的である
- 複数の出力バリエーションが存在する

## テンプレートベースの出力

AI Agentが内容を埋めるテンプレートを提供する。

### パターン: 直接テンプレート

```markdown
## Output Format

Use this template:

```
[Template with placeholders]
```

Example:
[Filled template example]
```

**例 - ステータスレポート:**
```markdown
## Output Format

Use this template for status reports:

```
# Project Status Report - [Date]

## Overview
[1-2 sentence summary]

## Completed This Week
- [Item 1]
- [Item 2]

## In Progress
- [Item with status]

## Blockers
[None / List blockers]

## Next Week
- [Planned item 1]
- [Planned item 2]
```

Example:
```
# Project Status Report - 2026-02-18

## Overview
Successfully completed API integration and began frontend implementation.

## Completed This Week
- REST API endpoints for user management
- Database schema migrations

## In Progress
- Frontend authentication flow (70% complete)

## Blockers
None

## Next Week
- Complete frontend auth
- Begin dashboard implementation
```
```

### パターン: アセットベースのテンプレート

コピーしてカスタマイズするアセットファイルを参照する。

```markdown
## Output Format

Start with template from assets/[template-name]:

1. Copy template to working location
2. Customize [specific sections]
3. Fill placeholders: [list]

The template includes:
- [Structure element 1]
- [Structure element 2]
```

**例 - ドキュメントテンプレート:**
```markdown
## Creating New Reports

Start with template from assets/report-template.docx:

1. Copy template to output location
2. Customize:
   - Title page: Company name, date, author
   - Section 1: Executive summary
   - Section 2-4: Detailed findings
   - Appendix: Supporting data
3. Maintain formatting and styles from template
```

## 例ベースの出力

望ましい出力を示す具体的な例を提示する。

### パターン: 複数の例

```markdown
## Output Examples

**Example 1: [Scenario A]**
```
[Complete output for scenario A]
```

**Example 2: [Scenario B]**
```
[Complete output for scenario B]
```

Key characteristics:
- [Pattern 1]
- [Pattern 2]
```

**例 - コード生成:**
````markdown
## Output Examples

**Example 1: Simple function**
```python
def calculate_total(items: list[dict]) -> float:
    """Calculate total price of items.
    
    Args:
        items: List of dicts with 'price' and 'quantity' keys
        
    Returns:
        Total price as float
    """
    return sum(item['price'] * item['quantity'] for item in items)
```

**Example 2: Class with methods**
```python
class ShoppingCart:
    """Shopping cart with add/remove/total operations."""
    
    def __init__(self):
        """Initialize empty cart."""
        self.items = []
    
    def add_item(self, item: dict) -> None:
        """Add item to cart."""
        self.items.append(item)
    
    def calculate_total(self) -> float:
        """Calculate cart total."""
        return sum(item['price'] * item['quantity'] for item in self.items)
```

Key characteristics:
- Type hints for all parameters and returns
- Docstrings in Google style
- Descriptive variable names
- One responsibility per function/method
````

## 品質基準

出力が満たすべき基準を定義する。

### パターン: チェックリスト

```markdown
## Output Requirements

Output must satisfy:
- [ ] [Requirement 1]
- [ ] [Requirement 2]
- [ ] [Requirement 3]

Verify each item before finalizing.
```

**例 - コード品質:**
```markdown
## Code Quality Standards

Generated code must satisfy:
- [ ] Passes type checking (mypy for Python, tsc for TypeScript)
- [ ] Has docstrings/comments for all public functions
- [ ] Uses descriptive variable names (no single letters except i, j, k in loops)
- [ ] Handles errors appropriately (try/catch or Result types)
- [ ] Maximum function length: 50 lines
- [ ] Maximum file length: 500 lines

Verify each item before finalizing code.
```

### パターン: 受け入れ基準

```markdown
## Acceptance Criteria

Output is acceptable if:
1. [Criterion 1 with measurable standard]
2. [Criterion 2 with measurable standard]
3. [Criterion 3 with measurable standard]

If any criterion fails, [remediation action].
```

**例 - ドキュメント品質:**
```markdown
## Document Acceptance Criteria

Document is acceptable if:
1. Length is 1000-2000 words
2. Contains 3-5 main sections with clear headings
3. Includes at least 2 concrete examples
4. Free of spelling/grammar errors (use spell checker)
5. All claims have supporting evidence or citations

If any criterion fails, revise the document before presenting to user.
```

## 構造化データの出力

JSON、YAML、その他の構造化形式を定義する。

### パターン: スキーマ定義

````markdown
## Output Schema

Return JSON with this structure:

```json
{
  "field1": "type and description",
  "field2": {
    "nested": "structure description"
  },
  "field3": ["array of items"]
}
```

Validation rules:
- [Rule 1]
- [Rule 2]
````

**例 - APIレスポンス:**
````markdown
## API Response Format

Return JSON with this structure:

```json
{
  "status": "success or error",
  "data": {
    "id": "string - unique identifier",
    "name": "string - user-facing name",
    "created_at": "ISO 8601 timestamp",
    "attributes": {
      "key1": "value1",
      "key2": "value2"
    }
  },
  "errors": []
}
```

Validation rules:
- status must be "success" or "error"
- data is null when status is "error"
- errors is empty array when status is "success"
- timestamps in ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ)
- all IDs are UUIDs v4
````

## 段階的な出力

複数段階の出力では、各段階を定義する。

### パターン: 段階的出力

```markdown
## Output Stages

### Stage 1: [Initial Output]
[Format and requirements for stage 1]

### Stage 2: [Refined Output]
[Format and requirements for stage 2, building on stage 1]

### Stage 3: [Final Output]
[Format and requirements for final stage]
```

**例 - 設計プロセス:**
```markdown
## Design Output Stages

### Stage 1: Wireframe
Text-based layout structure:
```
[Header]
  - Logo | Navigation
[Main Content]
  - Title
  - Body (2 columns)
  - Sidebar (1 column)
[Footer]
  - Links | Copyright
```

### Stage 2: Detailed Mockup
ASCII art or description with specific dimensions:
- Colors specified (hex codes)
- Fonts identified (family, size, weight)
- Spacing defined (padding, margins in px)

### Stage 3: Implementation Code
HTML/CSS code implementing the design:
- Semantic HTML structure
- Responsive CSS (mobile-first)
- Accessibility attributes (ARIA labels)
```

## 形式別のパターン

### コード出力

```markdown
## Code Output Format

Language: [Specify language]

Structure:
```[language]
[Code structure template]
```

Style guide:
- [Style rule 1]
- [Style rule 2]

Comments:
- [When and what to comment]
```

### ドキュメント出力

```markdown
## Document Format

Format: [Markdown/PDF/DOCX/etc.]

Structure:
1. [Section 1]: [Purpose and length]
2. [Section 2]: [Purpose and length]

Formatting:
- Headings: [Style guide]
- Lists: [When to use]
- Emphasis: [Bold/italic usage]
- Code blocks: [When to use]
```

### データ出力

```markdown
## Data Format

Format: [JSON/CSV/YAML/etc.]

Columns/Fields:
- field1: [Type, constraints, description]
- field2: [Type, constraints, description]

Encoding: [UTF-8/etc.]
Delimiter: [for CSV]
Null handling: [How to represent missing values]
```

## 検証パターン

出力が基準を満たすことを確認する方法。

### パターン: 自己検証

````markdown
## Output Validation

Before finalizing, verify:

**Automated checks:**
```bash
[Command to run validation tool]
```

**Manual checks:**
1. [Visual or logical check 1]
2. [Visual or logical check 2]

If validation fails:
[Remediation steps]
````

**例:**
````markdown
## Python Code Validation

Before finalizing, verify:

**Automated checks:**
```bash
uv run python -m py_compile code.py  # Syntax check
uv run mypy code.py                  # Type check
uv run pylint code.py                # Linting
```

**Manual checks:**
1. All functions have docstrings
2. No TODOs or placeholder comments remain
3. Variable names are descriptive

If validation fails:
- Fix syntax/type errors first
- Address linting warnings (aim for 8.0+ score)
- Complete all TODOs or remove if not needed
````

## 出力パターンにおける compatibility

出力を定義する際は環境を考慮する。

### パターン: 環境条件付き出力

```markdown
## Output Format

**If Python available:**
Generate Python script using scripts/template.py

**If Python not available:**
Generate shell script alternative

Both outputs must achieve same result.
```

**例:**
```markdown
## Data Processing Output

**If Python 3.11+ with pandas available:**
Generate Python script:
- Use pandas for data manipulation
- Output to CSV/JSON/Excel as needed

**If only Bash available:**
Generate shell script:
- Use awk/sed for data manipulation
- Output to CSV only

Both approaches must:
- Handle same input format
- Produce compatible outputs
- Include error handling
```

## まとめの指針

**テンプレートベースの出力:**
- 完全で使えるテンプレートを提供する
- プレースホルダを明確に示す
- 埋めた例を示す

**例ベースの出力:**
- 一般的なケースを網羅する多様な例を含める
- パターンと主要な特徴を強調する
- 単純なケースと複雑なケースの両方を示す

**品質基準:**
- 基準を測定可能かつ検証可能にする
- 検証方法を提供する
- 基準を満たさない場合の対応を明示する

**構造化データ:**
- スキーマを完全に定義する
- 検証ルールを指定する
- 型情報を含める

**段階的な出力:**
- 各段階を明確に定義する
- 各段階が互いにどう積み上がるかを示す
- 段階間を移る条件を指定する

**検証:**
- 可能な場合は自動チェックを提供する
- 手動での確認手順を含める
- 是正手順を明示する
