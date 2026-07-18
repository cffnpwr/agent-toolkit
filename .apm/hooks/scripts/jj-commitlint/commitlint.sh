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

# bun.lockからpackage.jsonを起こしてcommitlint依存を同期する。
# apmは配置時にpackage.jsonを除外するため、配置先ではbun.lockが唯一の新鮮な依存ソースになる。
# node_modulesがbun.lock(cksum)と一致していれば同期をスキップし、読み取りのみで通す。
# 同期が要るときだけmkdirによるmutexで直列化し、並行起動時の多重installの競合を防ぐ。
# 失敗時は警告して通し、導入はユーザーに委ねる。
lock_sum=$(cksum <"$dir/bun.lock")
stamp="$dir/node_modules/.synced"
if [ ! -d "$dir/node_modules" ] || [ "$(cat "$stamp" 2>/dev/null)" != "$lock_sum" ]; then
  # mkdirは既存ディレクトリには必ず失敗し、同時実行でも成功するのは1プロセスだけなのでmutexに使う。
  # 約60s待って取れなければlintへ委ねる。
  lockdir="$dir/.sync.lock"
  acquired=0
  i=0
  while [ "$i" -lt 600 ]; do
    if mkdir "$lockdir" 2>/dev/null; then acquired=1; break; fi
    i=$((i + 1))
    sleep 0.1
  done
  if [ "$acquired" -eq 1 ]; then
    trap 'rmdir "$lockdir" 2>/dev/null' EXIT
    # ロック待ちの間に別プロセスが同期済みなら再確認でスキップする。
    if [ ! -d "$dir/node_modules" ] || [ "$(cat "$stamp" 2>/dev/null)" != "$lock_sum" ]; then
      if ( cd "$dir" && bun "$dir/../shared/src/gen-package-json.ts" "$dir" && bun install --frozen-lockfile --production --ignore-scripts ) >/dev/null 2>&1; then
        printf '%s' "$lock_sum" >"$stamp"
      else
        rmdir "$lockdir" 2>/dev/null
        trap - EXIT
        echo "jj-commitlint: failed to sync the bundled commitlint deps from the lockfile. The commit message may violate user-defined rules." >&2
        exit 1
      fi
    fi
    rmdir "$lockdir" 2>/dev/null
    trap - EXIT
  fi
fi

# stdinを本体へ渡し、終了コードを伝播する。
printf '%s' "$input" | bun "$dir/src/main.ts"
exit $?
