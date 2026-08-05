#!/usr/bin/env sh
set -eu

destination="${1:?destination directory is required}"
mkdir -p "$destination"

download_and_verify() {
  url="$1"
  checksum="$2"
  archive="$3"
  curl --fail --silent --show-error --location "$url" --output "$archive"
  if command -v sha256sum >/dev/null 2>&1; then
    actual_checksum="$(sha256sum "$archive" | awk '{print $1}')"
  else
    actual_checksum="$(shasum -a 256 "$archive" | awk '{print $1}')"
  fi
  if [ "$actual_checksum" != "$checksum" ]; then
    echo "checksum mismatch for $archive" >&2
    exit 1
  fi
}

gitleaks_archive="$destination/gitleaks.tar.gz"
download_and_verify \
  'https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz' \
  '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb' \
  "$gitleaks_archive"
tar -xzf "$gitleaks_archive" -C "$destination" gitleaks

python3 -m venv "$destination/semgrep-venv"
"$destination/semgrep-venv/bin/python" -m pip install --no-cache-dir --upgrade pip
"$destination/semgrep-venv/bin/python" -m pip install --no-cache-dir semgrep==1.172.0
ln -sf "$destination/semgrep-venv/bin/semgrep" "$destination/semgrep"

if [ "$(uname -s)" = "Linux" ]; then
  "$destination/gitleaks" version
else
  echo "Skipping Linux Gitleaks binary smoke on $(uname -s)."
fi
"$destination/semgrep" --version
