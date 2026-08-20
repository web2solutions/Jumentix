#!/usr/bin/env bash
set -euo pipefail

required_version="${BUN_VERSION:?BUN_VERSION must be set}"
bun_bin="$HOME/.bun/bin/bun"
lock_dir="$HOME/.bun-install-${required_version}.lock"

has_required_bun() {
  [ -x "$bun_bin" ] && [ "$("$bun_bin" --version)" = "$required_version" ]
}

if has_required_bun; then
  exit 0
fi

while ! mkdir "$lock_dir" 2>/dev/null; do
  sleep 1
  if has_required_bun; then
    exit 0
  fi
done

cleanup() {
  rmdir "$lock_dir" 2>/dev/null || true
}
trap cleanup EXIT

if ! has_required_bun; then
  curl -fsSL https://bun.sh/install | bash -s "bun-v$required_version"
fi
