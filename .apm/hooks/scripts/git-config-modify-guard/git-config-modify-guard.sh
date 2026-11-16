#!/bin/sh
set -u

input=$(cat)

# 判定の対象になり得ない入力（gitを含まない入力・config・-c・GIT_CONFIG_のいずれも含まない入力）はbunを起動せずに通過させる
case "$input" in
  *git*) ;;
  *) exit 0 ;;
esac
case "$input" in
  *config*|*-c*|*GIT_CONFIG_*) ;;
  *) exit 0 ;;
esac

dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if ! command -v bun >/dev/null 2>&1; then
  echo "git-config-modify-guard: bun not found; cannot check for git config changes." >&2
  exit 1
fi

# apmは配置時にpackage.jsonを除外するため、bun.lockからpackage.jsonを生成して依存を同期する
lock_sum=$(cksum <"$dir/bun.lock")
stamp="$dir/node_modules/.synced"
# node_modulesがbun.lockと一致していれば同期を省略する
if [ ! -d "$dir/node_modules" ] || [ "$(cat "$stamp" 2>/dev/null)" != "$lock_sum" ]; then
  # mkdirは既存ディレクトリに対して必ず失敗するため、約60秒を上限に並行起動時の排他制御に使う
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
    # ロックを待つ間に別のプロセスが同期した場合は省略する
    if [ ! -d "$dir/node_modules" ] || [ "$(cat "$stamp" 2>/dev/null)" != "$lock_sum" ]; then
      if ( cd "$dir" && bun "$dir/../shared/src/gen-package-json.ts" "$dir" && bun install --frozen-lockfile --production --ignore-scripts ) >/dev/null 2>&1; then
        printf '%s' "$lock_sum" >"$stamp"
      else
        rmdir "$lockdir" 2>/dev/null
        trap - EXIT
        echo "git-config-modify-guard: failed to sync the bundled deps from the lockfile; cannot check for git config changes." >&2
        exit 1
      fi
    fi
    rmdir "$lockdir" 2>/dev/null
    trap - EXIT
  fi
fi

printf '%s' "$input" | bun "$dir/src/main.ts"
exit $?
