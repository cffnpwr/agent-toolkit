---
name: jj-reference
description: Git利用者向けのJujutsu (jj) VCSコマンドリファレンス。コミット・プッシュ・ブランチ・リベース・履歴閲覧・コンフリクト解決など、あらゆるバージョン管理操作を行うときに使う。git→jjのコマンド変換と、jj流のワークフロー、AIエージェントが非対話で操作するための指針を提供する。
compatibility: |
  Required: jj (Jujutsu) >= 0.42。外部ツールとしてホスト側で充足する。
  依存パッケージ・同梱スクリプトなし。
---

# Jujutsu (jj) コマンドリファレンス

VCS操作は`jj`を使う。jjに相当機能が無い場合のみ`git`にフォールバックする。

## Requirements

外部ツール`jj`がホスト側で利用可能であることを前提とする。不在時は進行を停止しユーザーへエスカレーションする（Agentは導入しない）。

### 外部ツール

| ツール | バージョン要件 |
| --- | --- |
| jj (Jujutsu) | `>= 0.42` |

存在確認コマンドを次に示す。

```sh
command -v jj >/dev/null 2>&1 || { echo "jj not found." >&2; exit 1; }
```

## 基本概念

- **作業コピーがコミット**（`@`）— ステージング領域は無く、`git add`は不要。
- **Change ID** — 改変しても不変の安定識別子（例: `wuloypwt`）。
- **Commit ID** — 内容ハッシュ。変更のたびに変わる（例: `182d3ce4`）。
- **Bookmark** — jjにおけるgitブランチ相当。
- **`jj undo`** — 直前の操作を安全に巻き戻す。

## AIエージェント運用上の注意

AIエージェントは対話的TUI・エディタを操作できない。以下の対話的サブコマンドは使わず、非対話形で代替する。

- 引数なしの`jj split`・`jj squash -i`・`jj arrange`・`jj resolve`・`-m`なしの`jj describe`/`jj commit`はエディタまたはTUIを開く。
- メッセージは常に`-m`で渡す。
- 履歴の参照・指定には安定なchange IDを使う。commit IDは改変で変わるため避ける。

| やりたいこと | 対話形（不可） | 非対話形（使う） |
|---|---|---|
| 変更を分割 | `jj split` | `jj split FILESET... -m "msg"`（ファイル指定＋メッセージ） |
| 一部を親へ移動 | `jj squash -i` | `jj squash --from REV --into REV -u`（`-u`=移動先の説明を流用） / `jj squash PATH -u` |
| 履歴中へ並べ替え・挿入 | `jj arrange` | `jj rebase -r REV --before REV` / `--after REV` |
| コンフリクト解決 | `jj resolve` | ファイルを直接編集（下記参照） |

## Git→jj コマンド対応表

| 用途 | git | jj |
|---|---|---|
| リポジトリ初期化 | `git init` | `jj git init`（colocateがデフォルト） |
| クローン | `git clone URL` | `jj git clone URL` |
| ステータス | `git status` | `jj st` |
| 差分（作業コピー） | `git diff HEAD` | `jj diff` |
| 差分（特定change） | `git diff A^ A` | `jj diff -r A` |
| ログ | `git log --oneline --graph` | `jj log` |
| ファイル追加 | `git add .` | （不要） |
| コミット | `git commit -a -m "msg"` | `jj describe -m "msg"` |
| コミットして新規開始 | `git commit -a -m "msg"` | `jj commit -m "msg"`（= describe + new） |
| 新規作業を開始 | `git checkout -b feat` | `jj new -m "feat"` |
| mainから開始 | `git checkout -b feat main` | `jj new main -m "feat"` |
| メッセージ修正 | `git commit --amend` | `jj describe -m "new msg"` |
| 著者を変更 | `git commit --amend --author="N <e>"` | `jj metaedit --author "N <e>" -r REV` |
| 著者を設定ユーザーに更新 | `git commit --amend --reset-author` | `jj metaedit --update-author -r REV` |
| ファイル修正の取り込み | `git add .; git commit --amend` | （ファイルを編集するだけ — `@`が自動更新） |
| 退避（stash） | `git stash` | `jj new @-`（元のchangeは兄弟として残る） |
| changeへ切り替え | `git checkout X` | `jj edit X` |
| bookmark作成 | `git branch X` | `jj bookmark create X` |
| bookmark移動 | `git branch -f X` | `jj bookmark move X --to REV` |
| bookmark一覧 | `git branch` | `jj bookmark list` |
| bookmark削除 | `git branch -d X` | `jj bookmark delete X` |
| tag一覧 | `git tag` / `git tag -l` | `jj tag list`（別名 `jj tag l`） |
| tag作成 | `git tag NAME` | `jj tag set NAME`（既定で`@`を指す。`-r REV`で対象指定） |
| tag移動 | `git tag -f NAME REV` | `jj tag set NAME -r REV --allow-move` |
| tag削除（ローカル） | `git tag -d NAME` | `jj tag delete NAME` |
| フェッチ | `git fetch` | `jj git fetch` |
| プッシュ | `git push` | `jj git push` |
| 新規bookmarkをプッシュ | `git push -u origin X` | `jj git push --bookmark X`（未追跡bookmarkは自動追跡される） |
| リベース（宛先へ） | `git rebase dest` | `jj rebase -d dest` |
| ブランチをmainへリベース | `git rebase main` | `jj rebase -b @ -d main` |
| 親へsquash | `git reset --soft HEAD~; git commit` | `jj squash` |
| 特定ファイルをsquash | N/A | `jj squash path/to/file` |
| 変更を祖先スタックへ自動分配 | N/A | `jj absorb` |
| 変更を分割 | `git add -p; git commit` | `jj split FILESET... -m "msg"` |
| マージ | `git merge A` | `jj new @ A` |
| チェリーピック | `git cherry-pick X` | `jj duplicate X -d @` |
| changeをリバート | `git revert X` | `jj revert -r X --insert-after @` |
| 作業変更を破棄 | `git checkout -- .` | `jj restore` |
| 特定ファイルを復元 | `git checkout -- FILE` | `jj restore FILE` |
| changeを破棄 | `git reset --hard` | `jj abandon` |
| 直前の操作を取り消し | （相当なし） | `jj undo` |
| 操作ログ | （相当なし） | `jj op log` |
| 過去のchangeを編集 | `git rebase -i` | `jj edit CHANGE_ID` |
| revのファイル内容を表示 | `git show REV:FILE` | `jj file show FILE -r REV` |
| 追跡ファイル一覧 | `git ls-files` | `jj file list` |
| 文字列を追加/削除したchangeを検索（pickaxe） | `git log -S "text" -- PATH` / `git log -G "regex"` | `jj log -r 'diff_lines(substring:"text", "PATH")'`（[検索](#履歴内容の検索diff_lines)参照） |
| パスを変更したchangeを検索 | `git log -- PATH` | `jj log -r 'files("PATH")'` |
| リモート追加 | `git remote add NAME URL` | `jj git remote add NAME URL` |

## 著者(author)の指定・変更

`jj describe`・`jj commit`には`--author`オプションが無い。著者(author)はコミット作成時の設定値から決まり、既存changeの著者変更は`jj metaedit`で行う。

### 新規コミットの著者を決める

新規に作るchangeの著者は、次の優先で解決される（いずれも未設定だと著者欄が空になる）。

- 永続設定 `user.name` / `user.email`
- 環境変数 `JJ_USER` / `JJ_EMAIL`（その実行に限り上書き）
- `--config user.name=...` / `--config user.email=...`（同上）

```bash
# 永続設定（ユーザー全体）
jj config set --user user.name "Foo Bar"
jj config set --user user.email "foo@bar.com"

# このリポジトリのみ
jj config set --repo user.email "foo@work.example.com"

# 単発の実行だけ別著者で（環境変数 / --config いずれでも可）
JJ_USER="Foo Bar" JJ_EMAIL="foo@bar.com" jj commit -m "msg"
jj commit -m "msg" --config user.name="Foo Bar" --config user.email="foo@bar.com"
```

### 既存changeの著者を変更する

`jj metaedit`は内容を変えずにメタデータ（著者・著者日時・change description）のみを更新する。対象revisionの既定は`@`。

```bash
# 著者名・メールを指定文字列に設定（著者日時は保持）
jj metaedit --author "Foo Bar <foo@bar.com>" -r REV

# 著者を設定ユーザー(user.name/user.email)に更新。JJ_USER/JJ_EMAILと併用可
jj metaedit --update-author -r REV
JJ_USER="Foo Bar" JJ_EMAIL="foo@bar.com" jj metaedit --update-author -r REV

# 著者日時を現在時刻に更新（著者名・メールは変えない）
jj metaedit --update-author-timestamp -r REV

# 著者日時を指定日時に設定（RFC2822 または RFC3339）
jj metaedit --author-timestamp "2000-01-23T01:23:45-08:00" -r REV
```

メタデータを更新すると、その子孫コミットのcommitter名・メール・日時も更新される。

## タグ(tag)

tagの一覧・作成・更新・削除は`jj tag`で完結する（`git tag`へのフォールバックは不要）。

```bash
# 一覧（インポート済みgit tagも表示される）
jj tag list

# 作成（既定で@を指す / -r で対象revisionを指定）
jj tag set v1.0.0
jj tag set v1.0.0 -r REV

# 移動（既存tagの付け替えには --allow-move が必要）
jj tag set v1.0.0 -r REV --allow-move

# 削除（ローカル。tagが指すrevisionはabandonされない）
jj tag delete v1.0.0
```

作成・更新したtagは、colocate環境では常にlightweight tagとしてGitへエクスポートされる。

**リモートへのtag公開はgitフォールバックが必要**。`jj git push`はbookmarkのみを対象とし、tagをpushしない。tagをリモートへ送るには`git push origin TAG`（または`git push --tags`）を使う。

## コンフリクト解決

jjはコンフリクトをコミット内に保存し、作業コピーのファイルにマーカー（`<<<<<<<`等）を書き込む。コンフリクトがあっても操作は止まらない。

```bash
jj st     # コンフリクトしたファイルが表示される
jj log    # コンフリクトを含むコミットに印が付く
```

解決手順:

1. 該当ファイルを直接編集し、マーカーを除去して正しい内容にする。
2. `jj st`で残コンフリクトが消えたことを確認する。

作業コピー（`@`）を編集すれば結果は自動で記録される（`git add`相当は不要）。`jj resolve`は外部マージツールを起動する対話的コマンドのため、エージェントは使わない。

リベースで生じたコンフリクトは子孫のコミットへ伝播する。`jj edit CHANGE_ID`で当該コミットへ移動して解決すると、解決結果も子孫へ伝播する。

## よくあるワークフロー

### mainから新規作業を開始
```bash
jj git fetch
jj new main@origin -m "description of work"
```

### 新規featureをプッシュ
```bash
jj bookmark create my-feature -r @
jj git push --bookmark my-feature
```

### 変更後に既存bookmarkを更新
```bash
jj bookmark set my-feature -r @
jj git push
```

### 現在のスタックを最新mainへリベース
```bash
jj git fetch
jj rebase -b @ -d main@origin
```

### 過去のchangeを修正
```bash
jj edit CHANGE_ID    # そのchangeへ切り替え
# 編集する...
jj new               # 先端へ戻り作業を継続
```

### チェーンを1つのchangeへsquash
```bash
jj squash --from FIRST::@- --into @
```

## リブセット（よく使うパターン）

| Revset | 意味 |
|---|---|
| `@` | 現在の作業コピー |
| `@-` | 作業コピーの親 |
| `main` | "main"という名のbookmark |
| `main@origin` | リモートbookmark |
| `trunk()` | メインブランチのtrunk |
| `bookmarks()` | 全ローカルbookmark |
| `mine()` | 自分が作成したchange |
| `A::B` | AからB（両端含む） |
| `A..B` | AとBの間（Aを除く） |
| `all()` | 到達可能な全change |
| `files(fileset)` | 指定パスを変更したchange |
| `diff_lines(text, [files])` | 差分行が`text`にマッチするchange（git pickaxe相当） |

## 履歴内容の検索（diff_lines）

gitのpickaxe（`git log -S`/`-G`）に相当する検索は、revset関数`diff_lines(text, [files])`で行う（jj 0.38.0で`diff_contains`から改称。最低要件0.42で利用可）。差分行が`text`にマッチするchangeを絞り込む。

```bash
# "completion"を追加/削除したchangeを、homedir配下に限定して検索
jj log -r 'diff_lines(substring:"completion", "homedir")'
```

注意点:

- **パターン種別の既定は`glob:`**。`diff_lines("completion", …)`は`completion`と完全一致する行のみ。部分一致は`substring:"completion"`、正規表現は`regex:"…"`を明示する。
- **`files`引数のパスは`jj`の起動ディレクトリ基準**で解決される。`-R`で別リポジトリを指す等でcwdとずれる場合は`root:"PATH"`（リポジトリルート基準）を使う。
- **semanticsは`-G`寄り**。git `-S`固有の「出現回数の増減」判定に厳密対応する関数は無いが、「その文字列を追加/削除したchangeを探す」用途は`diff_lines`で足りる。
- 追加側/削除側のみに絞るには`diff_lines_added()`/`diff_lines_removed()`（0.40.0以降）。

## gitにフォールバックする場面

jjが未対応の操作のみ`git`を直接使う。

- git固有の設定を扱う`git config`（ただし`jj config`を優先）
- `git submodule`系コマンド
- `git lfs`系コマンド
- jjのツールでは不十分な、生のgitオブジェクトの読み取り
- tagのリモートpush（`jj git push`はbookmarkのみ。`git push origin TAG`を使う）
- git CLIを要求するサードパーティのgitフック・連携

それ以外はすべて`jj`を使う。
