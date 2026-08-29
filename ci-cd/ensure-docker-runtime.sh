#!/usr/bin/env bash
set -euo pipefail

docker_ready() {
  docker info >/dev/null 2>&1
}

if docker_ready; then
  exit 0
fi

if [ "$(uname -s)" = "Darwin" ]; then
  echo "Docker daemon is not ready; asking Docker Desktop to start."
  open -ga Docker >/dev/null 2>&1 || true
fi

for attempt in $(seq 1 90); do
  if docker_ready; then
    echo "Docker daemon is ready after ${attempt} attempt(s)."
    exit 0
  fi
  sleep 2
done

echo "Docker daemon did not become ready." >&2
docker context ls >&2 || true
docker info >&2 || true
exit 1
