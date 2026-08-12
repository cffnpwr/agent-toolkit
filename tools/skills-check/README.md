# skills-check

`SKILL.md`を[Agent Skills仕様](https://agentskills.io/specification)とリポジトリ規約に対して静的に検証します。

## Requirements

bun 1.2以上が必要です。

## 使い方

```sh
bun install --frozen-lockfile
```

```sh
bun run check                          # .apm/skills 配下の全スキルを検査します
bun run src/main.ts <skill-dir>...     # スキルを個別に検査します
bun run src/main.ts --root <dir>...    # ディレクトリ直下の各スキルを検査します
```

### オプション

| オプション | 内容 |
| --- | --- |
| `--root` | 引数をスキルの親ディレクトリとして扱います |
| `--json` | 結果をJSONで出します |
| `--warnings-as-errors` | warningも失敗として扱います |

### 終了コード

| コード | 意味 |
| --- | --- |
| 0 | errorなし。warningのみの場合を含みます |
| 1 | errorあり。`--warnings-as-errors`指定時はwarningありも含みます |
| 2 | 使い方の誤り |

## 検査項目

検査ルールは`source`（出自: `spec`・`repo`）と`level`（規範の強さ: `must`・`should`）という、
独立した2つの軸を持ちます（参照: [スキルの静的検証](../../docs/design-doc/skills-check.md)）。

### 仕様が定める必須条件（`source: spec` / `level: must`）

検査対象のパスがディレクトリであること、その直下に`SKILL.md`が存在することを検査します。
[Agent Skills仕様](https://agentskills.io/specification)の[フロントマター](https://agentskills.io/specification#frontmatter)が必須と定める条件と、
`name`とディレクトリ名の一致も検査します。

仕様の記述が一意に定まらない箇所は、通す範囲が狭い側の解釈を採ります（参照: [スキルの静的検証](../../docs/design-doc/skills-check.md)）。

### 仕様の推奨事項（`source: spec` / `level: should`）

[段階的開示](https://agentskills.io/specification#progressive-disclosure)（本文の行数・トークン数）と、
[ファイル参照](https://agentskills.io/specification#file-references)（参照の階層）の推奨事項を検査します。

トークン数の検査は近似です（参照: [ADR 0006](../../docs/adr/0006-tokenizer.md)）。

### 仕様外フィールド（`source: spec` / `level: should`）

仕様が定める6つのフィールド（`name`・`description`・`license`・`compatibility`・`metadata`・`allowed-tools`）
以外のフィールドの存在を検査します。

仕様外フィールドの扱いは実装ごとに異なり、次の3経路では拒否されます。

- claude.aiへのアップロード
- Skills API
- [`package_skill.py`](https://github.com/anthropics/skills/blob/main/skills/skill-creator/scripts/package_skill.py)

出典は次のとおりです。

- [Claude Codeのフロントマター仕様](https://code.claude.com/docs/en/skills#using-skill-frontmatter-outside-claude-code)

### 本リポジトリの追加規約（`source: repo` / `level: must`）

`compatibility`フィールドと本文の`## Requirements`節が、両方そろっているか、どちらも無いことを検査します（参照: [skill-creatorスキル](../../.apm/skills/skill-creator/SKILL.md)）。
