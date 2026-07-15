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

# bun.lockからpackage.jsonを起こしてからcommitlint依存を同期する(再現的操作。git管理外のnode_modulesとpackage.jsonのみ変更)。
# apmは配置時にpackage.jsonを除外するため、配置先ではbun.lockが唯一の新鮮な依存ソースになる。lockから生成すればfrozen同期が必ず整合する。
# 毎回frozen同期し、ファイル存在に基づく偽陰性を避ける。bun installは同期済みなら安価に確認のみ行う。
# 失敗時はfail-open(警告して通し、導入はユーザーに委ねる)。
if ! ( cd "$dir" && bun "$dir/../shared/src/gen-package-json.ts" "$dir" && bun install --frozen-lockfile --production --ignore-scripts ) >/dev/null 2>&1; then
  echo "jj-commitlint: failed to sync the bundled commitlint deps from the lockfile. The commit message may violate user-defined rules." >&2
  exit 1
fi

# stdinを本体へ渡し、終了コードを伝播する。
printf '%s' "$input" | bun "$dir/src/main.ts"
exit $?
