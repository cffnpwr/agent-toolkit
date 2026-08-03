# Go のテスト

言語非依存の方針（[SKILL.md](../SKILL.md)）を前提に、Go 固有の手順を示す。

## ランナーと実行

標準の `go test` を使う。

```sh
go test ./...              # 全パッケージ
go test -run <regexp> ./...  # 名前が <regexp> に一致するテストのみ
go test -v ./...           # 各テストの実行を表示
```

`-run` の引数は正規表現。サブテスト名の `[positive] ` / `[negative] ` の `[` `]` は文字クラスとして解釈されるため、これらで絞り込むときはエスケープする（例: `go test -run 'TestParse/\[positive\]'`）。

## 配置

テストは対象と同じディレクトリの `<name>_test.go` に置く。

- **同一パッケージ（`package foo`）を基本にする。** 内部要素にアクセスでき、ロジックを持つ private もテストできる。
- **公開契約のみを検証したい場合や import 循環を避けたい場合は `package foo_test`** にする（public API のみ見える）。

## スタイル（テーブルドリブン）

対象ごとに 1 つの `Test*` 関数を書き、その中でケースの構造体スライスを回す。各ケースは `t.Run` でサブテストにする。

```go
func TestParse(t *testing.T) {
    tests := []struct {
        name    string
        in      string
        want    int
        wantErr bool
    }{
        {name: "[positive] 数字のみのとき数値へ変換する", in: "42", want: 42},
        {name: "[negative] 空文字のときエラーになる", in: "", wantErr: true},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := Parse(tt.in)          // When
            if tt.wantErr {                   // Then
                require.Error(t, err)
                return
            }
            require.NoError(t, err)
            assert.Equal(t, tt.want, got)
        })
    }
}
```

サブテスト名は `[positive] ` / `[negative] ` を prefix に付け、「A が B のとき C」の形で入力条件と期待結果を書く。構造体スライスが Given、`t.Run` 内が When / Then にあたる。

## アサーション

`testify` と `github.com/google/go-cmp` を次のように使い分ける。`reflect.DeepEqual` の直書きは使わない（差分が出ず、失敗時に何が違うか読めない）。同じ判定目的に 2 つ以上の道具を使わない。下の用途分割（深い比較と、単純値・エラーの検査）は混在に当たらない。既存が片方だけのリポジトリでは既存慣行を優先し、道具の入れ替えは依頼範囲に含まれるときだけ行う。

- **エラーの有無・種別、単純な値の比較** → `testify`。継続してよい検証は `assert`、そこで打ち切るべき前提は `require` を使い分ける。
- **構造体・スライス・マップの深い比較** → `cmp.Diff`。

既存が `testify` のみのリポジトリで `go-cmp` を新規依存として足すかは、既存慣行優先に従って判断する。足さない場合、深い比較は `assert.Equal` の失敗出力が読みにくい前提で、比較対象を小さく切る。`cmpopts` の定番は `EquateEmpty`（nil スライスと空スライスを同一視）、`SortSlices`（順序非依存の比較）。

```go
import (
    "github.com/google/go-cmp/cmp"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)
```

- **正常系は期待値全体との完全一致で検証する。** 期待する構造体を 1 つ組み立てて全体を突き合わせる。フィールドごとにアサーションを並べない。
  - 深い構造では `cmp.Diff` を使う。`testify` の `assert.Equal` は要約行でポインタをアドレスのまま出し（`(*Install)(0x53ba...)`）、Diff 本文は前後 3 行に切られるため、入れ子の構造体スライスで 1 フィールドだけ違う失敗ではどの要素の差分か特定できない。`cmp.Diff` は構造全体の中で差分位置を示す。

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
  - **独自エラー型を使う場合**: reflect の型一致で検査する（`assert.IsType(t, wantErr, got)`）。ただし `fmt.Errorf("...: %w", err)` でラップされた経路ではトップレベルの具象型しか見ないため一致しない。ラップを跨ぐ場合は `errors.As` を使う。
  - **sentinel エラー値やラップされたエラー**: `errors.Is`（値の一致、`assert.ErrorIs`）/ `errors.As`（型の抽出、`assert.ErrorAs`）で検査する。これらは `%w` ラップをアンラップする。
  - **エラー型のフィールドを検証する**: `errors.As` で具象型を取り出してから、フィールド全体を `cmp.Diff` / `assert.Equal` で突き合わせる。メッセージ文言との突き合わせに流さない。

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

`exec.Command` を処理の中で直接呼ばず、`func(ctx context.Context, name string, args ...string) ([]byte, error)` のような関数型か interface で受け取る。テストでは呼び出し引数を記録するだけの fake を渡し、引数の組み立てと分岐を検証する。

CLI フレームワーク（cobra 等）では、コマンド定義に実処理を直接書くと継ぎ目が消える。実処理は依存としてコマンドへ注入し、テストは (1) 引数解釈と組み立て、(2) コマンドツリーの形、を fake 越しに検証する。

### ファイルシステム境界

**FS 抽象を既定にしない。** 実処理がテスト外へ書き込む問題は、抽象化ではなく**基準ディレクトリを引数で受けること**で消える。目的に応じて次から選ぶ。

- **既定（書き込みを含む処理）**: パスを外から受け、テストで `t.TempDir()` を渡す。実 FS だがテスト外へ漏れず、テストとサブテストの完了時に自動削除される。
- **読み取りだけのロジックで、実ファイルを置きたくない場合**: `fs.FS` を引数に取り、テストで `testing/fstest.MapFS` を渡す。`io/fs` に書き込み側インターフェースは無いため、書き込みを含む処理には使えない。
- **ルート外への書き込みを型で禁じたい場合**: `os.OpenRoot` / `*os.Root`（Go 1.24。`WriteFile` / `ReadFile` / `MkdirAll` / `RemoveAll` / `Rename` / `Symlink` は Go 1.25）。本番コード側の封じ込め手段で、テストでは `t.TempDir()` を開いて渡す。
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

**既定の `-cover` は、テスト対象パッケージ内からの呼び出しだけを数える。** `go help testflag` の `-coverpkg` の項に「The default is for each test to analyze only the package being tested」とあるとおり、別パッケージのテストからのみ呼ばれる関数は 0.0% と表示される。これを「未テスト」と読み違えないこと。

リポジトリ横断で見るときは `-coverpkg=./...` を付け、`go tool cover -func` で読む。`-coverpkg` を付けてもパッケージ別サマリ行の 0.0% は直らず、各行の意味が「そのテストバイナリがモジュール全体の何 % を通したか」に変わる（そのパッケージを 100% 網羅していても低い数値が出る）。サマリ行の数値は判断に使わない。

Go 標準のカバレッジは **文カバレッジ（C0）** で、`set` / `count` / `atomic` の各モードいずれも計測対象は文。**分岐カバレッジ（C1）は Go 標準ツールでは計測できない。** C1 を求められたときは、SKILL.md の「C1 を求められたときの手順」に従い、分岐の列挙と対応表からケースをテーブルに人手で足して担保する。`go tool cover` の数値を目標にしない。
