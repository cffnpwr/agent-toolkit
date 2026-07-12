# textlintルール動作確認ファイル

このファイルはtextlintの全ルールが正しく動作しているかを確認するためのテスト用ファイルだ。
各セクションに対応するルール名を記載する。
textlintを実行すると、各セクションのNG例でエラーが検出される。

## 実行方法

```bash
bun install --frozen-lockfile --production
./node_modules/.bin/textlint --config .textlintrc.json assets/examples-ng.md
```

---

## preset-ja-technical-writing

### max-kanji-continuous-len: 漢字の連続使用上限（デフォルト6文字）

NG例（7文字以上の漢字連続）:

我々機械学習研究者団体は新技術開発を推進する。

### sentence-length: 1文100文字以内

NG例（101文字以上の文）:

このファイルはtextlintのすべてのルールが正しく動作しているかどうかを確認するために作成されたテストファイルであり、この文は意図的に百文字を超えるよう書かれているため、sentence-lengthルールによってエラーが検出される。

### max-ten: 読点は1文中3つまで

NG例（読点4つ）:

システムは、起動時に、設定ファイルを読み込み、初期化処理を実行し、準備が完了する。

### no-mix-dearu-desumasu: 文体統一（設定: preferInBody=である）

NG例（本文に常体とですます調が混在）:

この設定は重要である。
この機能は非常に便利です。

### ja-no-mixed-period: 文末句点の統一（preset内）

NG例（句点なし）:

この文には句点がない

### no-double-negative-ja: 二重否定

NG例:

この設定は変更しないわけではない。

### no-dropping-the-ra: ら抜き言葉

NG例:

このファイルは見れない。

### no-doubled-conjunctive-particle-ga: 逆接「が」の連続

NG例:

この機能は便利だが、設定が複雑だが、使い方を覚えれば問題ない。

### no-doubled-conjunction: 同じ接続詞の連続

NG例:

この設定は重要だ。
しかし、難しい。
しかし、慣れれば問題ない。

### no-doubled-joshi: 同じ助詞の連続

NG例:

このツールはユーザーはよく使う。

### ja-no-weak-phrase: 弱い表現

NG例:

この設定はデフォルト値が適切かもしれない。

### ja-no-redundant-expression: 冗長な表現

NG例:

この値を返却することができる。

### no-exclamation-question-mark: 感嘆符・疑問符

NG例:

この機能はとても便利だ！

### no-hankaku-kana: 半角カナ

NG例（半角カナ使用）:

ｼｽﾃﾑが起動した。

### arabic-kanji-numbers: 漢数字と算用数字の使い分け

NG例（数量に漢数字）:

三つのファイルがある。

### max-comma: 読点（,）の連続使用上限（デフォルト3つ）

NG例（半角カンマ4つ）:

この機能は, 設定を読み込み, 初期化し, ログを書き込み, 処理を完了する。

### ja-no-successive-word: 同じ単語の連続（入力ミス）

NG例（同じ単語が連続）:

これはは問題ある文章だ。

### ja-no-abusage: 誤用表現

NG例:

この値を返却する。

### ja-unnatural-alphabet: 不自然なアルファベット

NG例（日本語の途中に孤立した半角アルファベット）:

対応でkない場合だ。

### no-unmatched-pair: 対応する括弧の欠落

NG例（閉じ括弧なし）:

（この設定は重要な設定だ。

### no-zero-width-spaces: ゼロ幅スペース

NG例（ゼロ幅スペースを含む文）:

テスト​テキストだ。

---

## @textlint-ja/preset-ai-writing

### no-ai-list-formatting: AI的なリストの太字プレフィックスパターン

NG例（リストアイテムで機械的な太字プレフィックスパターン）:

- **重要**: この設定は必須だ。
- **注意**: この値を変更すること。

### no-ai-emphasis-patterns: AI的な本文の強調パターン

NG例（段落内の太字プレフィックスパターン）:

**重要**: この設定は必須だ。

### no-ai-hype-expressions: 誇張表現

NG例:

このツールは革命的な機能を提供し、完全に問題を解決する。

### no-ai-colon-continuation: コロンに続くリスト

NG例:

設定方法は以下のとおりだ:

- 手順1
- 手順2

### ai-tech-writing-guideline: 冗長な義務表現

NG例:

設定ファイルを編集する必要がある。

---

## preset-ja-spacing

### ja-space-between-half-and-full-width: 半角・全角間のスペース

NG例（スペースあり）:

最新の API 仕様を確認する。

### ja-no-space-between-full-width: 全角文字間のスペース

NG例（全角文字間に半角スペース）:

日本語 文書 作成のガイドラインだ。

---

## prefer-tari-tari

NG例（片方だけたり表現）:

ファイルを読んだり書く。

---

## no-mixed-zenkaku-and-hankaku-alphabet

NG例（全角アルファベット）:

ＡＰＩを使用する。

---

## @textlint-ja/no-synonyms

NG例（同一文書内に同語の別表記が混在）:

システムのサーバとサーバーが混在している。

---

## period-in-list-item

デフォルト設定では「リスト末尾に句点なし」が正。
句点があるとエラーになる。

NG例（リスト末尾に不要な句点）:

- 項目Aだ。
- 項目Bだ。

---

## ja-no-orthographic-variants: 表記ゆれ

NG例:

組立と組み立てを混在して使っている。

---

## @textlint-ja/no-insert-re: れ足す言葉

NG例:

お酒は飲めれない。

---

## @textlint-ja/no-dropping-i: い抜き言葉

NG例:

現在開発してます。

---

## @textlint-ja/no-insert-dropping-sa: さ抜き・さ入れ

NG例（さ入れ）:

寿司が美味しさそうだ。

---

## prh: 生成AIの決まり文句

NG例:

重要なのは、テストを書くことだ。
この機能は多角的な観点からさらに掘り下げる必要があり、設定の見直しは不可欠だ。
ここでは、その理由について見ていく。
この設計は責務分離に他ならない。
核心的な問題を深掘りする。

---

## @cffnpwr/preset-ja-writing-extras

### no-dash: 地の文・見出しでのダッシュ

NG例（em ダッシュによる挿入）:

この機能——つまり自動保存——は便利だ。

### sentence-per-line: 一文一行

NG例（1行に複数の文）:

一文目だ。二文目だ。

### no-arbitrary-line-break: 段落内の任意位置での改行

NG例（区切り記号と無関係な位置での改行）:

この機能は長い説明が必要にな
るので途中で改行している。

### no-doubled-additive-conjunction: 累加の接続詞の連打

NG例（同一段落で累加の接続詞を2回使用）:

また、一つ目の理由がある。
さらに、二つ目の理由もある。
