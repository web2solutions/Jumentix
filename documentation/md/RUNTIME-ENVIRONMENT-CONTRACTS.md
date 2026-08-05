# Runtime Environment Contracts

This document defines the runtime environment contract used to bootstrap API adapters and PM2 process profiles.

## Purpose

Guarantee deterministic startup behavior for:

- REST API adapters
- Realtime API adapters (WebSocket, gRPC)
- Service Management runtime profile editor

All runtime startup entrypoints must follow this contract.

## Runtime Keys

The following keys are mandatory across env files in `apps/backend-template/src/config/`:

- `JUMENTIX_HTTP_FRAMEWORK`
  - default: `express`
  - current supported values:
    - `express`
    - `fastify`
    - `restify`
    - `cloudflare-workers`
    - `vercel-functions`
    - `loopback`
    - `sails-js`
    - `feathers`
    - `derby-js`
    - `adonis-js`
    - `total-js`
  - used by: `apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts`

- `JUMENTIX_REALTIME_API`
  - default: `no`
  - supported values: `yes`, `no`
  - used by:
    - `apps/backend-template/src/interface/WebSocket/adapters/start-websocket-api.ts`
    - `apps/backend-template/src/interface/gRPC/adapters/start-grpc-api.ts`

- `JUMENTIX_REALTIME_API_PROTOCOL`
  - default: `websocket`
  - supported values: `websocket`, `grpc`
  - used by:
    - `apps/backend-template/src/interface/WebSocket/adapters/start-websocket-api.ts`
    - `apps/backend-template/src/interface/gRPC/adapters/start-grpc-api.ts`

- `JUMENTIX_REALTIME_API_DATABASE_DRIVER`
  - default: `Mongo`
  - supported values:
    - `Mongo`
    - `PostgreSQL`
    - `MySQL`
    - `MS SQL`
    - `RDS`
    - `Aurora`
    - `Cassandra`
  - used by: runtime profile metadata and Service Management configuration workflows.

- `JUMENTIX_DATABASE_DRIVER`
  - default: `InMemory`
  - supported values (canonical `DriverName` set; the backend also accepts common
    aliases case-insensitively, but the canonical spellings are the contract):
    - `InMemory`
    - `IndexedDB`
    - `Mongo`
    - `PostgreSQL`
    - `MySQL`
    - `MSSQL`
    - `Oracle`
    - `SQLite`
    - `DynamoDB`
    - `Cassandra`
    - `Firebase`
    - `Aurora`
    - `RDS`
  - used by: `packages/database-client-factory/src/compileDatabaseClient.ts`

- `JUMENTIX_KEYVALUESTORAGE_DRIVER`
  - default: `redis` (any value other than the in-memory spellings selects Redis)
  - supported values: `inmemory`, `redis`
  - used by: `packages/key-value-storage/src/compileKeyValueStorageClient.ts`

- `JUMENTIX_MESSAGE_MEDIATOR_ADAPTER`
  - default: `inmemory`
  - supported values: `inmemory`, `rabbitmq`, `bullmq`
  - used by: `packages/message-mediator/src/compileMessageMediator.ts`

- `JUMENTIX_WEBSOCKET_SOCKETIO_ADAPTER`
  - default: empty (in-memory Socket.IO adapter)
  - supported values: `cluster`, `redis-streams`
  - used by: `apps/backend-template/src/interface/WebSocket/adapters/socket-io/socket-io.ts`

- `JUMENTIX_WEBSOCKET_CLUSTER_WORKERS`
  - optional worker count for Socket.IO cluster mode.
  - default: CPU core count.
  - used by: `apps/backend-template/src/interface/WebSocket/adapters/start-websocket-api.ts`

- `JUMENTIX_WEBSOCKET_REDIS_URL`
  - optional dedicated Redis connection URL for Socket.IO scaling adapter.
  - example: `redis://127.0.0.1:6379/1`
  - used by: `apps/backend-template/src/interface/WebSocket/adapters/socket-io/redisStreamsAdapter.ts`

- `JUMENTIX_REDIS_URL`
  - optional global Redis URL fallback used by WebSocket scaling adapter when
    `JUMENTIX_WEBSOCKET_REDIS_URL` is not set.
  - used by: `apps/backend-template/src/interface/WebSocket/adapters/socket-io/redisStreamsAdapter.ts`

## Startup Entrypoints

- REST:
  - `apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts`
- WebSocket:
  - `apps/backend-template/src/interface/WebSocket/adapters/start-websocket-api.ts`
- gRPC:
  - `apps/backend-template/src/interface/gRPC/adapters/start-grpc-api.ts`

These files are the official process entrypoints used by PM2 ecosystem profiles.
Single-protocol helper scripts also route through these entrypoints (`dev:http`, `prod:http`, `dev:websocket`, `dev:grpc`).

## PM2 Process Model

For VM environments, each interface runs in its own PM2 process:

- `REST API` process
- `WebSocket API` process
- `gRPC API` process
- `Service Management` process

Runtime profiles:

- `REST API`
- `WebSocket API + REST API`
- `gRPC API + REST API`

## Service Management Runtime Env API

Service Management exposes runtime env read/write endpoints:

- `GET /api/runtime/env?environment=dev|development|staging|ci|test`
- `POST /api/runtime/env`

The env editor mutates only approved keys from this contract, preserving guardrails.

### Key tiers and allowlists

Read and write allowlists are separate sets; every key belongs to exactly one tier.
The authoritative per-key classification (with reasons) lives in
`.agents/requirements/software/126-service-management-ownership-and-public-contracts.md`.

- **Editable** (read + write) — runtime topology selectors:
  `JUMENTIX_HTTP_FRAMEWORK`, `JUMENTIX_REALTIME_API`,
  `JUMENTIX_REALTIME_API_PROTOCOL`, `JUMENTIX_REALTIME_API_DATABASE_DRIVER`,
  `JUMENTIX_DATABASE_DRIVER`, `JUMENTIX_KEYVALUESTORAGE_DRIVER`,
  `JUMENTIX_MESSAGE_MEDIATOR_ADAPTER`, `JUMENTIX_WEBSOCKET_SOCKETIO_ADAPTER`,
  `JUMENTIX_WEBSOCKET_REDIS_URL`.
- **Read-only** (read only) — connection endpoints and non-secret configuration:
  `JUMENTIX_DATABASE_NAME`, `JUMENTIX_ENABLE_BASIC_AUTH`, `JUMENTIX_JWT_ISSUER`,
  `JUMENTIX_JWT_AUDIENCE`, `JUMENTIX_REDIS_HOST`, `JUMENTIX_REDIS_PORT`,
  `JUMENTIX_REDIS_DATABASE`, `JUMENTIX_RABBITMQ_EXCHANGE`,
  `JUMENTIX_RABBITMQ_REQUEST_QUEUE`, `JUMENTIX_RABBITMQ_PREFETCH`,
  `JUMENTIX_CORS_ALLOWED_ORIGINS`, `JUMENTIX_AUTH_MAX_LOGIN_ATTEMPTS`,
  `JUMENTIX_AUTH_LOGIN_WINDOW_SECONDS`, `JUMENTIX_AUTH_LOCKOUT_SECONDS`.
- **Never exposed** (neither read nor write) — secrets and credential-bearing
  values: `JUMENTIX_JWT_TOKEN_SECRET_KEY`, `JUMENTIX_REDIS_PASSWORD`,
  `JUMENTIX_RABBITMQ_URL`.

GET returns `{ environment, fileName, editableKeys, values }` where `values`
covers the editable and read-only tiers and `editableKeys` names the write
allowlist. POST ignores any key outside `editableKeys`.

### Enum validation

Editable keys with an enum set only accept the canonical values listed in
[Runtime Keys](#runtime-keys); out-of-enum values are rejected with the accepted
list and nothing is written. `JUMENTIX_WEBSOCKET_SOCKETIO_ADAPTER` additionally
accepts empty (backend default). `JUMENTIX_WEBSOCKET_REDIS_URL` accepts empty or
a valid `redis://`/`rediss://` URL without embedded credentials — values carrying
userinfo are rejected so no secret can be stored through the endpoint.

### Accepted environments

- `dev` → `.env.dev`
- `development` → `.env.dev`
- `staging` → `.env.staging`
- `ci` → `.env.ci`
- `test` → `.env.ci`

Unknown environments return `400` with the accepted list; no file is written.

### Security posture

- Default bind is `127.0.0.1` (loopback only).
- Optional bearer token for mutations via `JUMENTIX_SERVICE_MANAGEMENT_AUTH_TOKEN`.
- Mutation audit log records timestamp, environment, and changed keys (not values).

### Error contract

- Unknown environment: `400` with accepted list.
- Missing environment file: `400` with resolved path.
- Invalid JSON payload: `400` distinguishing parse from filesystem failure.
- Out-of-enum or credential-bearing value for an editable key: `400` naming the
  key, the rejected value, and the accepted list; no file is written.
- Unauthorized mutation: `401` when auth token is configured.

## Guardrails

- Unsupported `JUMENTIX_HTTP_FRAMEWORK` must fail fast.
- REST bootstrap must always resolve framework via `start-rest-api` loader.
- Realtime boot must not start when:
  - `JUMENTIX_REALTIME_API` is not `yes`, or
  - `JUMENTIX_REALTIME_API_PROTOCOL` does not match the adapter entrypoint.
- Runtime env persistence must be explicit and environment-targeted (`dev`, `staging`, `ci`).

## Operational Examples

REST only:

```bash
JUMENTIX_HTTP_FRAMEWORK=express
JUMENTIX_REALTIME_API=no
```

WebSocket + REST:

```bash
JUMENTIX_HTTP_FRAMEWORK=express
JUMENTIX_REALTIME_API=yes
JUMENTIX_REALTIME_API_PROTOCOL=websocket
JUMENTIX_WEBSOCKET_SOCKETIO_ADAPTER=cluster
JUMENTIX_WEBSOCKET_CLUSTER_WORKERS=4
```

WebSocket + REST (multi-host via Redis Streams):

```bash
JUMENTIX_HTTP_FRAMEWORK=express
JUMENTIX_REALTIME_API=yes
JUMENTIX_REALTIME_API_PROTOCOL=websocket
JUMENTIX_WEBSOCKET_SOCKETIO_ADAPTER=redis-streams
JUMENTIX_WEBSOCKET_REDIS_URL=redis://127.0.0.1:6379/1
```

gRPC + REST:

```bash
JUMENTIX_HTTP_FRAMEWORK=express
JUMENTIX_REALTIME_API=yes
JUMENTIX_REALTIME_API_PROTOCOL=grpc
```
