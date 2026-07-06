# Bug Template

Use for bug reports and bug fixes. Reproduction steps are mandatory; never abbreviate.

```markdown
## Summary
[1行で何が起きているか]

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
- Runtime / Browser: [例: Node.js 22.5.0 / Chrome 130]
- Application version: [例: v1.2.3 or commit SHA]

## Error Output
\`\`\`
[エラーメッセージ、スタックトレース、ログをそのまま貼る。秘匿情報はプレースホルダ化]
\`\`\`

## Affected Code
[再現に関わるファイルパスと行番号 — コードベースから判明したもののみ。任意]
- `path/to/file.ts:123`

## Acceptance Criteria
- [ ] [修正完了条件1（例: 再現手順を実行しても再発しない）]
- [ ] [回帰テスト追加]

## Workaround
[既知の回避策があれば。任意]

## Notes
[関連Issue、最近の変更、補足情報など。任意]
```

## Section Rules

- **Reproduction Steps**: **省略禁止**。ユーザーから提供されない場合は必ず質問して埋める。
- **Expected Behavior**: 仕様書から推測しない。ユーザーが何を期待していたかを書く。
- **Actual Behavior**: 「動かない」では不十分。具体的に何が起きたかを書く。
- **Environment**: ユーザー環境を書く。AI Agent の環境を書かない。
- **Error Output**: 機密情報（トークン、内部ホスト名、個人パス）はプレースホルダ化する。空ならセクション削除。
- **Affected Code**: コードベースから判明した場合のみ記載。推測は書かない。空ならセクション削除。
- **Acceptance Criteria**: **必須**。最低1項目。再発防止のテスト追加を含めるのが望ましい。
- **Workaround / Notes**: 該当情報がない場合はセクションごと削除する。「なし」とは書かない。
