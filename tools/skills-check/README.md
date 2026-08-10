# skills-check

`SKILL.md`を[Agent Skills仕様](https://agentskills.io/specification)とリポジトリ規約に対して静的に検証します。

## Requirements

bun 1.2以上が必要です。

```sh
bun install --frozen-lockfile
```

## 使い方

```sh
bun run check                          # .apm/skills 配下の全スキルを検査します
bun run src/main.ts <skill-dir>...     # スキルを個別に検査します
bun run src/main.ts --root <dir>...    # ディレクトリ直下の各スキルを検査します
```

オプションを次に示します。

| オプション | 内容 |
| --- | --- |
| `--root` | 引数をスキルの親ディレクトリとして扱います |
| `--json` | 結果をJSONで出します |
| `--warnings-as-errors` | warningも失敗として扱います |

終了コードは次のとおりです。

| コード | 意味 |
| --- | --- |
| 0 | errorなし。warningのみの場合を含みます |
| 1 | errorあり。`--warnings-as-errors`指定時はwarningありも含みます |
| 2 | 使い方の誤り |

## 検査項目

### 仕様が定める条件

[Agent Skills仕様](https://agentskills.io/specification)の[フロントマター](https://agentskills.io/specification#frontmatter)が必須と定める条件をerrorとして、
[段階的開示](https://agentskills.io/specification#progressive-disclosure)と[ファイル参照](https://agentskills.io/specification#file-references)の推奨事項をwarningとして検査します。

仕様の記述が一意に定まらない箇所は、通す範囲が狭い側の解釈を採ります。
根拠は[スキルの静的検証](../../docs/design-doc/skills-check.md)に記しています。

トークン数の検査は近似です。
Claude 3以降のローカルトークナイザが提供されていないためです。

### リポジトリ規約（error）

`compatibility`フィールドと本文の`## Requirements`節が、両方そろっているか、どちらも無いことを検査します（[スキル機構](../../docs/design-doc/skills.md)の依存宣言）。

### 移植性（warning）

仕様が定める6つのフィールド以外の存在を検査します。
Claude Codeは受け付けますが、次の3経路では拒否されます。

- claude.aiへのアップロード
- Skills API
- [`package_skill.py`](https://github.com/anthropics/skills/blob/main/skills/skill-creator/scripts/package_skill.py)

出典は次のとおりです。

- [Claude Codeのフロントマター仕様](https://code.claude.com/docs/en/skills#using-skill-frontmatter-outside-claude-code)

## 設計の根拠

仕様解釈・YAMLパーサの選定・トークン数の近似については[スキルの静的検証](../../docs/design-doc/skills-check.md)に記しています。
