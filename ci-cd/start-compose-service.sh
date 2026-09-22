#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${1:?usage: start-compose-service.sh <project-name|-> <compose-file>}"
COMPOSE_FILE="${2:?usage: start-compose-service.sh <project-name|-> <compose-file>}"
MAX_ATTEMPTS="${JUMENTIX_DOCKER_PULL_ATTEMPTS:-3}"
RETRY_DELAY_SECONDS="${JUMENTIX_DOCKER_PULL_RETRY_DELAY_SECONDS:-10}"

if ! [[ "$MAX_ATTEMPTS" =~ ^[1-9][0-9]*$ ]]; then
  echo "[compose] JUMENTIX_DOCKER_PULL_ATTEMPTS must be a positive integer" >&2
  exit 2
fi

COMPOSE_ARGS=(-f "$COMPOSE_FILE")
if [[ "$PROJECT_NAME" != '-' ]]; then
  COMPOSE_ARGS=(-p "$PROJECT_NAME" "${COMPOSE_ARGS[@]}")
fi

docker compose "${COMPOSE_ARGS[@]}" down --remove-orphans || true

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  if docker compose "${COMPOSE_ARGS[@]}" up -d --build --wait --force-recreate --remove-orphans; then
    exit 0
  fi

  if [[ "$attempt" -lt "$MAX_ATTEMPTS" ]]; then
    echo "[compose] startup attempt $attempt/$MAX_ATTEMPTS failed; retrying in ${RETRY_DELAY_SECONDS}s" >&2
    sleep "$RETRY_DELAY_SECONDS"
  fi
done

echo "[compose] startup failed after $MAX_ATTEMPTS attempt(s)" >&2
exit 1
