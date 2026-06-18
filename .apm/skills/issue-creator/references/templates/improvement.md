# Improvement Template

Use this template for enhancement of existing functionality (performance, UX, code quality).

If the project has `.github/ISSUE_TEMPLATE/enhancement*.md` or similar, prefer that.

```markdown
## Summary
[改善したい内容を1行で]

## Current Behavior
[現状の動作 — コードベースから読み取れる内容で記述]

## What is Unsatisfactory
[現状の何が問題か — 動作はするが何が不十分か]

## Desired Behavior
[改善後にどうあるべきか]

## Measurable Target
[定量的な目標があれば — 例: 「ロード時間を3秒から1秒に」「メモリ使用量を50%削減」]

## Affected Area
[改善が影響する範囲 — ファイルパス、機能名]
- `path/to/file.ts`

## Motivation
[なぜ今これを改善するか — ユーザー体験 / 保守性 / パフォーマンス問題など]

## Acceptance Criteria
- [ ] [完了条件1]
- [ ] [完了条件2]

## Alternatives Considered
[他のアプローチと、なぜこれを選んだか — なければセクションごと削除]

## Additional Context
[関連Issue、ベンチマーク結果、参考資料など]
```

## Section Rules

- **Current Behavior**: コードベースから読み取れる事実を書く。ユーザーの主観は次のセクションに分ける。
- **What is Unsatisfactory**: ユーザー視点の不満を書く。「遅い」「分かりにくい」「保守しづらい」など。
- **Desired Behavior**: 改善後の状態を書く。実装方法は書かない（それはPRで議論する）。
- **Measurable Target**: 該当しない場合はセクションごと削除。無理に数値化しない。
- **Motivation**: バグではないので「直したいから」では弱い。優先度の根拠になる動機を書く。
