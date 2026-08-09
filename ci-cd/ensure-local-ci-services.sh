#!/usr/bin/env bash
set -euo pipefail

redis_container="jumentix-ci-redis"
rabbitmq_container="jumentix-ci-rabbitmq"

port_open() {
  nc -z 127.0.0.1 "$1" >/dev/null 2>&1
}

if ! port_open 6379; then
  docker rm -f "$redis_container" >/dev/null 2>&1 || true
  docker run -d --name "$redis_container" -p 6379:6379 redis:7.2-alpine
else
  echo "Redis already listens on 127.0.0.1:6379; reusing it."
fi

if ! port_open 5672; then
  docker rm -f "$rabbitmq_container" >/dev/null 2>&1 || true
  docker run -d --name "$rabbitmq_container" -p 5672:5672 rabbitmq:3.13-alpine
else
  echo "RabbitMQ already listens on 127.0.0.1:5672; reusing it."
fi

for attempt in $(seq 1 30); do
  if port_open 6379 && port_open 5672; then
    exit 0
  fi
  sleep 2
done

docker logs "$redis_container" || true
docker logs "$rabbitmq_container" || true
exit 1
