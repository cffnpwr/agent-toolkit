---
name: difit-review
description: |
  difitを背景で起動し、人間が付けたレビューコメントの取得・対応・スレッドへの返信を、
  サーバを起動したまま何度も往復するワークフロー。
  次のときに使う。(1) 実装や文書の変更を人間にレビューしてもらい、指摘への対応と回答を
  繰り返したい、(2)「difitでレビューして」「difitを立ち上げて」「difitでレビューを受けたい」
  と言われた、(3) レビューコメントを取得して対応し、その結果をコメントスレッドへ返したい、
  (4) 前回のレビューコメントに返信したあと、追加のコメントを取りに行きたい。
  1往復で完結する（起動してコメントを受け取り、対応して終わる）場合は、difit同梱の
  difitスキルで足りるためこのスキルは使わない。
compatibility: |
  Required: difit >= 5.0.7（`difit`が無ければ`bunx difit`または`npx difit`で実行）
---

# difit Review

## 概要

difitを背景で起動したまま、`difit comment`のサブコマンドでコメントの取得と返信を繰り返し、
人間とのレビューを往復させる。

## Requirements

### 外部ツール

| ツール | バージョン要件 |
| --- | --- |
| difit | `>= 5.0.7` |

存在確認（欠けていれば停止・エスカレーション。Agentは外部ツールを導入しない）。

```sh
command -v difit >/dev/null 2>&1 || { echo "difit not found." >&2; exit 1; }
```

`difit`がPATHに無い場合は`bunx difit`または`npx difit`で実行してよい。
以下では`<difit>`をこのいずれかの呼び出しとして表記する。

## ワークフロー

### 1. 起動

ステージしていない変更を対象にする。

```sh
<difit> working --background --include-untracked
```

`{"port":4966,"url":"http://localhost:4966","pid":61900}`が出力される。
`port`と`pid`を以降の操作で使う。

`--background`は`--keep-alive`を自動で付けるため、利用者がタブを閉じてもサーバは残る。

### 2. 依頼

URLを利用者へ伝えて待つ。
レビュー完了の通知はdifit側から来ないので、利用者の合図で次へ進む。

### 3. 取得

```sh
<difit> comment get --port <port> --format json
```

各スレッドの`messages`を見て、最後のメッセージの`author`が`User`のものが未対応。
Agentが投入した返信に`author`は付かない。

`--format text`はファイル別に整形した一覧を返す。
全体を読むだけならこちらが短い。

### 4. 対応と返信

指摘に対応してから、スレッドへ返信する。
返信は取得した`filePath`と`position`をそのまま使う。

```sh
<difit> comment add --port <port> < replies.json
```

`replies.json`の形式を次に示す。

```json
[
  {
    "type": "reply",
    "filePath": "docs/design-doc/hooks.md",
    "position": { "side": "new", "line": 59 },
    "body": "指摘の箇所を4行に縮めました。"
  },
  {
    "type": "reply",
    "filePath": "docs/adr/README.md",
    "position": { "side": "new", "line": { "start": 19, "end": 20 } },
    "body": "本文構成の説明を削除しました。"
  }
]
```

- `type`は`reply`（同じ位置の最新スレッドへ返信）か`thread`（新規スレッド）。
- 本文は利用者の言語で書く。
- 差分に含まれる資格情報・トークンの類を本文へ写さない。

スレッドのresolveはAgentが行わない。
解消されたかを判断するのは人間で、resolveはその表明である。

### 5. 反映の確認

返信は利用者がページを再読み込みした時点で表示される。
クライアントはbootstrapでしかコメントを取得しないため、開いたままでは反映されない。
返信を投入したら、その旨を利用者へ伝える。

### 6. 繰り返しと完了

追加のコメントが付いたら3へ戻る。

レビューの完了は次の2つがそろったときとする。

- 利用者からレビュー完了の合図が出ている
- `<difit> comment get --port <port> --format json`の`threads`が空

resolveされたスレッドは一覧から取り除かれるため、未解決のものが残っていれば`threads`に現れる。
利用者の合図があっても`threads`が空でなければ、残っているスレッドを提示して完了としない。

完了したらサーバを止める。

```sh
kill <pid>
```

## 注意点

### 対象に`.`を使わない

コメントは`{base}-{target}`をキーに保存される。
`working`のキーは`staged-working`で固定されるが、`.`のbaseはHEADの短縮ハッシュへ解決される。
`.`を使うとHEADが動いた時点で利用者のページは新しいキーを見るため、それまでのコメントが表示されなくなる。
コメントは削除されず、前のキーの下に残る。
一方で`difit comment get`は起動時のキーを見続けるため、Agentだけが前のコメントを見続ける状態になる。

jjは作業コピーの変更をステージせずに保ち、新規ファイルもintent-to-addとして差分に現れるため、
`working`で作業中の内容を扱える。
gitでステージ済みの変更も見せる必要がある場合だけ`.`を使い、レビュー中はHEADを動かさない。

### その他

- 起動時に`--comment`でコメントを投入できる。
  レビュー観点や補足を先に見せる用途で使う。
