#!/usr/bin/env sh
set -eu

destination="${1:?destination directory is required}"
mkdir -p "$destination"

download_and_verify() {
  url="$1"
  checksum="$2"
  archive="$3"
  curl --fail --silent --show-error --location "$url" --output "$archive"
  printf '%s  %s\n' "$checksum" "$archive" | sha256sum --check --status
}

gitleaks_archive="$destination/gitleaks.tar.gz"
download_and_verify \
  'https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz' \
  '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb' \
  "$gitleaks_archive"
tar -xzf "$gitleaks_archive" -C "$destination" gitleaks

reviewdog_archive="$destination/reviewdog.tar.gz"
download_and_verify \
  'https://github.com/reviewdog/reviewdog/releases/download/v0.21.0/reviewdog_0.21.0_Linux_x86_64.tar.gz' \
  'ad5ce7d5ffa52aaa7ec8710a8fa764181b6cecaab843cc791e1cce1680381569' \
  "$reviewdog_archive"
tar -xzf "$reviewdog_archive" -C "$destination" reviewdog

"$destination/gitleaks" version
"$destination/reviewdog" -version
