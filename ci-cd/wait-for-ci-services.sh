#!/usr/bin/env bash
set -euo pipefail

host="${JUMENTIX_CI_SERVICE_HOST:-127.0.0.1}"

port_open() {
  nc -z "$host" "$1" >/dev/null 2>&1
}

for attempt in $(seq 1 30); do
  if port_open 6379 && port_open 5672; then
    exit 0
  fi
  sleep 2
done

echo "Timed out waiting for Redis and RabbitMQ on ${host}." >&2
exit 1
