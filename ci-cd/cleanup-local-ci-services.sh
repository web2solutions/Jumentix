#!/usr/bin/env bash
set -euo pipefail

if ! docker info >/dev/null 2>&1; then
  exit 0
fi

docker rm -f jumentix-ci-redis jumentix-ci-rabbitmq >/dev/null 2>&1 || true
