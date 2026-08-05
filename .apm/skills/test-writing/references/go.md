# Go のテスト

言語非依存の方針（[SKILL.md](../SKILL.md)）を前提に、Go 固有の手順を示す。

## ランナーと実行

標準の `go test` を使う。

```sh
go test ./...              # 全パッケージ
go test -run <regexp> ./...  # 名前が <regexp> に一致するテストのみ
go test -v ./...           # 各テストの実行を表示
```

`-run` の引数は正規表現。サブテスト名の `[positive] ` / `[negative] ` の `[` `]` は文字クラスとして解釈される。これらで絞り込むときはエスケープする（例: `go test -run 'TestParse/\[positive\]'`）。

## 配置

テストは対象と同じディレクトリの `<name>_test.go` に置く。

- **同一パッケージ（`package foo`）を基本にする。** 内部要素にアクセスでき、ロジックを持つ private もテストできる。
- **公開契約のみを検証したい場合や import 循環を避けたい場合は `package foo_test`** にする（public API のみ見える）。
- **テストファイルは本番コードのファイル分割に対応させる。** 1 パッケージに `<name>_test.go` を複数持ってよい。1 ファイルが大きくなったら、まず対応する本番コードの分割に合わせて割る。
- **複数のテストファイルが共有するフィクスチャ・ダブル・ヘルパは、テスト関数を持たない別ファイル（`helper_test.go` 等）へ分ける。** `_test.go` は本番のビルドに入らない。

## スタイル（テーブルドリブン）

対象ごとに 1 つの `Test*` 関数を書き、その中でケースの構造体スライスを回す。各ケースは `t.Run` でサブテストにする。

```go
func TestParse(t *testing.T) {
    tests := []struct {
        name      string
        in        string
        want      int
        wantErrIs error
    }{
        {name: "[positive] 数字のみのとき数値へ変換する", in: "42", want: 42},
        {name: "[negative] 空文字のときエラーになる", in: "", wantErrIs: ErrEmptyInput},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := Parse(tt.in)                        // When
            if !errors.Is(err, tt.wantErrIs) {              // Then
                t.Fatalf("Parse() error = %v, want errors.Is(err, %v)", err, tt.wantErrIs)
            }
            if diff := cmp.Diff(tt.want, got); diff != "" {
                t.Errorf("Parse() mismatch (-want +got):\n%s", diff)
            }
        })
    }
}
```

サブテスト名は `[positive] ` / `[negative] ` を prefix に付け、「A が B のとき C」の形で入力条件と期待結果を書く。構造体スライスが Given、`t.Run` 内が When / Then にあたる。ケースの構造体に導出可能なフィールドを置かないこと・1 つの概念を複数フィールドへ割らないことは[SKILL.md](../SKILL.md)の「構造」に従う。

### エラー分岐の形

異常系でそれ以上検証するものが無ければ、エラーを確認して早期 return する。

```go
if tt.wantErrIs != nil {
    if !errors.Is(err, tt.wantErrIs) {
        t.Fatalf("Parse() error = %v, want errors.Is(err, %v)", err, tt.wantErrIs)
    }
    return
}
```

正常系・異常系の**どちらでも**検証したいもの（外部コマンドの呼び出し列など）があると、早期 return は使えない。ここで `if tt.wantErr { ... } else { ... }` へ広げず、上のテンプレートのようにエラーの検証を 1 つの条件式にまとめ、後続の検証を分岐の外へ置く。

この形では異常系でも `got` が期待値（多くはゼロ値）と突き合わされる。エラー時の戻り値を規定したくない場合は早期 return の形を選ぶ。

## アサーション

道具は次の 3 つ。`reflect.DeepEqual` の直書きは使わない（差分が出ず、失敗時に何が違うか読めない）。

- **標準の `testing`**: 条件を自分で書き、`t.Fatal`（続行不能なので打ち切る）/ `t.Error`（記録して続行する）で報告する。
- **`testify`**（`github.com/stretchr/testify` の `assert` / `require`）: 条件と失敗メッセージを 1 行にまとめる。`require` が `t.Fatal`、`assert` が `t.Error` に対応する。
- **`github.com/google/go-cmp`**: 構造体・スライス・マップの深い比較。

深い比較を `cmp.Diff` が担うことは、標準の `testing` と `testify` のどちらを選ぶかと独立している。「同じ判定目的に複数の道具を使わない」（[SKILL.md](../SKILL.md)）に対して、この用途分割は混在に当たらない。

### 標準の testing と testify のどちらを使うか

**リポジトリ全体で 1 つに決める。** テストごと・書き手ごとに変えない。既存慣行があればそれを優先し、道具の入れ替えは依頼範囲に含まれるときだけ行う。

`testify` の利得は用途で偏る。

- **テストの準備**（`os.MkdirAll` 等の失敗を落とす）: `require.NoError(t, err)` の 1 行が、標準の `testing` では 3 行になる。ここが最も節約になる。
- **SUT の検証**: 節約は 1〜2 行に留まる。代わりに `assert`（続行）と `require`（打ち切り）の使い分けが全アサーションに付いて回る。深い比較は `cmp.Diff` が担うため、`assert.Equal` の担当はスカラーの比較に絞られる。

この偏りから、**SUT の検証は標準の `testing`、テストの準備だけ `testify`** と決める形も取れる。境界を「検証」と「準備」で引けるため、アサーションごとの判断が要らない。

`go-cmp` を新規依存として足すかは、既存慣行優先に従って判断する。足さない場合、深い比較は `assert.Equal` の失敗出力が読みにくい前提で、比較対象を小さく切る。`cmpopts` の定番は `EquateEmpty`（nil スライスと空スライスを同一視）、`SortSlices`（順序非依存の比較）。

### 何を検証するか

- **正常系は期待値全体との完全一致で検証する。** 期待する構造体を 1 つ組み立てて全体を突き合わせる。フィールドごとにアサーションを並べない。
  - 深い構造では `cmp.Diff` を使う。`testify` の `assert.Equal` は要約行でポインタをアドレスのまま出し（`(*Install)(0x53ba...)`）、Diff 本文を前後 3 行に切る。入れ子の構造体スライスで 1 フィールドだけ違う失敗では、どの要素の差分か特定できない。`cmp.Diff` は構造全体の中で差分位置を示す。

    ```go
    if diff := cmp.Diff(want, got); diff != "" {
        t.Errorf("Parse() mismatch (-want +got):\n%s", diff)
    }
    ```

  - `cmp` は非公開フィールドを持つ型で panic する（値が等しくても panic する）。ただし `time.Time` のように `Equal` メソッドを持つ型は panic しない。panic したら次の順で選ぶ。
    1. 公開経路（getter・公開フィールドへの射影）で検証できるなら、そちらへ寄せる。
    2. 非公開フィールドが検証対象なら `cmp.AllowUnexported(T{})` で比較に含める。生成時刻など非決定的な付随フィールドだけを `cmpopts.IgnoreFields(T{}, "fieldName")` / `cmpopts.EquateApproxTime` で個別に除く。
    3. `cmpopts.IgnoreUnexported(T{})` はその型の非公開フィールドを**すべて**外す。付随状態しか持たない型に限って使う。検証対象のフィールドが混ざっていると、差分があっても diff が空になりテストが緑のまま通る。

    `cmp` はテスト専用パッケージであり、本番コードでは使わない（[pkg doc](https://pkg.go.dev/github.com/google/go-cmp/cmp)）。
- **異常系はエラーの型・種別まで検証する。メッセージ文言は検証しない。**
  - **独自エラー型を使う場合**: 型の一致で検査する（`testify` なら `assert.IsType(t, wantErr, got)`）。ただし `fmt.Errorf("...: %w", err)` でラップされた経路ではトップレベルの具象型しか見ないため一致しない。ラップを跨ぐ場合は `errors.As` を使う。
  - **sentinel エラー値やラップされたエラー**: `errors.Is`（値の一致、`assert.ErrorIs`）/ `errors.As`（型の抽出、`assert.ErrorAs`）で検査する。これらは `%w` ラップをアンラップする。
  - **エラー型のフィールドを検証する**: `errors.As` で具象型を取り出してから、フィールド全体を `cmp.Diff` / `assert.Equal` で突き合わせる。メッセージ文言との突き合わせに流さない。
  - **`errors.Is` / `errors.As` は err が nil のとき false を返す。** エラーの詳細を検証していれば、そこに「エラーが起きたこと」の確認が含まれる。`require.Error` 相当を別に並べない。
  - **`errors.Is(err, nil)` は `err == nil` と等価。** テーブルの `wantErrIs` が nil のケースでこの性質が効く。「エラーを期待するか」の分岐なしに、正常系・異常系を 1 つの検証で書ける（上のテンプレートがこの形）。

    いずれも `$(go env GOROOT)/src/errors/wrap.go` で確認できる。`Is` は `err == nil || target == nil` のとき `err == target` を返し、`As` は先頭で `err == nil` を弾く。

    **値で受けるケースと型で受けるケースが同じテーブルに混在するときは、この形にできない。** 型で受けるケースでは、非 nil の err に対して `wantErrIs` が nil になる。`errors.Is(err, nil)` が false になるため、`wantErrIs != nil` の nil ガードを残す。

## 境界モック

外部境界は interface で表す。

- **小さな境界は手書きの fake 実装を基本にする。** interface を満たす構造体をテスト側に定義し、実物に近い挙動を持たせる。
- **境界が多い・複雑な場合は `gomock`（`go.uber.org/mock`）で生成する。**

```go
type Clock interface {
    Now() time.Time
}

// 手書き fake
type fakeClock struct{ t time.Time }

func (c fakeClock) Now() time.Time { return c.t }
```

`gomock` を使う場合は `mockgen` でモックを生成する。

```sh
go run go.uber.org/mock/mockgen -source=clock.go -destination=mock_clock_test.go -package=foo
```

内部モジュール同士はモックせず実物で繋ぐ。

### HTTP / ネットワーク境界

HTTP 境界は interface のモックでなく、トランスポート層で応答を差し替える。実物の HTTP クライアントとリクエスト組み立てコードをそのまま動かせる（TS の MSW と同じ位置づけ）。定番は `jarcoal/httpmock`。

```go
import "github.com/jarcoal/httpmock"

func TestFetchArticles(t *testing.T) {
    httpmock.Activate(t)
    httpmock.RegisterResponder("GET", "https://api.example.com/articles",
        httpmock.NewStringResponder(200, `[{"id":1}]`))

    // 実物のクライアントで呼ぶコードを検証する
}
```

`httpmock.ActivateNonDefault(client)` で既定でないクライアントの Transport を差し替える。無依存で済ませたい場合は標準ライブラリの `httptest.NewServer` でローカルにフェイクサーバを立てる。

### 外部コマンド境界

`exec.Command` を処理の中で直接呼ばず、関数型か interface で受け取る。テストでは呼び出しを記録するだけの fake を渡し、引数の組み立てと分岐を検証する。

記録した呼び出しは**全件・順序込み**で `cmp.Diff` により期待値と突き合わせる（[SKILL.md](../SKILL.md)の「モック / テストダブル」）。記録する構造体にコマンド名・引数だけでなく標準入力の内容も入れておくと、外部コマンドへ渡すために組み立てた生成物（設定ファイル本文など）がそのまま検証対象になる。

```go
type Runner interface {
    Run(ctx context.Context, name string, args []string, stdin string) ([]byte, error)
}

type call struct {
    Name  string
    Args  []string
    Stdin string
}

type fakeRunner struct{ calls []call }

func (r *fakeRunner) Run(ctx context.Context, name string, args []string, stdin string) ([]byte, error) {
    r.calls = append(r.calls, call{Name: name, Args: args, Stdin: stdin})
    return nil, nil
}

// Then
if diff := cmp.Diff(tt.wantCalls, runner.calls); diff != "" {
    t.Errorf("calls mismatch (-want +got):\n%s", diff)
}
```

CLI フレームワーク（cobra 等）では、コマンド定義に実処理を直接書くと継ぎ目が消える。実処理は依存としてコマンドへ注入し、テストは (1) 引数解釈と組み立て、(2) コマンドツリーの形、を fake 越しに検証する。

### ファイルシステム境界

**FS 抽象を既定にしない。** 実処理がテスト外へ書き込む問題は、抽象化ではなく**基準ディレクトリを引数で受けること**によって消える。目的に応じて次から選ぶ。

- **既定（書き込みを含む処理）**: パスを外から受け、テストで `t.TempDir()` を渡す。実 FS だがテスト外へ漏れず、テストとサブテストの完了時に自動削除される。
- **読み取りだけのロジックで、実ファイルを置きたくない場合**: `fs.FS` を引数に取り、テストで `testing/fstest.MapFS` を渡す。`io/fs` に書き込み側インターフェースはないため、書き込みを含む処理には使えない。
- **ルート外への書き込みを型で禁じたい場合**: `os.OpenRoot` / `*os.Root`（Go 1.24）。本番コード側の封じ込め手段で、テストでは `t.TempDir()` を開いて渡す。うち `WriteFile`・`ReadFile`・`MkdirAll`・`RemoveAll`・`Rename`・`Symlink` は Go 1.25。
- **in-memory の書き込み FS が要る場合のみ** `spf13/afero`。第三者依存なので、上の 3 つで足りるなら足さない。

## カバレッジ

`go test -cover` を使う。

```sh
go test -cover ./...
go test -coverprofile=cover.out ./...
go tool cover -html=cover.out                          # ブラウザで確認

go test -coverpkg=./... -coverprofile=cover.out ./...  # パッケージを跨いだ呼び出しを含める
go tool cover -func=cover.out                          # 関数ごとの数値
```

**既定の `-cover` は、テスト対象パッケージ内からの呼び出しだけを数える。** 別パッケージのテストからのみ呼ばれる関数は 0.0% と表示されるが、これを「未テスト」と読み違えないこと。`go help testflag` の `-coverpkg` の項に次の記述がある。

> The default is for each test to analyze only the package being tested

リポジトリ横断で見るときは `-coverpkg=./...` を付け、`go tool cover -func` で読む。`-coverpkg` を付けてもパッケージ別サマリ行の 0.0% は直らない。各行の意味が「そのテストバイナリがモジュール全体の何 % を通したか」に変わる（そのパッケージを 100% 網羅していても低い数値が出る）。サマリ行の数値は判断に使わない。

Go 標準のカバレッジは **文カバレッジ（C0）** で、`set` / `count` / `atomic` の各モードいずれも計測対象は文。**分岐カバレッジ（C1）は Go 標準ツールでは計測できない。** C1 を求められたときは、SKILL.md の「C1 を求められたときの手順」に従う。分岐の列挙と対応表から、ケースをテーブルに人手で足して担保する。`go tool cover` の数値を目標にしない。
