#!/bin/sh
# prefer-jj hookの起動スクリプト。
# PreToolUse入力をstdinで受け、jjリポジトリでのgit操作だけを本体main.tsに渡す。
# 対象サブコマンドの判定は本体に委ね、非git操作・非jjリポジトリはbun起動前に除外する。
# bunが無いときはfail-openの警告を出して通す。
set -u

# PreToolUseのJSON入力を取得する。
input=$(cat)

# セッション全体の無効化。環境変数PREFER_JJ_DISABLEが真値なら通過する。
# 偽値(未設定・空・0・false・no・off。大文字小文字無視)は無効化しない(git-configのbooleanの偽値に合わせる)。
case "${PREFER_JJ_DISABLE:-}" in
  "" | 0 | [Ff][Aa][Ll][Ss][Ee] | [Nn][Oo] | [Oo][Ff][Ff]) ;;
  *) exit 0 ;;
esac

# bunを起動しないための事前フィルタ。
# gitを含まなければ即通過し、対象判定は本体main.tsに任せる。
case "$input" in
  *git*) ;;
  *) exit 0 ;;
esac

# jjリポジトリ判定。非jjリポジトリ・jj不在ではjjへ促す意味が無いため通過する。
if ! jj root --ignore-working-copy >/dev/null 2>&1; then
  exit 0
fi

# 自身のディレクトリを基準にmain.tsを解決する(引数順・cwd非依存)。
dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

# bun存在確認。無ければfail-open(警告して通し、導入はユーザーに委ねる)。
if ! command -v bun >/dev/null 2>&1; then
  echo "prefer-jj: bun not found; cannot check for git commands that have a jj equivalent." >&2
  exit 1
fi

# bun.lockからpackage.jsonを起こしてから依存を同期する(再現的操作。git管理外のnode_modulesとpackage.jsonのみ変更)。
# apmは配置時にpackage.jsonを除外するため、配置先ではbun.lockが唯一の新鮮な依存ソースになる。lockから生成すればfrozen同期が必ず整合する。
# 毎回frozen同期し、ファイル存在に基づく偽陰性を避ける。bun installは同期済みなら安価に確認のみ行う。
# 失敗時はfail-open(警告して通し、導入はユーザーに委ねる)。
if ! ( cd "$dir" && bun "$dir/../shared/gen-package-json.ts" "$dir" && bun install --frozen-lockfile --production --ignore-scripts ) >/dev/null 2>&1; then
  echo "prefer-jj: failed to sync the bundled deps from the lockfile; cannot check for git commands that have a jj equivalent." >&2
  exit 1
fi

# stdinを本体へ渡し、終了コードを伝播する。
printf '%s' "$input" | bun "$dir/src/main.ts"
exit $?
