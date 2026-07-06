#!/bin/sh
# command-chain-guard hookの起動スクリプト。
# PreToolUse入力をstdinで受け、&&・||・;(改行含む)の可能性がある呼び出しだけを本体main.tsに渡す。
# 対象判定・例外判定は本体に委ね、明らかに該当しない呼び出しはbun起動前に除外する。
# bunが無いときはfail-openの警告を出して通す。
set -u

# PreToolUseのJSON入力を取得する。
input=$(cat)

# セッション全体の無効化。環境変数COMMAND_CHAIN_GUARD_DISABLEが真値なら通過する。
# 偽値(未設定・空・0・false・no・off。大文字小文字無視)は無効化しない(git-configのbooleanの偽値に合わせる)。
case "${COMMAND_CHAIN_GUARD_DISABLE:-}" in
  "" | 0 | [Ff][Aa][Ll][Ss][Ee] | [Nn][Oo] | [Oo][Ff][Ff]) ;;
  *) exit 0 ;;
esac

# bunを起動しないための事前フィルタ。
# &&・||・;・改行(JSON上は\nエスケープ)のいずれも含まなければ、連結の可能性が無いため即通過する。
case "$input" in
  *'&&'* | *'||'* | *';'* | *'\n'*) ;;
  *) exit 0 ;;
esac

# 自身のディレクトリを基準にmain.tsを解決する(引数順・cwd非依存)。
dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

# bun存在確認。無ければfail-open(警告して通し、導入はユーザーに委ねる)。
if ! command -v bun >/dev/null 2>&1; then
  echo "command-chain-guard: bun not found; cannot check for chained commands." >&2
  exit 1
fi

# 同梱した依存をロックファイルから同期する(再現的操作。git管理外のnode_modulesのみ変更)。
# 毎回frozen同期し、ファイル存在に基づく偽陰性を避ける。bun installは同期済みなら安価に確認のみ行う。
# 同期失敗時はfail-open(警告して通し、導入はユーザーに委ねる)。
if ! ( cd "$dir" && bun install --frozen-lockfile --production --ignore-scripts ) >/dev/null 2>&1; then
  echo "command-chain-guard: failed to sync the bundled deps from the lockfile; cannot check for chained commands." >&2
  exit 1
fi

# stdinを本体へ渡し、終了コードを伝播する。
printf '%s' "$input" | bun "$dir/src/main.ts"
exit $?
