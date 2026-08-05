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
  - alias decision (JUM-461): `derby-js` and `sails-js` are the canonical spellings.
    The aliases `derby` and `sails` are NOT accepted — `RuntimeEnvironment.ts`
    fails fast on them. `hyper-express` was dropped from the runtime (JUM-27) and
    is likewise rejected. The Service Management selector offers exactly the
    11 canonical values above; UI options and server-side enum validation must
    always agree.
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

- `JUMENTIX_DATABASE_DRIVER`
  - default: `InMemory`
  - supported values (the `DriverName` union in
    `packages/database-client-factory/src/compileDatabaseClient.ts`):
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
  - the MAIN application database driver (REST API persistence). Distinct from
    `JUMENTIX_REALTIME_API_DATABASE_DRIVER`: changing one never affects the other.
    `IndexedDB` is the browser (Cana) driver and throws if selected for a
    server-side process without a wired `indexedDbClient` factory.
  - used by: `packages/database-client-factory` (`compileDatabaseClient`), wired in
    `apps/backend-template/src/infra/persistence/compileDatabaseClient.ts`

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
  - the REALTIME API (WebSocket/gRPC) database driver only — it does not change the
    main application database (`JUMENTIX_DATABASE_DRIVER`).
  - used by: runtime profile metadata and Service Management configuration workflows.

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
