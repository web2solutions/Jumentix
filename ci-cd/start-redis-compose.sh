#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="apps/backend-template/docker-compose-redis.yml"
MAX_ATTEMPTS="${JUMENTIX_DOCKER_PULL_ATTEMPTS:-3}"
RETRY_DELAY_SECONDS="${JUMENTIX_DOCKER_PULL_RETRY_DELAY_SECONDS:-10}"

if ! [[ "$MAX_ATTEMPTS" =~ ^[1-9][0-9]*$ ]]; then
  echo "[redis-compose] JUMENTIX_DOCKER_PULL_ATTEMPTS must be a positive integer" >&2
  exit 2
fi

ci-cd/cleanup-local-ci-services.sh
docker compose -f "$COMPOSE_FILE" down --remove-orphans || true

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  if docker compose -f "$COMPOSE_FILE" up -d --build --wait --force-recreate --remove-orphans; then
    exit 0
  fi

  if [[ "$attempt" -lt "$MAX_ATTEMPTS" ]]; then
    echo "[redis-compose] startup attempt $attempt/$MAX_ATTEMPTS failed; retrying in ${RETRY_DELAY_SECONDS}s" >&2
    sleep "$RETRY_DELAY_SECONDS"
  fi
done

echo "[redis-compose] startup failed after $MAX_ATTEMPTS attempt(s)" >&2
exit 1
