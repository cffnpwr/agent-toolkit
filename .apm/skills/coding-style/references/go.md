# Go の書き方

本文の原則・表現をGoで適用するときの具体形。

## 値の集合

取りうる値が限られるものは、文字列のdefined typeと定数で閉じる。

```go
type Format string

const (
	FormatText     Format = "text"
	FormatMarkdown Format = "markdown"
	FormatJSON     Format = "json"
)
```

`iota`は数値化で意味が失われるため使わない。

```go
const (
	FormatText = iota
	FormatMarkdown
	FormatJSON
)
```

## 外部入力の検証

外部入力は構造体へデコードし、値域は検証ライブラリ（go-playground/validator等）に検査させる。

```go
type config struct {
	Limit   int `json:"limit" validate:"required,min=1"`
	MinSize int `json:"minSize" validate:"min=0"`
}

if err := validator.New().Struct(cfg); err != nil {
	return err
}
```

`if`の連鎖で手書き検証しない。

```go
if cfg.Limit < 1 {
	errs = append(errs, "limit")
}
if cfg.MinSize < 0 {
	errs = append(errs, "minSize")
}
```

## 型の置き場

型を使う主体が1つのパッケージ内のファイルにあるなら、そのファイルに定義する。

```go
// report.go（report パッケージ内でしか使わない）
type row struct {
	name  string
	count int
	size  int
}
```

1つのファイル内でしか使わない型のために`types.go`を作らない。

## 配置

standard project layoutに沿って配置し、ソースをフラットに置かない。

```text
cmd/exampleval/main.go
internal/config/config.go
internal/report/report.go
```

```text
main.go
config.go
report.go
```
