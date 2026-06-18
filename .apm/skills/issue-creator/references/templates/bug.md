# Bug Report Template

Use this template when the project has no `.github/ISSUE_TEMPLATE/bug*.md` or `.gitlab/issue_templates/bug*.md`.

Reproduction steps are mandatory. Do not omit them.

```markdown
## Summary
[1行で何が起きているかを記述]

## Reproduction Steps
1. [手順1 — 操作を具体的に]
2. [手順2]
3. [手順3]

## Expected Behavior
[ユーザーが期待した動作]

## Actual Behavior
[実際に起きた動作 — エラーメッセージ、画面の状態、出力値など具体的に]

## Frequency
[毎回 / たまに / 1回だけ — 「たまに」の場合は条件があれば併記]

## Environment
- OS: [例: macOS 14.5]
- Browser / Runtime: [例: Chrome 130 / Node.js 22.5.0]
- Application version: [例: v1.2.3 or commit SHA]
- [その他関連する環境情報]

## Error Output
\`\`\`
[エラーメッセージ、スタックトレース、ログをそのまま貼る]
\`\`\`

## Affected Code
[再現に関わるファイルパスと行番号 — コードベースを読んで判明したもの]
- `path/to/file.ts:123`

## Impact
[この問題が誰にどのような影響を与えているか]

## Workaround
[既知の回避策があれば記載 — なければセクションごと削除]

## Additional Context
[関連Issue、最近の変更、再現に役立つ補足情報があれば]
```

## Section Rules

- **Reproduction Steps**: 省略禁止。ユーザーから提供されない場合は必ず質問する。
- **Expected Behavior**: 仕様書から推測しない。ユーザーが何を期待していたかを書く。
- **Actual Behavior**: 「動かない」では不十分。具体的に何が起きたかを書く。
- **Environment**: ユーザー環境を書く。自分（AI Agent）の環境を書かない。
- **Error Output**: 機密情報（トークン、内部ホスト名、個人パス）はプレースホルダ化する。
- **Affected Code**: コードベースから判明した場合のみ記載。推測は書かない。
- **Workaround / Additional Context**: 該当情報がない場合はセクションごと削除する。「なし」と書かない。
