# Go

## 値の集合

- 取りうる値が限られるものは、文字列のdefined typeと定数で定義する
- `iota`は数値化で意味が失われるため使わない

### 良い例

```go
type Format string

const (
	FormatText     Format = "text"
	FormatMarkdown Format = "markdown"
	FormatJSON     Format = "json"
)
```

### 悪い例

```go
const (
	FormatText = iota
	FormatMarkdown
	FormatJSON
)
```

## 分岐の網羅

- Goの`switch`は網羅を検査しないため、[exhaustive](https://github.com/nishanths/exhaustive)（golangci-lintの`exhaustive`）で検査する
- `default`で列挙した定数の漏れを吸収しない

### 良い例

```go
switch format {
case FormatText:
	output = renderText(rows)
case FormatMarkdown:
	output = renderMarkdown(rows)
case FormatJSON:
	output = renderJSON(rows)
}
```

### 悪い例

```go
switch format {
case FormatText:
	output = renderText(rows)
default:
	output = renderJSON(rows)
}
```

## エラー型

- 外部に公開する関数が返すエラーは、自パッケージで定義したsentinel errorか独自のエラー型にする
- 下位のパッケージのエラーをそのまま返さない
- 下位のエラーを呼び出し側に見せる場合は、独自のエラー型の`Unwrap`で辿れるようにする
- 実装の詳細に当たる下位のエラーは、`%v`で文字列としてメッセージに含め、呼び出し側が取り出せないようにする
- エラーの判定は`errors.Is`・`errors.As`で行う

### 良い例

```go
var (
	ErrUserNotFound = errors.New("user not found")
	ErrLookupUser   = errors.New("lookup user failed")
)

func LookupUser(id string) (User, error) {
	user, err := db.find(id)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, ErrUserNotFound
	}
	if err != nil {
		return User{}, fmt.Errorf("%w: %v", ErrLookupUser, err)
	}
	return user, nil
}

type ConfigReadError struct {
	Path string
	Err  error
}

func (e *ConfigReadError) Error() string {
	return fmt.Sprintf("read config file %q: %v", e.Path, e.Err)
}

func (e *ConfigReadError) Unwrap() error {
	return e.Err
}

func ReadConfig(path string) (Config, error) {
	text, err := os.ReadFile(path)
	if err != nil {
		return Config{}, &ConfigReadError{Path: path, Err: err}
	}
	return parseConfig(text)
}
```

### 悪い例

```go
func LookupUser(id string) (User, error) {
	user, err := db.find(id)
	if err != nil {
		return User{}, err
	}
	return user, nil
}

func ReadConfig(path string) (Config, error) {
	text, err := os.ReadFile(path)
	if err != nil {
		return Config{}, fmt.Errorf("read config file %q: %w", path, err)
	}
	return parseConfig(text)
}
```

## 複数の値の受け渡し

- `(T, error)`・`(T, bool)`の複数戻り値は慣習として使用してよい
- それ以外の複数の値は構造体にまとめて返す

### 良い例

```go
func readConfig(path string) (Config, error)

value, ok := cache[key]

type Stats struct {
	Count int
	Size  int64
}

func collectStats(rows []Row) (Stats, error)
```

### 悪い例

```go
func collectStats(rows []Row) (int, int64, error)
```

## ディレクトリ・ファイル配置

standard project layoutに沿って配置し、ソースをフラットに置かない。

### 良い例

```text
.
├── cmd
│   └── exampleval
│       └── main.go
└── internal
    ├── config
    │   └── config.go
    └── report
        └── report.go
```

### 悪い例

```text
.
├── config.go
├── main.go
└── report.go
```
