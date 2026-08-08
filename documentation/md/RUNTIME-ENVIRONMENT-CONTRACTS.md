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

### PM2 ecosystem preview API (JUM-480)

Service Management also exposes a read-only PM2 ecosystem endpoint, the single
source of the designer's runtime profile preview:

- `GET /api/runtime/pm2-ecosystem?environment=dev|development|staging|production|prod|ci|test`

The endpoint reads the real `pm2/ecosystem.*.cjs` file of the selected
environment (directory overridable via `JUMENTIX_SERVICE_MANAGEMENT_PM2_DIR`,
default `<repo-root>/pm2`) and returns `{ environment, fileName, path, exists,
apps }`, where each app carries `{ name, script, interpreter, interpreterArgs,
env, command }`. `command` is derived from the ecosystem definition —
`pm2 start <ecosystem path> --only <app name> --update-env` — never an embedded
package-manager string, so the Bun cutover (JUM-33/JUM-40) cannot silently
invalidate the preview. The ecosystem module is loaded cache-busted: editing an
ecosystem file changes the response with no server restart and no code change.

Failure and edge states follow the same honesty discipline as the env-file API:

- Unknown environment: `400 { "error": "Invalid environment request.", … }`
  naming the value and the accepted list — never coerced to `dev`.
- Missing ecosystem file (e.g. `ci`, which has none): `200` with
  `exists: false` and an empty `apps` list — an explicit state the UI renders
  as "no ecosystem for this environment", not a silently empty preview.
- Unreadable or syntactically broken ecosystem file:
  `500 { "error": "PM2 ecosystem file operation failed.", "code", "path",
  "details" }`.

### Env file location

Runtime env files live in `apps/backend-template/src/config/` (`.env.dev`,
`.env.staging`, `.env.ci`). The server resolves the config directory as
`JUMENTIX_SERVICE_MANAGEMENT_CONFIG_DIR` (absolute-resolved) when set,
otherwise `<repo-root>/apps/backend-template/src/config`, and fails closed at
boot — stderr message naming the missing directory, exit code `1` — when the
directory does not exist.

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

The landed per-key classification into these tiers — one reason per key — lives in
[Requirement 126](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md),
and the tier lists above mirror it. Every addition to the editable set is a security decision.

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

Responses distinguish parse, validation, and filesystem failures (landed by
JUM-543; Requirement 126 §3):

- Malformed JSON body (POST): `400 { "error": "Invalid payload.", "details": … }`.
  The parse `try` is narrowed to `JSON.parse` only, so this envelope can never
  report a filesystem failure.
- Unsupported environment: `400 { "error": "Invalid environment request.",
  "details": … }` whose `details` name the unsupported value and the accepted
  list — on GET and POST alike; no file is written.
- Filesystem failures — missing env file (error code `ENV_FILE_NOT_FOUND`),
  permission errors, full disk: `500 { "error": "Environment file operation
  failed.", "code": …, "path": …, "details": … }`, where `code` is
  `ENV_FILE_NOT_FOUND` or the underlying `fs` error code and `path` is the
  resolved env-file path. A broken installation is a distinct, identifiable
  failure class — never `400 Invalid payload.`.
- Out-of-enum or credential-bearing value for an editable key: `400` naming the
  key, the rejected value, and the accepted list; no file is written.
- Missing or wrong bearer token: `401 { "error": "Unauthorized." }` when the
  auth token is configured.

The UI surfaces these failures through non-blocking `aria-live` status
surfaces (a global toast region plus an inline status line in the runtime env
panel), not `window.alert`; the client renders exactly what the API returns —
`error`, `details`, and on the 500 class `code` and `path` — with no
client-side remapping.

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
