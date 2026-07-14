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

`testify` を使う。継続してよい検証は `assert`、そこで打ち切るべき前提は `require` を使い分ける。

```go
import (
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)
```

- **正常系は期待値全体との完全一致で検証する。** `assert.Equal(t, want, got)` は deep equal なので、期待する構造体を 1 つ組み立てて全体を突き合わせる。フィールドごとに `assert.Equal` を並べない。
- **異常系はエラーの型・種別まで検証する。メッセージ文言は検証しない。**
  - **独自エラー型を使う場合**: reflect の型一致で検査する（`assert.IsType(t, wantErr, got)`）。ただし `fmt.Errorf("...: %w", err)` でラップされた経路ではトップレベルの具象型しか見ないため一致しない。ラップを跨ぐ場合は `errors.As` を使う。
  - **sentinel エラー値やラップされたエラー**: `errors.Is`（値の一致、`assert.ErrorIs`）/ `errors.As`（型の抽出、`assert.ErrorAs`）で検査する。これらは `%w` ラップをアンラップする。

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

## カバレッジ

`go test -cover` を使う。

```sh
go test -cover ./...
go test -coverprofile=cover.out ./...
go tool cover -html=cover.out       # ブラウザで確認
```

Go 標準のカバレッジは **文カバレッジ（C0）** で、`set` / `count` / `atomic` の各モードいずれも計測対象は文。**分岐カバレッジ（C1）は Go 標準ツールでは計測できない。** SKILL.md の方針どおり、各分岐の真・偽双方を通すケースをテーブルに人手で用意して C1 を担保する。
