# スクリプトリファレンス

skill-creatorに同梱されるスクリプトの完全な利用リファレンス。

すべてのスクリプトは同期済みのuv環境内で実行する。`uv run python scripts/...` で実行する。

新規スキルの雛形作成に生成スクリプトは無い。[`templates/SKILL.md.template`](../templates/SKILL.md.template) を読み、`{{SKILL_NAME}}`・`{{SKILL_TITLE}}` を置換してスキル名と同名のディレクトリに `SKILL.md` を書き出し、必要に応じて `scripts/`・`references/`・`assets/` を追加する。

## quick_validate.py

SKILL.mdのフロントマター構造と依存宣言の整合性を検証する。

**Usage:**
```bash
uv run python scripts/quick_validate.py <skill-directory>
```

**Validates:**
- YAMLフロントマターに `name` と `description` が存在すること
- `name` がkebab-caseであること
- `description` の長さと形式
- 依存宣言の整合性

**依存シグナル**とは、以下のいずれかが存在することを指す。
- 依存定義ファイル（`pyproject.toml`、`package.json`、`Gemfile`、`composer.json`）
- ロックファイル
- `scripts/` 配下の任意のスクリプトファイル

**Errors:**
- `name` または `description` が欠落
- 依存シグナルが存在するが `compatibility` フロントマターフィールドが欠落
- 依存シグナルが存在するが `## Requirements` セクションが欠落
- 定義ファイルが存在するが対応するロックファイルが無い
- `compatibility` にTODOプレースホルダが含まれる

import解析は行わない。
