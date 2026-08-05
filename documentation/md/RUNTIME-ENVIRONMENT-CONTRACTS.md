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

### Env file location

Runtime env files live in `apps/backend-template/src/config/` (`.env.dev`,
`.env.staging`, `.env.ci`). The server resolves the config directory as
`JUMENTIX_SERVICE_MANAGEMENT_CONFIG_DIR` (absolute-resolved) when set,
otherwise `<repo-root>/apps/backend-template/src/config`, and fails closed at
boot — stderr message naming the missing directory, exit code `1` — when the
directory does not exist.

### Accepted environments

- `dev` → `.env.dev`
- `development` → `.env.dev` (alias)
- `staging` → `.env.staging`
- `ci` → `.env.ci`
- `test` → `.env.ci` (alias)

Comparison is case-insensitive after trimming. Unknown environments are
explicitly rejected — `400` with the accepted list, no file written, never
silently coerced to `dev`. When omitted, the environment defaults to
`NODE_ENV` or `dev`.

### Key classification

Every env key belongs to exactly one of three tiers, each with a stated reason:

- **Editable** — runtime topology selectors (frameworks, drivers, adapters,
  protocol toggles); readable via GET and writable via POST.
- **Read-only** — connection endpoints and non-secret configuration; visible
  in GET so the designer reflects reality, never writable through POST.
- **Never exposed** — secrets and credential-bearing values; must not appear
  in the GET response and must not be writable, since the response crosses the
  same trust boundary as the write.

The current editable set is the four topology selectors listed under
[Runtime Keys](#runtime-keys) (`JUMENTIX_HTTP_FRAMEWORK`,
`JUMENTIX_REALTIME_API`, `JUMENTIX_REALTIME_API_PROTOCOL`,
`JUMENTIX_REALTIME_API_DATABASE_DRIVER`), and the read surface is bounded to
the same four. The full per-key classification of the env files into these
tiers lands via JUM-460; the authoritative classification decisions — one per
key, each with a written reason — live in
[Requirement 126](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md).
Every addition to the editable set is a security decision.

### Enum sets and alias decision

Values outside the accepted enum for each key (listed under
[Runtime Keys](#runtime-keys)) are rejected with the accepted list.

Alias decision (JUM-461): `derby`/`derby-js` and `sails`/`sails-js` are the
same framework under two spellings. The canonical spellings are `derby-js` and
`sails-js` — the forms accepted by
`apps/backend-template/src/interface/runtime/RuntimeEnvironment.ts` — and the
UI selector offers exactly the values the server accepts: a value the UI
offers must be a value the server accepts, and vice versa. Separately,
`JUMENTIX_DATABASE_DRIVER` and `JUMENTIX_REALTIME_API_DATABASE_DRIVER` are
distinct keys and must be separately labelled and separately editable in the
UI.

### Security posture

- Default bind is `127.0.0.1` (loopback only); binding a non-loopback
  interface is an explicit opt-in via `JUMENTIX_SERVICE_MANAGEMENT_HOST`.
- Port defaults to `3200`, overridable via `JUMENTIX_SERVICE_MANAGEMENT_PORT`.
- When `JUMENTIX_SERVICE_MANAGEMENT_AUTH_TOKEN` is set, `POST
  /api/runtime/env` requires `Authorization: Bearer <token>` and rejects
  anything else with `401 { "error": "Unauthorized." }`; when unset,
  loopback-only operation is allowed without a token.
- Mutation audit log records timestamp, environment, and changed keys (not values).

### Error contract

Responses distinguish parse, validation, and filesystem failures through the
`details` field of the error envelope:

- Malformed JSON body (POST): `400 { "error": "Invalid payload.", "details": … }`.
- Unsupported environment: `400` whose `details` name the unsupported value
  and the accepted list — `{ "error": "Invalid environment request.", … }` on
  GET, `{ "error": "Invalid payload.", … }` on POST; no file is written.
- Missing env file: `400` whose `details` carry the resolved path (internally
  error code `ENV_FILE_NOT_FOUND`), so a broken installation is identifiable
  from the message rather than mistaken for a malformed request.
- Missing or wrong bearer token: `401 { "error": "Unauthorized." }` when the
  auth token is configured.

Requirement 126 (JUM-543) specifies the target split in which filesystem
failures surface as a distinct, identifiable failure class rather than sharing
the payload-validation envelope; the UI surfaces these failures through
non-blocking status surfaces, not `window.alert`.

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
