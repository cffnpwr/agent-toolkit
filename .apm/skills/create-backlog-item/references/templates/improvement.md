# Improvement Template

Use for enhancement of existing functionality (performance, UX, code quality).

```markdown
## Background
[なぜ今これを改善するか — 動機・優先度の根拠]

## Current Behavior
[現状の動作 — コードベースから読み取れる内容]

## What is Unsatisfactory
[現状の何が問題か — 動作はするが何が不十分か]

## Desired Behavior
[改善後にどうあるべきか]

## Measurable Target
[定量的な目標 — 例: 「ロード時間を3秒から1秒に」「メモリ使用量を50%削減」。任意]

## Affected Area
[改善が影響する範囲 — ファイルパス、機能名]
- `path/to/file.ts`

## Acceptance Criteria
- [ ] [完了条件1]
- [ ] [完了条件2]

## Alternatives Considered
[他のアプローチと、なぜこれを選んだか。任意]

## Notes
[関連Issue、ベンチマーク結果、参考資料など。任意]
```

## Section Rules

- **Background**: **必須**。バグではないので「直したいから」では弱い。優先度の根拠を書く。
- **Current Behavior**: コードベースから読み取れる事実を書く。ユーザー主観は次のセクションに分ける。
- **What is Unsatisfactory**: ユーザー視点の不満を書く。「遅い」「分かりにくい」「保守しづらい」など。
- **Desired Behavior**: 改善後の状態を書く。実装方法は書かない。
- **Measurable Target**: 該当しない場合はセクションごと削除。無理に数値化しない。
- **Affected Area**: コードベースから判明した範囲を書く。
- **Acceptance Criteria**: **必須**。最低1項目。
- **Alternatives Considered / Notes**: 該当情報がない場合はセクションごと削除する。
