# textlintルール動作確認ファイル（OK例）

このファイルはtextlintの全ルールが正しく動作しているかを確認するためのテスト用ファイルだ。
各セクションに対応するルール名を記載する。
textlintを実行すると、このファイルではエラーが検出されない。

## 実行方法

```bash
bun install --frozen-lockfile --production
./node_modules/.bin/textlint --config .textlintrc.json assets/examples-ok.md
```

---

## preset-ja-technical-writing

### max-kanji-continuous-len: 漢字の連続使用上限（デフォルト6文字）

#### OK例（6文字以内の漢字連続）

機械学習の研究者が新技術を推進する。

### sentence-length: 1文100文字以内

#### OK例（100文字以内の文）

このファイルはtextlintのすべてのルールが正しく動作しているかを確認するテストファイルだ。

### max-ten: 読点は1文中3つまで

#### OK例（読点3つ以内）

システムは起動時に設定ファイルを読み込み、初期化処理を実行し、準備が完了する。

### no-mix-dearu-desumasu: 文体統一（設定: preferInBody=である）

#### OK例（常体で統一）

この設定は重要である。
この機能は非常に便利だ。

### ja-no-mixed-period: 文末句点の統一（preset内）

#### OK例（句点あり）

この文には句点がある。

### no-double-negative-ja: 二重否定

#### OK例

この設定は変更できる。

### no-dropping-the-ra: ら抜き言葉

#### OK例

このファイルは見られない。

### no-doubled-conjunctive-particle-ga: 逆接「が」の連続

#### OK例

この機能は便利だが、設定が複雑なため、使い方を覚えれば問題ない。

### no-doubled-conjunction: 同じ接続詞の連続

#### OK例

この設定は重要だ。
しかし、難しい。
ただし、慣れれば問題ない。

### no-doubled-joshi: 同じ助詞の連続

#### OK例

このツールをユーザーはよく使う。

### ja-no-weak-phrase: 弱い表現

#### OK例

この設定はデフォルト値が適切だ。

### ja-no-redundant-expression: 冗長な表現

#### OK例

この値を返すことができる。

### no-exclamation-question-mark: 感嘆符・疑問符

#### OK例

この機能はとても便利だ。

### no-hankaku-kana: 半角カナ

#### OK例（全角カナ使用）

システムが起動した。

### arabic-kanji-numbers: 漢数字と算用数字の使い分け

#### OK例（数量に算用数字）

3つのファイルがある。

### max-comma: 読点（,）の連続使用上限（デフォルト3つ）

#### OK例（半角カンマ3つ以内）

この機能は, 設定を読み込み, 初期化し, 処理を完了する。

### ja-no-successive-word: 同じ単語の連続（入力ミス）

#### OK例（単語の重複なし）

これは問題ある文章だ。

### ja-no-abusage: 誤用表現

#### OK例

この値を返す。

### ja-unnatural-alphabet: 不自然なアルファベット

#### OK例（自然な文脈のアルファベット）

対応できない場合だ。

### no-unmatched-pair: 対応する括弧の欠落

#### OK例（括弧が対応している）

（この設定は重要な設定だ。）

### no-zero-width-spaces: ゼロ幅スペース

#### OK例（ゼロ幅スペースなし）

テストテキストだ。

---

## @textlint-ja/preset-ai-writing

### no-ai-list-formatting: AI的なリストの太字プレフィックスパターン

#### OK例（自然なリスト表記）

- この設定は必須だ
- この値は変更が必要だ

### no-ai-emphasis-patterns: AI的な本文の強調パターン

#### OK例（太字プレフィックスなし）

この設定は必須だ。

### no-ai-hype-expressions: 誇張表現

#### OK例

このツールはビルド時間を短縮し、多くの問題を解決する。

### no-ai-colon-continuation: コロンに続くリスト

#### OK例

設定方法を以下に示す。

- 手順1
- 手順2

### ai-tech-writing-guideline: 冗長な義務表現

#### OK例

設定ファイルを編集する。

---

## preset-ja-spacing

### ja-space-between-half-and-full-width: 半角・全角間のスペース

#### OK例（スペースなし）

最新のAPI仕様を確認する。

### ja-no-space-between-full-width: 全角文字間のスペース

#### OK例（全角間にスペースなし）

日本語でのガイドラインだ。

---

## prefer-tari-tari

#### OK例（たり...たり対応あり）

ファイルを読んだり書いたりする。

---

## no-mixed-zenkaku-and-hankaku-alphabet

#### OK例（半角アルファベット）

APIを使用する。

---

## @textlint-ja/no-synonyms

#### OK例（同語は統一した表記）

システムのサーバーが起動している。

---

## period-in-list-item

#### OK例（リスト末尾に句点なし）

- 項目A
- 項目B

---

## ja-no-orthographic-variants: 表記ゆれ

#### OK例（表記を統一）

組み立てと組み立てを統一して使っている。

---

## @textlint-ja/no-insert-re: れ足す言葉

#### OK例

お酒は飲めない。

---

## @textlint-ja/no-dropping-i: い抜き言葉

#### OK例

現在開発している。

---

## @textlint-ja/no-insert-dropping-sa: さ抜き・さ入れ

#### OK例（さ入れなし）

寿司が美味しそうだ。

---

## prh: 生成AIの決まり文句

#### OK例（決まり文句を使わず具体的に書く）

テストを書くことが必要な理由は、変更の影響を早期に検知できるためだ。

---

## @cffnpwr/preset-ja-writing-extras

### no-dash: 地の文・見出しでのダッシュ

#### OK例（ダッシュを括弧・句点に置き換える）

この機能（自動保存）は便利だ。

### sentence-per-line: 一文一行

#### OK例（一文ごとに改行する）

一文目だ。
二文目だ。

### no-arbitrary-line-break: 段落内の任意位置での改行

#### OK例（区切り記号の直後で改行する）

この機能は長い説明が必要になるので、
読点の直後で改行している。

### no-doubled-additive-conjunction: 累加の接続詞の連打

#### OK例（累加の接続詞を重ねない）

このツールは速度と安定性で優れている。
速度はビルド時間を短縮する。
安定性は障害を減らす。
