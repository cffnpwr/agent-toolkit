#!/bin/sh
# AGENTS.md の検証スクリプト（任意）。
#
# 決定的・冪等な検証処理なので切り出している。手動確認でも代替可能。
# Python 不要。POSIX sh と標準ツール（grep/sed/test 等）のみで動作する。
# `pipefail` を使うため、pipefail 対応の sh（POSIX.1-2024 準拠、または dash 0.5.12 以降・
# bash・ksh・zsh）が必要。
#
# チェック内容:
#   1. 本体から docs への参照切れ（問題として報告）。
#      Markdownリンク形式 `[...](.agents/docs/foo.md)` / `[...](docs/foo.md)` を対象に、
#      リポジトリモード（`.agents/docs/`）とグローバルモード（`docs/`）の両方を解決する
#      （いずれも本体の親ディレクトリ基準）。素のパス記述（リンクでない地の文）は、
#      ディレクトリ構成の説明等と区別できず偽陽性を生むため機械チェックの対象外。
#   2. 本体の `@`参照の検出（禁止ではなく、意図的な常時読み込みか確認を促す警告）。
#      `@`参照は「常時コンテキストに読み込ませたい」設計意図がある場合は許容される。
#      検出しても、それ単独では終了コードを 1 にしない。
#      パス様（`/` か `.` を含む）の `@xxx` のみ対象とし、`@mention` 等は除外する。
#
# 使い方:
#   ./check_references.sh [AGENTS.mdのパス]
#   （省略時はカレントディレクトリの AGENTS.md）
#
# 終了コード: 参照切れがあれば 1、なければ 0（`@`参照の検出だけでは 1 にしない）。

set -eu
set -o pipefail   # 別行にして -euo 連結形のシェル差を避ける（pipefail対応shが前提）

# grep ラッパー: マッチあり(0)/マッチなし(1) はどちらも正常、実エラー(>=2)は致命とする。
# `|| true` で全ての非ゼロを握りつぶすと、ファイル不読等の実エラーも隠れてしまうため、
# 終了コード 1（マッチなし）だけを正常へ畳み込み、それ以外は呼び出し元へ伝播させる。
grep_safe() {
    grep "$@" || [ "$?" -eq 1 ]
}

target="${1:-AGENTS.md}"

if [ ! -f "$target" ]; then
    echo "error: $target not found" >&2
    exit 1
fi

# AGENTS.md の親ディレクトリを参照解決の基準にする
root=$(dirname "$target")

problems=0
notices=0

# 1. Markdownリンク内の docs 参照を抽出して実在を確認（参照切れは問題）。
#    `](docs/foo.md)` / `](.agents/docs/foo.md)` / `](./docs/foo.md)` / アンカー付き
#    `](docs/foo.md#sec)` にマッチさせる。`](` と `)`・先頭 `./`・`#`以降を除去し、
#    重複除去のうえ各パスを root 基準で test -f する。
refs=$(grep_safe -oE '\]\((\./)?(\.agents/)?docs/[^)#]+\.md(#[^)]*)?\)' "$target" \
    | sed -E 's/^\]\(//; s/\)$//; s/#.*$//; s/^\.\///' \
    | sort -u)

if [ -n "$refs" ]; then
    # IFS を改行のみにして 1 行ずつ処理する
    OLDIFS=$IFS
    IFS='
'
    for ref in $refs; do
        if [ ! -f "$root/$ref" ]; then
            echo "broken reference: $ref not found"
            problems=$((problems + 1))
        fi
    done
    IFS=$OLDIFS
fi

# 2. @参照の検出（行頭または空白後の、パス様の @path）。
#    禁止ではなく、意図的な常時読み込みかの確認を促す警告。
#    `/` か `.` を含むものだけを対象とし、`@mention` 等を除外する。
#    メールアドレス（`user@example.com` 等）は @ の直前が空白/行頭でないためマッチしない。
#    バッククォートで囲われたパッケージ名（`@types/node` 等）も直前がバッククォートのため除外。
at_pattern='(^|[[:space:]])@[A-Za-z0-9_~-]*[./][A-Za-z0-9._/~-]+'
notice_lines=$(grep_safe -nE "$at_pattern" "$target")

if [ -n "$notice_lines" ]; then
    OLDIFS=$IFS
    IFS='
'
    for entry in $notice_lines; do
        # 行番号と本文を分離する
        lineno=${entry%%:*}
        line=${entry#*:}
        # 行中の各 @参照を抽出して個別に報告する
        matches=$(printf '%s\n' "$line" | grep_safe -oE "$at_pattern")
        innerIFS=$IFS
        IFS='
'
        for m in $matches; do
            # 先頭の空白を除去し @参照のみを取り出す
            ref=$(printf '%s' "$m" | sed -E 's/^[[:space:]]*//')
            echo "line ${lineno}: @-reference found (${ref}) — confirm it is an intentional always-load reference"
            notices=$((notices + 1))
        done
        IFS=$innerIFS
    done
    IFS=$OLDIFS
fi

if [ "$problems" -gt 0 ]; then
    exit 1
fi

if [ "$notices" -gt 0 ]; then
    echo "OK: no broken references (confirm the @-references above are intentional)"
else
    echo "OK: no broken references, no @-references"
fi
exit 0
