#!/bin/sh
# jj-commitlint hookの起動スクリプト。
# PostToolUse入力をstdinで受け、jj関連の操作だけを本体main.tsに渡す。
# 対象サブコマンドの判定は本体に委ね、非jj操作はbun起動前に除外する。
# bunが無いときはfail-openの警告を出して通す。
set -u

# PostToolUseのJSON入力を取得する。
input=$(cat)

# bunを起動しないための事前フィルタ。
# jjを含まなければ即通過し、対象判定は本体main.tsに任せる。
case "$input" in
  *jj*) ;;
  *) exit 0 ;;
esac

# 自身のディレクトリを基準にmain.tsを解決する(引数順・cwd非依存)。
dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

# bun存在確認。無ければfail-open(警告して通し、導入はユーザーに委ねる)。
if ! command -v bun >/dev/null 2>&1; then
  echo "jj-commitlint: bun not found; cannot run the commitlint gate. The commit message may violate user-defined rules." >&2
  exit 1
fi

# stdinを本体へ渡し、終了コードを伝播する。
printf '%s' "$input" | bun "$dir/main.ts"
exit $?
