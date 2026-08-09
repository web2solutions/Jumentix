#!/usr/bin/env bash
set -euo pipefail

docker rm -f jumentix-ci-redis jumentix-ci-rabbitmq >/dev/null 2>&1 || true
