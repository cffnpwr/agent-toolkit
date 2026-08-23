---
ID: 4
date: 2026-08-20
status: accepted
---

# YAMLパーサに`yaml`を採用する

`SKILL.md`のフロントマターをパースするYAMLライブラリとして、TypeScript製の[`yaml`](https://github.com/eemeli/yaml)を採用する。
[yaml-test-suite](https://github.com/yaml/yaml-test-suite)への合格率が最も高く、不合格がフロントマターと無関係な領域に限られるためである。

## Context

`SKILL.md`のフロントマターはYAMLで書かれ、静的検証はこれをパースする必要がある。
検証ツールの実装言語は、採用するYAMLパーサに従って決める。
そのため、TypeScript・Go・Rust製のパーサを言語をまたいで比較した。

[yaml-test-suite](https://github.com/yaml/yaml-test-suite)の比較可能な636ケースで測った合格率を次に示す。
「内訳は未分析」は、不合格ケースの内訳を個別に分析していないことを表す。
yaml-test-suiteには、仕様上不正なYAMLを正しくエラーにできるかを確かめるケースがある。

| ライブラリ | 言語 | 合格率 | 不合格の内容 |
| --- | --- | --- | --- |
| [`yaml`](https://github.com/eemeli/yaml) | TypeScript | 98.7% | `!!binary`・`!!set`・`!!omap`などのタグ |
| [`goccy/go-yaml`](https://github.com/goccy/go-yaml) | Go | 96.1% | 大半が、仕様上不正なYAMLを誤って受理するケース |
| [`js-yaml`](https://github.com/nodeca/js-yaml) | TypeScript | 95.9% | 内訳は未分析 |
| [`saphyr`](https://github.com/saphyr-rs/saphyr) | Rust | 95.6% | タグとアンカー |
| [`Bun.YAML`](https://bun.com/docs/api/yaml) | TypeScript | 92.9% | 折りたたみブロックスカラーの解釈 |
| [`serde_yaml`](https://github.com/dtolnay/serde-yaml) | Rust | 84.3% | 内訳は未分析 |
| [`gopkg.in/yaml.v3`](https://github.com/go-yaml/yaml) | Go | 81.3% | 内訳は未分析 |

測定の限界を次に示す。
636ケースは比較可能なもので、複数文書を含む99ケースは比較していない。
またJSONへ変換して比較するため、タグに関する不一致は比較方法の限界による可能性がある。

## Choices

合格率1位の`yaml`と2位の`goccy/go-yaml`を検討する。
`js-yaml`は`yaml`と同じTypeScript製だが合格率がより低く、その他のライブラリも上位2つに合格率で劣るため検討しない。

1. `yaml`
2. `goccy/go-yaml`

### 1. `yaml`

#### Pros

- 合格率が最も高い（98.7%）
- 不合格が`!!binary`・`!!set`・`!!omap`などのタグに限られ、フロントマターの検証と無関係な領域にとどまる

#### Cons

- 合格率98.7%でも不合格は残る（`!!binary`等のタグ関連）

### 2. `goccy/go-yaml`

#### Pros

- 合格率が96.1%で、`yaml`に次いで高い

#### Cons

- 仕様上不正なYAMLを誤って受理する（不合格の大半がこのケース）
- 検証器に使うと、他の実装が拒否する`SKILL.md`まで通してしまう

## Decision

選択肢1（`yaml`）を採る。

合格率が最も高く、不合格がフロントマターと無関係な領域に限られるためである。
`yaml`の採用により、検証ツールの実装言語はTypeScriptになる。

`goccy/go-yaml`は合格率が高いが採らない。
不合格の大半は、仕様上不正なYAMLを誤って受理するものである。
検証器としては、他の実装が拒否する`SKILL.md`まで通してしまうため不利になる。

## Consequences

- 636ケースは比較可能なもので、複数文書を含む99ケースは比較していない
- JSONへ変換して比較するため、タグに関する不一致は比較方法の限界による可能性がある
