# 検証・統合・cleanupの手順

Step 4（独立検証）・Step 6（統合）・Step 7（cleanup）の具体手順。すべて親が実行する。リポジトリルートに`.jj`があれば「jjの場合」、無ければ「gitの場合」の手順を使う。

## jjの場合

### 前提: snapshotとworkspaceの関係

- jjは実行時、**cwdが属するworkspaceの作業コピーだけ**をsnapshotする。子は変更系のVCS操作をせず読み取りも`--ignore-working-copy`付きのため、taskワークスペースの変更を作業コミット（`<タスクID>@`）へ取り込むには、親がtaskワークスペース内をcwdにしてjjコマンドを実行する必要がある。これを行うまで`<タスクID>@`は空のままである。
- rebaseで書き換わってもchange idは安定なので、コミットの参照にはchange idを使う。

対話承認（コミット署名等）が必要な環境では、次のように運用する。

- snapshotを伴う操作（`--ignore-working-copy`を付けないjjコマンドは、変更を作らない`jj st`・`jj diff`等でも実行時にsnapshotする）はバックグラウンド実行し、ユーザーへ承認操作を依頼する。
- 参照だけが目的のコマンドは`--ignore-working-copy`を付けてsnapshotを回避する。

### Step 4: 独立検証

まずtaskワークスペース内でsnapshotし、子の変更を`<タスクID>@`へ取り込む。

```sh
cd .tmp/agent-workspaces/<タスクID> && jj st
```

続いて`<タスクID>@`のcommit idを控える（Step 6でユーザー手修正の検知に使う）。

```sh
jj log -r '<タスクID>@' --ignore-working-copy --no-pager
```

タスクの差分を列挙・点検する。

```sh
jj diff -r '<タスクID>@' --ignore-working-copy
```

本体の`@-`がworkspaceのbaseと一致している間は、ファイルシステム直接比較でも代替できる（snapshot前でも使える）。先行タスクの統合で本体が先へ進んでいる場合は、統合済みの変更が偽差分として混入するため使わない。

```sh
diff -rq --exclude=.jj --exclude=.tmp --exclude=<ビルド成果物ディレクトリ> <本体リポジトリroot> .tmp/agent-workspaces/<タスクID>
```

`--exclude=.tmp`は必須（workspace自身が本体側の`.tmp/`配下にあるため）。`<ビルド成果物ディレクトリ>`はプロジェクトに応じて指定する（例: `target`・`node_modules`・`dist`）。

各ファイルを`diff -u`またはReadで点検し、workspace内で品質ゲート（fmt・lint・test等）を親が再実行する。観点は、タスクリストの仕様との一致・既存パターンへの追従・スコープ逸脱の有無・並行タスクの先取りの有無。

### Step 6: 統合（単独タスク）

1. taskワークスペース内で再度snapshotし、`<タスクID>@`のcommit idをStep 4で控えたものと比較する。変わっていればユーザー手修正分なので、差分を点検してから進む。

   ```sh
   jj diff --from <控えたcommit id> --to '<タスクID>@' --ignore-working-copy
   ```

2. 作業コミットへコミットメッセージを付ける（プロジェクトのコミット規約に従う）。

   ```sh
   jj describe '<タスクID>@' -m "<コミットメッセージ>"
   ```

3. 本体working copyを統合先端の上へ移す。

   ```sh
   jj new '<タスクID>@'
   ```

手順2〜3の代わりに、taskワークスペース内で`jj commit -m "<コミットメッセージ>"`を使ってもよい（記述の付与と新しい空コミットの作成を一度に行う）。その場合、`<タスクID>@`は空コミットへ進むため、本体の`jj new`には記述を付けた作業コミットのchange idを渡す。

### Step 6: 統合（並行タスク）

1. 各taskワークスペース内でsnapshotし、手修正の有無を確認する（単独タスクの手順1と同じ）。
2. 各作業コミットへ`jj describe`でメッセージを付け、change idを控える。
3. `jj rebase`で線形化する（AをベースにBを積む）。

   ```sh
   jj rebase -s <Bのchange id> -d <Aのchange id>
   ```

4. 競合が出たら、本体workspaceで競合コミットに乗って解消する。

   ```sh
   jj edit <Bのchange id>
   ```

   競合markerが本体作業コピーに実体化するので、ファイルを編集して解消する。
   - 両タスクが同じ集約ファイルへ独立に追加した場合は両方の追加を取り込み、必要なら意味的な整合（片方のタスクが導入したフィールドをもう片方のテストへ補う等）まで親が行う。
   - 生成物のロックファイル（`Cargo.lock`・`bun.lock`等）は手動マージせず、片側を復元してツールに再生成させる（`--into`省略時は現在の作業コピー、つまり編集中の競合コミットへ復元される）。

     ```sh
     jj restore --from <Aのchange id> <ロックファイル>
     ```

5. 競合markerの残存が無いことをgrepで確認する（`<<<<<<<`等）。
6. 統合ツリー（現在の本体作業コピー）で品質ゲートを再実行する。各workspaceで通っていても、統合後のツリーで通るとは限らない。
7. 本体working copyを統合先端上の空コミットへ戻す。

   ```sh
   jj new
   ```

補足: rebaseやdescribeで他workspaceの`@`がstale化しても、そのworkspaceを続用しない限り対処不要（cleanupで消える）。続用する場合のみ該当workspace内で`jj workspace update-stale`を実行する。

### Step 7: cleanup

```sh
jj workspace forget <タスクID>
```

```sh
rm -rf .tmp/agent-workspaces/<タスクID>
```

forget時、空で説明の無い作業コミットは自動的にabandonされる。追加の`jj abandon`は不要。

## gitの場合

worktree作成時にタスクブランチ`agent/<タスクID>`を切ってある（Step 2）。変更はコミットせず作業ツリーに残し、コミットは統合時に親が行う。

### Step 4: 独立検証

変更ファイルを列挙し（未追跡ファイルも含まれる）、一覧を控える（Step 6でユーザー手修正の検知に使う）。

```sh
git -C .tmp/agent-workspaces/<タスクID> status --porcelain
```

追跡ファイルの差分は`git -C <worktree> diff`、未追跡ファイルはReadで点検する。worktree内で品質ゲート（fmt・lint・test等）を親が再実行する。観点は、タスクリストの仕様との一致・既存パターンへの追従・スコープ逸脱の有無・並行タスクの先取りの有無。

### Step 6: 統合（単独タスク）

1. `git status --porcelain`をStep 4で控えた一覧と比較し、増分（ユーザー手修正等）があれば点検してから進む。
2. worktree内で親がコミットする（プロジェクトのコミット規約に従う）。

   ```sh
   git -C .tmp/agent-workspaces/<タスクID> add -A
   ```

   ```sh
   git -C .tmp/agent-workspaces/<タスクID> commit -m "<コミットメッセージ>"
   ```

3. 本体でタスクブランチをfast-forward統合する。

   ```sh
   git merge --ff-only agent/<タスクID>
   ```

   先行統合等で本体が`<base>`から進んでいて fast-forward できない場合は、worktree内で`git rebase <本体の先端>`してから再度`git merge --ff-only`する。

### Step 6: 統合（並行タスク）

1. 各worktreeで手修正の有無を確認し（単独タスクの手順1）、親がコミットする（単独タスクの手順2）。
2. 先にAを本体へ`git merge --ff-only agent/<Aのid>`で統合する。
3. Bのworktreeで新しい本体先端へrebaseする。

   ```sh
   git -C .tmp/agent-workspaces/<Bのid> rebase <本体の先端>
   ```

4. 競合が出たら、Bのworktree内のファイルを編集して解消する。
   - 両タスクが同じ集約ファイルへ独立に追加した場合は両方の追加を取り込み、必要なら意味的な整合（片方のタスクが導入したフィールドをもう片方のテストへ補う等）まで親が行う。
   - 生成物のロックファイル（`Cargo.lock`・`bun.lock`等）は手動マージせず、片側を復元してツールに再生成させる。

     ```sh
     git -C .tmp/agent-workspaces/<Bのid> restore --source=<Aの先端> <ロックファイル>
     ```

   解消後に`git add`して`git rebase --continue`する。
5. 競合markerの残存が無いことをgrepで確認する（`<<<<<<<`等）。
6. Bのworktree（＝統合ツリー）で品質ゲートを再実行する。各worktreeで通っていても、統合後のツリーで通るとは限らない。
7. 本体で`git merge --ff-only agent/<Bのid>`する。

### Step 7: cleanup

```sh
git worktree remove .tmp/agent-workspaces/<タスクID>
```

```sh
git branch -d agent/<タスクID>
```

統合済みなら`-d`で消える（`-D`が必要な状態は未統合の変更が残っている兆候なので、削除せず確認する）。

## 共通事項

- 統合コミットの内容が確定したら、タスクリストの該当タスクへ完了マークを付ける（Step 7）。
- cleanupは統合が完了し統合ツリーの品質ゲートが通ってから、ユーザーの指示を待たずに行う。
- Agent自体は破棄せず保持する。以後の修正指示は同一AgentへSendMessageで送る。
