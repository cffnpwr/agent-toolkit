# Go

## サブテストの絞り込み

`go test -run`の引数は正規表現のため、サブテスト名の`[`・`]`をエスケープする。

### 良い例

```sh
go test -run 'TestParse/\[positive\]' ./...
```

### 悪い例

```sh
go test -run 'TestParse/[positive]' ./...
```

## テストの配置

- テストは本番コードのファイルに対応する`<name>_test.go`として、対象と同じディレクトリに置く
- パッケージは同一パッケージ（`package foo`）を基本とする
- public APIのみを検証する場合・import循環を避ける場合は`package foo_test`にする
- 複数のテストファイルで共有するフィクスチャ・テストダブル・ヘルパーは、テスト関数を持たないファイル（`helper_test.go`等）に置く

### 良い例

```text
.
├── helper_test.go
├── install.go
├── install_test.go
├── parse.go
└── parse_test.go
```

### 悪い例

```text
.
├── all_test.go
├── install.go
└── parse.go
```

## テーブルドリブンテスト

- テスト対象ごとに1つの`Test*`関数を書き、ケースの構造体スライスの各要素を`t.Run`のサブテストとして実行する
- 前提条件（OS等）や照合方法が異なるケースも、入力フィールドを追加して同じテーブルに含める

### 良い例

```go
func TestInstall(t *testing.T) {
	tests := []struct {
		name    string
		goos    string
		wantErr error
	}{
		{name: "[positive] linuxのときインストールする", goos: "linux"},
		{name: "[negative] windowsのときErrUnsupportedOSになる", goos: "windows", wantErr: ErrUnsupportedOS},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := Install(tt.goos)

			if diff := cmp.Diff(tt.wantErr, err, cmpopts.EquateErrors()); diff != "" {
				t.Errorf("Install() error mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
```

### 悪い例

```go
func TestInstall(t *testing.T) { /* ... */ }

func TestInstallRequireOS(t *testing.T) { /* ... */ }
```

## ケースの構造体に置く関数値

- フィクスチャ・テストダブルを組み立てる関数値は、ケースの構造体に置いてよい
- 検証・実行する関数値（`check func(t *testing.T, got Result)`等）は置かない
- データで表せる前提は関数値にしない
- `t.Parallel()`を使うサブテストでは、共有状態を捕捉したクロージャを置かない

### 良い例

```go
tests := []struct {
	name      string
	newRunner func() *fakeRunner
	wantErr   error
}{
	{
		name:      "[negative] 2回目の呼び出しが失敗したときErrInstallになる",
		newRunner: func() *fakeRunner { return &fakeRunner{failAt: 2} },
		wantErr:   ErrInstall,
	},
}
```

### 悪い例

```go
tests := []struct {
	name  string
	check func(t *testing.T, got Result)
}{
	{
		name: "[positive] インストールする",
		check: func(t *testing.T, got Result) {
			if got.Installed != 1 {
				t.Errorf("Installed = %d", got.Installed)
			}
		},
	},
}
```

## エラーの検証

- 期待するエラーは`wantErr error`フィールドに置き、[`go-cmp`](https://github.com/google/go-cmp)の`cmp.Diff`と`cmpopts.EquateErrors()`で比較する
- 非nilであることだけを検証するケースには`cmpopts.AnyError`を置く
- エラーの比較がエラーの発生の検証を兼ねるため、`require.Error`を別に書かない
- 異常系でそれ以上の検証が不要な場合は、エラーを比較した後にreturnする

### 良い例

```go
if diff := cmp.Diff(tt.wantErr, err, cmpopts.EquateErrors()); diff != "" {
	t.Fatalf("Parse() error mismatch (-want +got):\n%s", diff)
}
if tt.wantErr != nil {
	return
}
```

### 悪い例

```go
require.Error(t, err)
if !strings.Contains(err.Error(), "input is empty") {
	t.Errorf("Parse() error = %v", err)
}
```

## エラー型のフィールドの検証

- エラー型の値をテーブルに置いても、`errors.Is`はポインタの同一性で比較するため一致しない
  - ドメイン上意味のある一致がある場合は、エラー型に`Is(target error) bool`を実装してもよい
- エラー型のフィールドを検証する場合は、`errors.As`で取り出して`cmp.Diff`で比較する

### 良い例

```go
var got *PathError
if !errors.As(err, &got) {
	t.Fatalf("Parse() error = %v, want *PathError", err)
}
if diff := cmp.Diff(tt.wantErr, got); diff != "" {
	t.Errorf("Parse() error mismatch (-want +got):\n%s", diff)
}
```

### 悪い例

```go
tests := []struct {
	name    string
	wantErr error
}{
	{name: "[negative] パスが不正なときPathErrorになる", wantErr: &PathError{Path: "a"}},
}
```

## アサーション

- オブジェクトの完全一致の比較には`cmp.Diff`を使い、`reflect.DeepEqual`・`assert.Equal`を使わない
- `testing`と`testify`を混在させない
  - テストの準備に`testify`の`require`・テスト対象の検証に標準の`testing`を使う形から選ぶ

### 良い例

```go
require.NoError(t, os.MkdirAll(dir, 0o755))

got, err := ParseConfig(path)

if diff := cmp.Diff(want, got); diff != "" {
	t.Errorf("ParseConfig() mismatch (-want +got):\n%s", diff)
}
```

### 悪い例

```go
if !reflect.DeepEqual(want, got) {
	t.Errorf("ParseConfig() = %v, want %v", got, want)
}
assert.Equal(t, want.Limit, got.Limit)
```

## 非公開フィールドを持つ型の比較

非公開フィールドが検証対象の場合は`cmp.AllowUnexported`を使い、生成時刻等の非決定的なフィールドだけを`cmpopts.IgnoreFields`で除外する。

- 公開されたgetter・フィールドで検証できる場合は、公開された値で検証する
- `cmpopts.IgnoreUnexported`は検証対象のフィールドの差分も無視するため、付随状態のみを持つ型以外に使わない

### 良い例

```go
opts := cmp.Options{
	cmp.AllowUnexported(Config{}),
	cmpopts.IgnoreFields(Config{}, "createdAt"),
}
if diff := cmp.Diff(want, got, opts); diff != "" {
	t.Errorf("ParseConfig() mismatch (-want +got):\n%s", diff)
}
```

### 悪い例

```go
if diff := cmp.Diff(want, got, cmpopts.IgnoreUnexported(Config{})); diff != "" {
	t.Errorf("ParseConfig() mismatch (-want +got):\n%s", diff)
}
```

## テストダブル

- プログラム外部へのアクセスはinterfaceで表す
  - メソッドが少ないinterfaceは手書きのfake、メソッドが多いinterfaceは`gomock`（`go.uber.org/mock`）で生成したモックを使う
- interfaceを埋め込んで一部のメソッドだけを実装したテストダブルを書かない
- 本番コードが使うinterfaceのメソッドが2〜3個の場合は、interfaceの代わりに必要な値を引数で受け取る

### 良い例

```go
type fakeClock struct{ t time.Time }

func (c fakeClock) Now() time.Time { return c.t }

func isStale(mode os.FileMode, modTime time.Time) bool
```

### 悪い例

```go
type fakeFileInfo struct {
	os.FileInfo
	mode    os.FileMode
	modTime time.Time
}

func (f fakeFileInfo) Mode() os.FileMode  { return f.mode }
func (f fakeFileInfo) ModTime() time.Time { return f.modTime }

func isStale(info os.FileInfo) bool
```

## HTTP通信

HTTP通信はinterfaceのモックでなく、`jarcoal/httpmock`でトランスポート層の応答を差し替える

### 良い例

```go
func TestFetchArticles(t *testing.T) {
	httpmock.Activate(t)
	httpmock.RegisterResponder("GET", "https://api.example.com/articles",
		httpmock.NewStringResponder(200, `[{"id":1}]`))
	// ...
}
```

### 悪い例

```go
type fakeHTTPClient struct{ resp *http.Response }

func (c fakeHTTPClient) Do(req *http.Request) (*http.Response, error) { return c.resp, nil }
```

## 外部コマンドの実行

- 外部コマンドは関数型・interfaceで受け取り、`exec.Command`を処理の中で直接呼ばない
- テストでは呼び出しを記録するfakeを渡し、コマンド名・引数・標準入力を`cmp.Diff`で期待値と比較する
- CLIフレームワーク（cobra等）では、実処理はコマンド定義に直接書かず、依存としてコマンドへ注入する

### 良い例

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

// テスト関数内での比較
if diff := cmp.Diff(tt.wantCalls, runner.calls); diff != "" {
	t.Errorf("calls mismatch (-want +got):\n%s", diff)
}
```

### 悪い例

```go
func Install(ctx context.Context, pkg string) error {
	return exec.CommandContext(ctx, "apt-get", "install", "-y", pkg).Run()
}
```

## ファイルシステムへのアクセス

- ファイルシステムは抽象化しない
- 基準ディレクトリを引数で受け取る形にし、テストでは`t.TempDir()`を渡す
- 読み取りのみの処理は`fs.FS`を引数で受け取り、テストでは`fstest.MapFS`を渡してもよい
  - `spf13/afero`は、in-memoryの書き込み可能なファイルシステムが必要な場合のみ使う

### 良い例

```go
func WriteConfig(dir string, cfg Config) error

func TestWriteConfig(t *testing.T) {
	dir := t.TempDir()
	// ...
}
```

### 悪い例

```go
func WriteConfig(cfg Config) error {
	return os.WriteFile("/etc/example/config.yaml", encode(cfg), 0o644)
}
```

## カバレッジ

- C1カバレッジは計測できないため、手動で担保する
- 既定の`-cover`はテスト対象パッケージ内からの呼び出しだけを数えるため、他のパッケージのテストからのみ呼ばれる関数は0.0%と表示される
- 他のパッケージからの呼び出しを含める場合は`-coverpkg=./...`を付け、`go tool cover -func`で関数ごとの値を確認する
  - `-coverpkg`を付けた場合のパッケージ別のサマリ行は、モジュール全体に対する割合のため判断に使わない

### 良い例

```sh
go test -coverpkg=./... -coverprofile=cover.out ./...
go tool cover -func=cover.out
```

### 悪い例

```sh
# 0.0%と表示された関数を未テストと判断する
go test -cover ./...
```
