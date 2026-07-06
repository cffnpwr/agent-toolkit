# Feature Template

Use for new functionality that does not exist yet.

```markdown
## Background
[この機能が必要な理由 — どんな問題を解決するか、誰のためか]

## Goal
[追加したい機能を1〜3行で。実現したい状態]

## Proposed Solution
[どのような機能であるべきか — UI、API、挙動の概要。任意]

## Use Case
[具体的な使用シナリオ — 「ユーザーがXをしてYを得る」のような形式]

## Scope
[このIssueで扱う範囲]
- [項目1]
- [項目2]

## Out of Scope
[このIssueで扱わない範囲 — 関連するが別Issueに切り出すもの。任意]

## Alternatives Considered
[他に検討した方法と、なぜこの方法を選んだか。任意]

## Acceptance Criteria
- [ ] [機能としての受入条件1]
- [ ] [機能としての受入条件2]

## Related Code
[既存コードで関連する箇所 — コードベースから判明したもののみ。任意]
- `path/to/related.ts`

## Notes
[モックアップ、参考実装、関連Issueなど。任意]
```

## Section Rules

- **Background**: **必須**。「あったほうが良いから」では不十分。具体的な動機を書く。
- **Goal**: 実現したい状態を簡潔に。実装手順は書かない。
- **Proposed Solution**: 確定した設計でなくてよい。方向性が示されていればよい。任意。
- **Use Case**: 抽象的な機能説明だけでなく、具体的な使用例を含める。
- **Scope**: PBI 化する場合は特に重要。境界を明確化する。
- **Out of Scope**: スコープ膨張防止。任意だが PBI では強く推奨。
- **Acceptance Criteria**: **必須**。最低1項目。機能としての完了基準を書く。
- **Alternatives Considered / Related Code / Notes**: 該当情報がない場合はセクションごと削除する。
