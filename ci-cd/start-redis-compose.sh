#!/usr/bin/env bash
set -euo pipefail

ci-cd/cleanup-local-ci-services.sh
exec ci-cd/start-compose-service.sh - apps/backend-template/docker-compose-redis.yml
