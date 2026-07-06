# Task Template (default)

Use for internal work units that are not user-facing: refactor, dependency update, cleanup, documentation, infrastructure, chore.

```markdown
## Background
[なぜこの作業が必要か。発端・トリガー（依存ライブラリのEOL、リファクタの結果として浮上、など）]

## Description
[何をやるか。技術的な完了状態を1〜3行で（「Xを削除する」「Yを最新版に上げる」など）]

## Affected Files
[変更対象のファイル — コードベースから判明したもののみ。任意]
- `path/to/file.ts`

## Acceptance Criteria
- [ ] [観測可能な完了条件1（テスト合格、ビルド通過、ドキュメント更新など）]
- [ ] [観測可能な完了条件2]

## Dependencies
[このタスクをブロックしているもの — Issue番号、外部要因など。任意]

## Notes
[補足、参考資料、関連Issue、設計メモなど。任意]
```

## Section Rules

- **Background**: タスクは緊急性が見えにくいので、なぜ今やるのかを明確にする。必須。
- **Description**: ユーザー価値ではなく技術的な完了状態を書く。
- **Affected Files**: コードベースから判明した場合のみ記載。推測は書かない。該当なしならセクションごと削除。
- **Acceptance Criteria**: **必須**。最低1項目。チェックボックス形式。観測可能な状態のみ（「ちゃんと動く」のような曖昧表現は禁止）。
- **Dependencies**: 該当なしならセクションごと削除。
- **Notes**: 任意。空ならセクションごと削除。
