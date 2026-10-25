#!/bin/sh
set -u

input=$(cat)

case "${CHECK_RESPONSE_DISABLE:-}" in
  "" | 0 | [Ff][Aa][Ll][Ss][Ee] | [Nn][Oo] | [Oo][Ff][Ff]) ;;
  *) exit 0 ;;
esac

dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if ! command -v bun >/dev/null 2>&1; then
  echo "check-response: bun not found; cannot check the Japanese text." >&2
  exit 1
fi

if ! ( cd "$dir" && bun "$dir/../shared/src/gen-package-json.ts" "$dir" && bun install --frozen-lockfile --production --ignore-scripts ) >/dev/null 2>&1; then
  echo "check-response: failed to sync the bundled deps from the lockfile; cannot check the Japanese text." >&2
  exit 1
fi

printf '%s' "$input" | bun "$dir/src/main.ts"
exit $?
