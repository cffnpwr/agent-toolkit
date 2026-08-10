# スキルの静的検証

`SKILL.md`を[Agent Skills仕様](https://agentskills.io/specification)とリポジトリ規約に対して検証する仕組みを定める。
検証は配布対象ではなく、リポジトリの開発ツールとして扱う。

## 検査の分類

検査は出所で4つに分ける。
出所ごとに重大度を固定し、種別から引けるようにする。
表中の「仕様」はすべて[Agent Skills仕様](https://agentskills.io/specification)を指す。

| 出所 | 重大度 | 内容 |
| --- | --- | --- |
| `spec` | error | 仕様が必須と定める条件。満たさないスキルは仕様に適合しない |
| `recommendation` | warning | 仕様の推奨事項。満たさなくても仕様には適合する |
| `portability` | warning | 仕様の範囲を超えた記述。特定の配布経路で拒否される |
| `repo` | error | 本リポジトリのdesign docが定める追加規約 |

推奨事項をerrorにしない理由は、仕様がそれを必須と書いていないためである。
仕様より厳しい判定を機械で強制すると、仕様に適合するスキルを取り込めなくなる。

`portability`をerrorにしない理由は、Claude Code固有のフィールドに用途があるためである。
拒否されるのは次の3経路に限られる。

- claude.aiへのアップロード
- Skills API
- [`package_skill.py`](https://github.com/anthropics/skills/blob/main/skills/skill-creator/scripts/package_skill.py)

出典は次のとおり。

- [Claude Codeのフロントマター仕様](https://code.claude.com/docs/en/skills#using-skill-frontmatter-outside-claude-code)

機能を残したまま代償を可視化する。

## 仕様解釈

仕様の記述が一意に定まらない箇所がある。
いずれも**通す範囲が狭い側**を採る。
ここを通るスキルは、別の解釈を採る検証器でも通る。

### 文字数の単位

仕様は`name`を64文字以内、`description`を1024文字以内と定めるが、単位を書いていない。
UTF-16符号単位（JavaScriptの`String.prototype.length`）で数える。
コードポイント数を下回らないため、判定が安全側へ倒れる。

バイト数で数える解釈は成立しない。
既存のスキルのうち4件は`description`が1024バイトを超えるが、
仕様の参照実装`skills-ref`はいずれも通す。

### `name`の文字種

仕様本文は「unicode lowercase alphanumeric characters (`a-z`, `0-9`)」と書いている。
Unicode全体を許す読みと`a-z0-9`に限る読みの双方を含む。
狭い側の`a-z0-9`とハイフンに限る。

## YAMLパーサの選定

[`yaml`](https://github.com/eemeli/yaml)を使う。
[yaml-test-suite](https://github.com/yaml/yaml-test-suite)の比較可能な636ケースで測った適合率を次に示す。

| ライブラリ | 言語 | 適合率 | 不適合の内容 |
| --- | --- | --- | --- |
| [`yaml`](https://github.com/eemeli/yaml) | TypeScript | 98.7% | `!!binary`・`!!set`・`!!omap`などのタグ |
| [`goccy/go-yaml`](https://github.com/goccy/go-yaml) | Go | 96.1% | 大半が不正なYAMLの受理 |
| [`js-yaml`](https://github.com/nodeca/js-yaml) | TypeScript | 95.9% | 分類していない |
| [`saphyr`](https://github.com/saphyr-rs/saphyr) | Rust | 95.6% | タグとアンカー |
| [`Bun.YAML`](https://bun.com/docs/api/yaml) | TypeScript | 92.9% | 折りたたみブロックスカラーの解釈 |
| [`serde_yaml`](https://github.com/dtolnay/serde-yaml) | Rust | 84.3% | 分類していない |
| [`gopkg.in/yaml.v3`](https://github.com/go-yaml/yaml) | Go | 81.3% | 分類していない |

`yaml`を採る理由は、適合率が最も高く、不適合がフロントマターと無関係な領域に限られるためである。

`Bun.YAML`は組み込みで依存を増やさないが採らない。
深いインデント行を含む折りたたみブロックスカラーで、改行と先頭の空白を落とす。
仕様が定める文字列と異なる値を返すため、文字数の検査が成立しない。

`goccy/go-yaml`は適合率が高いが、不適合の大半が「不正なYAMLを受理する」側にある。
検証器としては、他の処理系が拒否する`SKILL.md`を通してしまうため不利になる。

測定の限界を次に示す。
636ケースは比較可能なもので、複数文書を含む99ケースは比較していない。
またJSONへ変換して比較するため、タグに関する不一致は比較方法の限界による可能性がある。

## 参照実装を使わない理由

仕様は検証に参照実装[`skills-ref`](https://github.com/agentskills/agentskills/tree/main/skills-ref)を挙げるが、これを使わない。
理由は3つある。

作者が本番利用を想定していない。
READMEは「demonstration purposes only」であり「not meant to be used in production」と明記する。

仕様と乖離している。
`strictyaml`を使うためYAMLの部分集合しか読めず、`name`にUnicodeを許し、小文字の`skill.md`を受け付ける。
仕様に適合するスキルを落とし、仕様に反するスキルを通す。

問題を文字列のリストで返す。
種別で扱えないため、呼び出し側の分岐とテストが文言への依存になる。

## トークン数の検査

仕様は`SKILL.md`本文を5000トークン以内に収めることを推奨する。
この検査は近似である。

Claude 3以降のローカルトークナイザは提供されていない（[Token counting](https://platform.claude.com/docs/en/build-with-claude/token-counting)）。
`@anthropic-ai/tokenizer`はClaude 3より前のもので、自身をbetaと位置づけ更新も止まっている。

Agent Skills仕様はベンダ中立であり、トークナイザを特定していない。
そのため`gpt-tokenizer`の`o200k_base`を使う。
更新が続いており、日本語の扱いも新しい。

既存のスキルで測ると、`@anthropic-ai/tokenizer`との差は19%から32%になる。
警告の対象がこの差で変わるため、数値は目安として扱う。
