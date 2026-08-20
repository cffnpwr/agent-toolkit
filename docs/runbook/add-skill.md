# スキルを追加する

`.apm/skills/<スキル名>/`にディレクトリを作り、`SKILL.md`を置く。
構成・descriptionの書き方・依存宣言はskill-creatorスキルが定めており、AI Agentに作らせる場合はそれを起動する。

フロントマターと依存宣言の整合は、skill-creatorに同梱の`quick_validate.py`で検査する。

```sh
cd .apm/skills/skill-creator
```

```sh
uv sync --frozen --no-dev
```

```sh
uv run python scripts/quick_validate.py ../<スキル名>/
```

Agent Skills仕様と本リポジトリの規約への適合は、`tools/skills-check`で検査する。

```sh
cd ../../../tools/skills-check
```

```sh
bun install --frozen-lockfile
```

```sh
bun run src/main.ts ../../.apm/skills/<スキル名>
```
