# Task Template

Use this template for internal work units that are not directly user-facing (refactor, dependency update, cleanup, documentation, infrastructure).

```markdown
## Objective
[完了すべき内容を1行で]

## Background
[なぜこのタスクが必要か — 直接的なトリガー（依存ライブラリのEOL、リファクタの結果として浮上、など）]

## Scope
[このタスクで扱う範囲]
- [扱う1]
- [扱う2]

## Out of Scope
[このタスクで扱わない範囲 — 関連するが別タスクとして切り出すもの]

## Subtasks
- [ ] [サブタスク1]
- [ ] [サブタスク2]
- [ ] [サブタスク3]

## Affected Files
[変更対象のファイル — コードベースから判明したもの]
- `path/to/file.ts`

## Definition of Done
[このタスクが完了したと判定できる状態]

## Dependencies
[このタスクをブロックしているものがあれば — Issue番号、外部要因など]

## Additional Context
[参考資料、関連Issue、設計メモなど]
```

## Section Rules

- **Objective**: ユーザー価値ではなく、技術的な完了状態を書く。「Xを削除する」「Yを最新版に上げる」など。
- **Background**: タスクは緊急性が見えにくいので、なぜ今やるのかを明確にする。
- **Scope / Out of Scope**: タスクは肥大化しやすいので境界を明示する。
- **Subtasks**: 1日以内で終わらない場合はサブタスクに分ける。各サブタスク独立に進められるか検討する。
- **Definition of Done**: テスト合格、ビルド通過、ドキュメント更新など、観測可能な状態を書く。
- **Dependencies**: 該当しない場合はセクションごと削除。
