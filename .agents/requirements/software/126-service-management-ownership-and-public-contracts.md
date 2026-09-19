# Requirement 126 - Service Management Ownership and Public Contracts

- Status: Active
- Nature: NFR (governance, component contract specification, drift detection)
- Source: Linear `JUM-465`, epic "Service Management ownership, modernization and Cana
  adoption", milestone H1 (Correctness & runtime alignment), 2026-08-05.
- Strengthens: `038`, `043`. Relates to: `044`, `052`, `123` and Linear `JUM-458`,
  `JUM-558`, `JUM-459`, `JUM-460`, `JUM-461`, `JUM-462`, `JUM-543`, `JUM-466`,
  `JUM-468`, `JUM-475`, `JUM-484`, `JUM-547`, `JUM-492`, `JUM-748`.

## Context

The Wave 5 re-homing moved `apps/backend-template` and silently broke the
`apps/service-management/server.js` env-file path: nothing pinned where the env files
live, no owner watched the component, and no smoke asserted the path resolves. The
defect served default values as though they were real configuration. This requirement
registers a formal owner for the component and pins its three public contracts —
the `/api/runtime/env` API, the `service-management.v1` storage schema, and the
export formats — precisely enough that a violation is detectable by a test rather
than by reading. The H1 child issues implement the behavior; this requirement is the
contract they converge on, and the smoke expansion in `JUM-466` asserts it.

## Requirement

1. **Ownership registration.**
   - `apps/service-management` MUST have a registered owner in the component ownership
     registry `.agents/COMPONENT-OWNERSHIP.md` (established by this requirement).
     The registered owner is agent `kimi-code-primary-001`.
   - `apps/service-management-api` owns platform Service Management APIs that support
     the designer itself, including the shared `Catalogs` runtime. Generated-service
     template code in `apps/backend-template` MUST NOT ship the Service Management
     `Catalogs` module, `/catalogs` OAS paths, catalog stores, or catalog sync runtime
     by default.
   - Any change to a public contract pinned here MUST update this requirement (and the
     registry sync set listed in Evidence) in the same PR.

2. **Env-file location (pinned path).**
   - The runtime env files live in `apps/backend-template/src/config/`:
     `.env.dev`, `.env.staging`, `.env.ci`.
   - `server.js` MUST resolve the config directory as
     `JUMENTIX_SERVICE_MANAGEMENT_CONFIG_DIR` (absolute-resolved) when set, otherwise
     `<repo-root>/apps/backend-template/src/config`, and MUST fail closed at boot
     (stderr message naming the missing directory, exit code `1`) when the directory
     does not exist. Silently serving defaults for a missing directory is a contract
     violation.

3. **Contract 1 — `GET`/`POST /api/runtime/env`.**
   - **Environments and file mapping.** Accepted `environment` values and their file
     mapping: `dev` → `.env.dev`, `development` → `.env.dev`, `staging` →
     `.env.staging`, `ci` → `.env.ci`, `test` → `.env.ci`. Comparison is
     case-insensitive after trimming. An unknown environment MUST be explicitly
     rejected — never silently coerced to `dev`. When omitted, the environment
     defaults to `NODE_ENV` or `dev`.
   - **Read vs write allowlist and classification rule (landed by `JUM-460`).** The
     read allowlist and the write allowlist are separate sets. Every env key belongs
     to exactly one of three tiers, each with a stated reason:
     - *Editable* — runtime topology selectors (frameworks, drivers, adapters,
       protocol toggles); readable and writable.
     - *Read-only* — connection endpoints and non-secret configuration; visible in
       GET so the designer reflects reality, never writable through POST.
     - *Never exposed* — secrets and credential-bearing values
       (`JUMENTIX_JWT_TOKEN_SECRET_KEY`, `JUMENTIX_REDIS_PASSWORD`,
       `JUMENTIX_RABBITMQ_URL`); MUST NOT appear in the GET response and MUST NOT be
       writable, since the response crosses the same boundary as the write. The tier
       is enforced by omission from both allowlists and proven by test.
     The full 24-key classification of `.env.dev` (each addition to the editable set
     is a security decision with a written reason):
     - *Editable (write allowlist, 9 keys):*
       - `JUMENTIX_HTTP_FRAMEWORK` — REST framework selector; the designer's primary
         topology control.
       - `JUMENTIX_REALTIME_API` — realtime on/off toggle; selects whether a
         realtime interface boots at all.
       - `JUMENTIX_REALTIME_API_PROTOCOL` — realtime protocol selector
         (`websocket`/`grpc`).
       - `JUMENTIX_REALTIME_API_DATABASE_DRIVER` — persistence driver selector for
         the realtime profile.
       - `JUMENTIX_DATABASE_DRIVER` — primary persistence driver selector
         (`packages/database-client-factory/src/compileDatabaseClient.ts`); topology,
         named by `JUM-460`. `JUM-461` made it separately editable after the UI
         labelled the realtime-API driver as if it were the main database driver —
         both driver keys must be separately editable, and the key selects runtime
         topology (a driver, not a secret), which is the editable tier's own rule.
       - `JUMENTIX_KEYVALUESTORAGE_DRIVER` — key-value storage driver selector
         (`packages/key-value-storage/src/compileKeyValueStorageClient.ts`); named by
         `JUM-460`. Absent from `.env.dev` — writing it appends the key to the file.
       - `JUMENTIX_MESSAGE_MEDIATOR_ADAPTER` — message mediator adapter selector
         (`packages/message-mediator/src/compileMessageMediator.ts`); named by
         `JUM-460`.
       - `JUMENTIX_WEBSOCKET_SOCKETIO_ADAPTER` — Socket.IO scaling adapter selector;
         named by `JUM-460`. Commented out in `.env.dev` — writing it uncomments the
         line in place.
       - `JUMENTIX_WEBSOCKET_REDIS_URL` — dedicated Redis endpoint for the
         `redis-streams` adapter; named editable by `JUM-460`. Carries no credentials
         in the template env files, and the endpoint rejects values with embedded
         credentials (userinfo) or non-`redis://`/`rediss://` protocols, so the tool
         cannot be used to store secrets through this key.
     - *Read-only (read allowlist only, 15 keys):*
       - `JUMENTIX_DATABASE_NAME` — logical database name; non-secret config, not a
         topology selector.
       - `JUMENTIX_ENABLE_BASIC_AUTH` — authentication posture toggle;
         security-relevant (Requirement `044`), must not be flipped from a design
         tool.
       - `JUMENTIX_JWT_ISSUER`, `JUMENTIX_JWT_AUDIENCE` — token metadata; non-secret
         config.
       - `JUMENTIX_REDIS_HOST`, `JUMENTIX_REDIS_PORT`, `JUMENTIX_REDIS_DATABASE` —
         connection endpoint parameters; visible so the designer reflects reality.
       - `JUMENTIX_RABBITMQ_EXCHANGE`, `JUMENTIX_RABBITMQ_REQUEST_QUEUE`,
         `JUMENTIX_RABBITMQ_PREFETCH` — broker topology config; non-secret.
       - `JUMENTIX_CORS_ALLOWED_ORIGINS` — security-relevant browser policy config.
       - `JUMENTIX_AUTH_MAX_LOGIN_ATTEMPTS`, `JUMENTIX_AUTH_LOGIN_WINDOW_SECONDS`,
         `JUMENTIX_AUTH_LOCKOUT_SECONDS` — brute-force protection policy
         (Requirement `044`); security-relevant.
       - `JUMENTIX_SERVICE_MANAGEMENT_CATALOG_API_URL` — explicit endpoint for the
         platform-owned Service Management catalog API. The designer reads it to
         avoid same-origin fallback to generated-service template routes; it is
         non-secret and never writable through the browser.
     - *Never exposed (3 keys):* `JUMENTIX_JWT_TOKEN_SECRET_KEY` (signing key),
       `JUMENTIX_REDIS_PASSWORD` (credential), `JUMENTIX_RABBITMQ_URL`
       (credential-bearing URL embedding `user:password`).
   - **Enum sets per key (landed by `JUM-460`).** Values outside the accepted enum
     MUST be rejected with the accepted list, and nothing is written:
     - `JUMENTIX_HTTP_FRAMEWORK`: `express`, `fastify`, `restify`,
       `cloudflare-workers`, `vercel-functions`, `loopback`, `sails-js`, `feathers`,
       `derby-js`, `adonis-js`, `total-js` (the set accepted by
       `apps/backend-template/src/interface/runtime/RuntimeEnvironment.ts` and
       `documentation/md/RUNTIME-ENVIRONMENT-CONTRACTS.md`).
     - `JUMENTIX_REALTIME_API`: `yes`, `no`.
     - `JUMENTIX_REALTIME_API_PROTOCOL`: `websocket`, `grpc`.
     - `JUMENTIX_DATABASE_DRIVER`: `InMemory`, `IndexedDB`, `Mongo`, `PostgreSQL`,
       `MySQL`, `MSSQL`, `Oracle`, `SQLite`, `DynamoDB`, `Cassandra`, `Firebase`,
       `Aurora`, `RDS` (the `DriverName` union in
       `packages/database-client-factory/src/compileDatabaseClient.ts`; added by
       `JUM-461` together with the key's editability).
     - `JUMENTIX_REALTIME_API_DATABASE_DRIVER`: `Mongo`, `PostgreSQL`, `MySQL`,
       `MS SQL`, `RDS`, `Aurora`, `Cassandra`.
   - **Alias decision (per `JUM-461`, decided).** `derby`/`derby-js` and
     `sails`/`sails-js` are the same framework under two spellings. The canonical
     spellings are `derby-js` and `sails-js` — the adapter directories
     (`apps/backend-template/src/interface/HTTP/adapters/derby-js`,
     `.../sails-js`), the `EHTTPFrameworks` enum, and the `start-rest-api` loader
     all key on the `-js` forms, and `hyper-express` was dropped from the runtime
     (JUM-27), so the 11-value enum above is the complete accepted set. The
     selector offers exactly those 11 canonical values; the aliases `derby` and
     `sails` are NOT accepted and fail fast in
     `apps/backend-template/src/interface/runtime/RuntimeEnvironment.ts`. The
     server's enum validation (`JUM-460`) MUST agree with the selector exactly — a
     value the UI offers MUST be a value the server accepts, and vice versa. This
     decision is also recorded in
     `documentation/md/RUNTIME-ENVIRONMENT-CONTRACTS.md`.

     - `JUMENTIX_DATABASE_DRIVER`: `InMemory`, `IndexedDB`, `Mongo`, `PostgreSQL`,
       `MySQL`, `MSSQL`, `Oracle`, `SQLite`, `DynamoDB`, `Cassandra`, `Firebase`,
       `Aurora`, `RDS` (the canonical `DriverName` set of
       `packages/database-client-factory/src/compileDatabaseClient.ts`).
     - `JUMENTIX_KEYVALUESTORAGE_DRIVER`: `inmemory`, `redis` (the two outcomes of
       `packages/key-value-storage/src/compileKeyValueStorageClient.ts`).
     - `JUMENTIX_MESSAGE_MEDIATOR_ADAPTER`: `inmemory`, `rabbitmq`, `bullmq` (the
       canonical spellings of
       `packages/message-mediator/src/compileMessageMediator.ts`).
     - `JUMENTIX_WEBSOCKET_SOCKETIO_ADAPTER`: `cluster`, `redis-streams`, or empty
       (empty keeps the backend default, the in-memory Socket.IO adapter).
     - `JUMENTIX_WEBSOCKET_REDIS_URL`: a valid `redis://` or `rediss://` URL without
       embedded credentials, or empty (empty falls back to `JUMENTIX_REDIS_URL` and
       then to the discrete `JUMENTIX_REDIS_*` settings in the backend).
   - **Alias decision (per `JUM-461`).** `derby`/`derby-js` and `sails`/`sails-js`
     are the same framework under two accepted spellings. The selector offers the
     canonical spelling of each pair and the server's enum validation agrees with the
     selector exactly — a value the UI offers MUST be a value the server accepts, and
     vice versa. The canonical-spelling decision is recorded in
     `documentation/md/RUNTIME-ENVIRONMENT-CONTRACTS.md` by `JUM-461`; until then the
     11-value set above (which already uses the `-js` spellings) is binding.
     Separately, `JUMENTIX_DATABASE_DRIVER` and
     `JUMENTIX_REALTIME_API_DATABASE_DRIVER` are distinct keys and MUST be separately
     labelled and separately editable in the UI (done by `JUM-461`).
   - **Authentication and bind posture (per `JUM-462`).** The server binds
     `127.0.0.1` by default (`JUMENTIX_SERVICE_MANAGEMENT_HOST`, port
     `JUMENTIX_SERVICE_MANAGEMENT_PORT`, default `3200`). Binding a non-loopback
     interface MUST be an explicit opt-in and MUST log a warning naming the exposure.
     When `JUMENTIX_SERVICE_MANAGEMENT_AUTH_TOKEN` is set, `POST /api/runtime/env`
     MUST require `Authorization: Bearer <token>` and reject anything else with
     `401 { "error": "Unauthorized." }`; when unset, loopback-only operation is
     allowed without a token. Every mutation MUST be logged with timestamp,
     environment, and changed keys. This posture derives from Requirement `044`
     (PCI hardening): the endpoint writes real backend configuration.
   - **Error contract (landed by `JUM-543`).** Parse, validation, and filesystem
     failures are distinguishable:
     - malformed JSON body → `400 { "error": "Invalid payload.", "details": … }`;
     - unsupported/invalid environment →
       `400 { "error": "Invalid environment request.", "details": … }` whose details
       name the unsupported value and the accepted list;
     - missing or wrong bearer token → `401 { "error": "Unauthorized." }`;
     - filesystem failures (missing env file — error code
       `ENV_FILE_NOT_FOUND` — permission errors, full disk) MUST NOT be reported as
       `400 Invalid payload`; they surface as the distinct, identifiable failure
       class `500 { "error": "Environment file operation failed.", "code": …,
       "path": …, "details": … }`, where `code` is `ENV_FILE_NOT_FOUND` or the
       underlying `fs` error code and `path` is the resolved env-file path, so the
       user can tell a broken installation from a malformed request.
     The UI surfaces these failures through non-blocking `aria-live` status
     surfaces, not `window.alert` (`JUM-543`); the client renders exactly what
     the API returns, with no client-side error remapping.
   - **Write semantics.** POST accepts `{ "environment"?, "values" { … } }`; only
     write-allowlisted keys present in `values` are updated — all other keys are
     ignored. Writes are atomic (temp file, `fsync`, rename), preserve unrelated
     lines, quote values containing whitespace or `#` (escaping embedded quotes), and
     end the file with a single trailing newline. Writing an editable key absent
     from the file appends it at the end; writing one present only as a comment
     uncomments the line in place. A successful POST returns the same shape as GET:
     `{ environment, fileName, editableKeys, values }` with the post-write state,
     where `editableKeys` is the write allowlist (the editable tier) so the UI can
     render editable and read-only keys differently without hardcoding the tiers.
   - **Response hygiene.** JSON responses escape `<`, `>`, `&`, `U+2028`, `U+2029`
     and carry `Content-Type: application/json; charset=utf-8` plus
     `X-Content-Type-Options: nosniff`.
   - **Contract 1b — `GET /api/runtime/pm2-ecosystem` (landed by `JUM-480`).**
     Read-only; the single source of the designer's PM2 runtime profile preview.
     - **Environments and file mapping.** Accepted `environment` values:
       `dev`/`development` → `ecosystem.dev.config.cjs`, `staging` →
       `ecosystem.staging.config.cjs`, `production`/`prod` → `ecosystem.production.config.cjs`,
       `ci`/`test` → `ecosystem.ci.cjs`. Same resolution discipline as Contract 1:
       case-insensitive after trimming, unknown values explicitly rejected with
       `400` and the accepted list, default `NODE_ENV` or `dev` when omitted.
     - **Ecosystem location.** The ecosystem directory resolves as
       `JUMENTIX_SERVICE_MANAGEMENT_PM2_DIR` (absolute-resolved) when set,
       otherwise `<repo-root>/pm2`.
     - **Reads reality, never a literal.** The response is
       `{ environment, fileName, path, exists, apps }`; each app carries
       `{ name, script, interpreter, interpreterArgs, env, command }` straight
       from the ecosystem module (loaded cache-busted, so an ecosystem edit is
       reflected without a restart). `command` MUST be derived from the
       ecosystem definition (`pm2 start <path> --only <name> --update-env`);
       neither the server nor the designer may embed a package-manager
       invocation (`pnpm run`, `bun run`, `npm run`) or a `pm2:start:*` script
       name, so the Bun cutover cannot silently invalidate the preview.
     - **Honest edge states.** A missing ecosystem file (e.g. `ci`) is `200`
       with `exists: false` and empty `apps` — an explicit state, not a silent
       empty preview. An unreadable or broken ecosystem file is the 500 class
       `{ "error": "PM2 ecosystem file operation failed.", "code", "path",
       "details" }`, parallel to the env-file filesystem class.
   - **Contract 1c — `GET /api/runtime/pm2-metrics` (amended by `JUM-736`, host/async-context by Monitoring WebSocket delivery).**
     Read-only one-shot snapshot; remains the HTTP Contract for tests and tools.
     The Monitoring tab's **primary live UI path** is Contract 1e (WebSocket);
     this GET MUST stay available and shape-compatible for Contract 1c consumers.
     - **Metrics source.** The endpoint MUST collect live process data through
       the PM2 Node API (`pm2.connect`, `pm2.list`, `pm2.disconnect`). It MUST NOT
       infer process health from the ecosystem file, shell output or command
       strings. `JUMENTIX_SERVICE_MANAGEMENT_PM2_MODULE` may replace the module
       path only for tests.
     - **Environment comparison.** Accepted `environment` values and ecosystem
       file resolution match Contract 1b. The response compares the selected
       ecosystem's expected app names with PM2's live process list so missing
       expected processes are visible without reading a terminal.
     - **Host metrics.** Success payloads MUST include `host` with CPU usage
       (aggregate + per-core sample), memory (total/used/free/process RSS sum),
       and disk volumes for the project root, temp dir, and optional
       `JUMENTIX_SERVICE_MANAGEMENT_DISK_PATHS` entries (`fs.statfs`).
     - **Async context scrape.** When a process exposes a local HTTP port via
       ecosystem env (`JUMENTIX_HTTP_PORT` / `PORT`), the collector MAY scrape
       `GET http://127.0.0.1:<port>/async-context-metrics` with a short timeout
       and attach `asyncContext` on that process; `summary.asyncContextActiveSum`
       aggregates successful scrapes. The scrape payload includes counters,
       `lastCorrelationIds`, and `recentStores` (redacted Map snapshots —
       keys matching `/password|token|secret|authorization|cookie/i` become
       `[REDACTED]`). Scrape failures MUST NOT fail the whole metrics response.
     - **Per-process disk I/O.** Each process SHOULD carry `diskIo` collected from
       the OS using the process `pid`: Linux `/proc/<pid>/io`; Darwin
       `proc_pid_rusage` via in-process Bun FFI (`darwinProcessDiskIo.js`); Windows PowerShell
       `IOReadBytes`/`IOWriteBytes`. Failures and unsupported platforms MUST use
       honest envelopes (`supported: false` or `error`/`code`) — never invent zeros.
     - **Response shape.** Success is `{ source: "pm2", collectedAt,
       environment, ecosystem, summary, host, processes }`. `ecosystem` carries
       `{ fileName, path, exists, expectedProcessCount, missingExpected }`;
       `summary` carries process counts, online/stopped/errored counts, total CPU,
       total memory, status counts and `asyncContextActiveSum`; each process carries
       `{ name, pmId, pid, namespace, status, cpuPercent, memoryBytes, restartCount,
       unstableRestarts, uptimeMs, startedAt, script, interpreter, watching,
       customMetrics, asyncContext?, diskIo? }`.
     - **Honest failure state.** Unsupported environments reuse Contract 1's
       `400` invalid-environment envelope. PM2 connection/list/module failures
       are `500` with `{ "error": "PM2 metrics collection failed.", "code",
       "details" }`.

   - **Contract 1e — `WS /api/runtime/pm2-ws` (Monitoring live stream + actions).**
     Primary Monitoring-tab transport. Uses the `ws` package on the Service
     Management HTTP server upgrade path; MUST NOT replace Contract 1c.
     - **Subscribe.** Client sends `{ type: "subscribe", environment, intervalMs,
       filters? }`. `intervalMs` is clamped to `[500, 2000]` (default `1000`).
       Server pushes `{ type: "metrics", payload }` where `payload` matches
       Contract 1c success shape.
     - **Actions.** Client may send `{ type: "action", action, scope, name?,
       pmId?, namespace? }` with `action` ∈ { `start`, `stop`, `restart` } and
       `scope` ∈ { `process`, `namespace`, `ecosystem-missing` }. Server replies
       `{ type: "action-result", ok, action, scope, name?, error? }` and MAY push
       a fresh metrics frame after success.
     - **Honesty.** Unauthorized/invalid payloads and PM2 failures return
       explicit `error` / `action-result` frames; the stream MUST NOT invent
       healthy process data when PM2 collection fails.

4. **Contract 2 — `service-management.v1` storage schema (historically the
   localStorage storage schema).**
   - The entire suite state (all persisted authoring tabs) persists as ONE JSON payload under the
     single pinned key `service-management.v1` — historically a localStorage key;
     since `JUM-484`'s landed one-way migration, a key in Cana's
     `designerDocuments` IndexedDB object store. The migration copied the exact
     documents across without changing the persisted domain/interface/deploy wire
     format. `JUM-736` adds the generated-code workspace as another additive
     section. The current document has exactly these top-level
   sections: `domains`, `relationships`, `selectedDomainId`, `selectedEntityId`,
   `selectedRelationshipId`, `idCounter`, `activeTab`, `interfaces`,
   `serviceConfiguration`, `runtimeEnvironment`, `codeWorkspace`,
   `monitoringHistory`, `deployments`, `view`.
   - `activeTab` ∈ { `domain-designer`, `interface-designer`, `service-config`,
     `deploy-management`, `monitoring`, `code-workspace` } — one per visible tab.
   - `serviceConfiguration`: `{ serviceKind, runMode, cloudProvider,
     staticAssetsPath, ports: { rest, websocket, grpc } }` with
     `serviceKind` ∈ { `rest-api`, `websocket-rest-api`, `grpc-rest-api` },
     `runMode` ∈ { `dedicated-server`, `virtual-machine`, `container`, `functions` },
     and `cloudProvider` ∈ { `aws`, `google`, `azure`, `vercel`, `cloudflare`,
     `docker` }.
   - `runtimeEnvironment`: `{ environment, fileName, values }` mirroring Contract 1
     (environment enum and the visible runtime keys — the editable and read-only
     tiers; never-exposed keys never enter this state).
   - `codeWorkspace`: `{ activePath, files }`, where `files` is keyed by generated
     path and each value is `{ path, state, baseContent, generatedContent, content,
     updatedAt }`. `state` ∈ { `generated`, `edited`, `stale` }. Generated files
     follow the current model automatically; user-edited files become `stale` when
     the generator output changes underneath them until the user explicitly keeps
     their edit or takes the regenerated version. This is a backward-compatible
     additive section; older payloads normalize to `{ files: {}, activePath: "" }`.
   - `monitoringHistory`: `{ version: 1, updatedAt, environment, samples, processes }`
     — local Monitoring telemetry cache (not domain-package export). `samples` is a
     ring (max 60) of aggregate ticks `{ t, hostCpu, hostMemUsedPercent, cpuTotal,
     memTotal, onlineRatio, asyncActiveSum }`. `processes` maps
     `${namespace}::${name}` to spark series `{ cpu, mem, restarts, asyncActive,
     diskReadBytes, diskWriteBytes }` (each series max 60; max 40 process keys,
     LRU). Older payloads normalize to an empty history. Charts use D3 vendored
     under `vendor/d3` (no CDN).
   - `deployments`: array of deploy targets aligned to the Requirement 059
     Service Management metadata contract (`JUM-481`), each
     `{ name, region, runtime, serviceType, deployTarget, runtimeProtocol,
     databaseDriver, keyValueDriver, pm2Profile }` with
     `serviceType` ∈ { `restapi`, `websocket+restapi`, `grpc+restapi`,
     `functions` }, `deployTarget` ∈ { `dedicated-server`, `vm`, `ec2`,
     `lambda`, `vercel-functions`, `cloudflare-workers` }, `runtimeProtocol` ∈
     { `http`, `websocket`, `grpc` }, `databaseDriver`/`keyValueDriver` drawn
     from the Contract 1 `JUMENTIX_DATABASE_DRIVER`/
     `JUMENTIX_KEYVALUESTORAGE_DRIVER` enums, and `pm2Profile` ∈ { `dev`,
     `staging`, `production` } on PM2-managed targets (`dedicated-server`,
     `vm`, `ec2`) and empty otherwise. Entries persisted before this
     alignment (`{ name, type, region, runtime }`) migrate forward on load:
     `type` becomes `deployTarget` (`dedicated` → `dedicated-server`; values
     with no Requirement 059 counterpart are kept verbatim so the migration
     is lossless) and missing metadata fields take the contract defaults.
     This is a backward-compatible extension of an existing section, so the
     versioned key is unchanged.
   - `view`: `{ zoom (clamped 0.5–2), compactEntities, snapToGrid,
     edgeStyle ∈ { curved, orthogonal },
     modelCheckMinSeverity ∈ { info, warn, error }, exportBlockCritical (default
     true), largeCanvasMode }`.
   - Entity field types ∈ { `string`, `integer`, `number`, `boolean`, `array`,
     `object`, `date`, `datetime`, `uuid` }.
   - **Additive package-versioning fields (landed by `JUM-492`).** Domains MAY
     carry `context.packageName`, `context.packageVersion` and
     `context.provenance = { package, version }`, and entities MAY carry
     `meta.provenance = { package, version }` (see Contract 3, domain
     package). These are a backward-compatible extension of existing objects —
     present only on content imported from a versioned package — so the
     versioned key is unchanged, following the deployments precedent above.
   - The schema-diff baseline lives under the separate key
     `service-management.schema-baseline.v1` and holds
     `{ domains: [{ id, name, color, context, entities: [{ id, name, meta, contracts,
     fields: [{ name, type, required, pk, fk, unique, nullable, format, itemsType,
     enumValues }] }] }], relationships: [{ id, fromEntityId, toEntityId,
     fromCardinality, toCardinality }] }`.
   - This schema was the migration source for the `IDesignerStore` port (`JUM-468`)
     and the Cana migration (`JUM-484`, landed): the migration copied these exact
     documents into Cana (IndexedDB) without changing the wire format — the
     versioned keys above are now Cana keys, byte-identical documents. Any
     structural change MUST bump the versioned key and update this requirement
     in the same PR.

5. **Contract 3 — Export formats and the export quality gate.**
   Eight exporters exist; each guarantees:
   - **JSON** (`domain-designer.json`): the full-suite document (shape landed
     by `JUM-547`): `{ kind: "service-management-suite", version: "2.0.0",
     domains, relationships, interfaces, serviceConfiguration,
     runtimeEnvironment, codeWorkspace, deployments, view }` — all persisted
     authoring sections, re-importable shape. `interfaces` entries are
     `{ type, framework, entrypoint, controller }`; `serviceConfiguration` and
     `deployments` carry the Contract 2 shapes. The pre-`JUM-547` shape was
     `{ domains, relationships,
     view }` with no `kind`/`version`; import MUST keep accepting it,
     defaulting the missing sections (backward compatibility). Import MUST
     refuse a document whose `version` major is newer than the importer's, a
     `kind` other than the suite kind, or any unknown top-level section —
     failing clearly rather than half-importing or silently discarding
     sections (forward compatibility).
   - **`runtimeEnvironment` in the JSON export — the recorded `JUM-547`
     decision.** The bundle carries the environment *selection* only
     (`{ environment, fileName }`), never `values`. The values mirror real
     `.env` contents of the machine the designer runs on — the editable and
     read-only tiers of the Contract 1 classification (the never-exposed tier
     never even enters this state) — so a bundle containing them is a file
     that can carry configuration off the machine; the runtime environment is
     a property of where the designer is running, not of the service being
     designed. On import the selection is restored and, when the document
     carries no `values`, the local machine's values are preserved. No secret
     can leave in a bundle.
   - **Markdown** (`domain-designer-model.md`): human-readable model document —
     per-domain bounded-context metadata, per-entity field table
     (name/type/required/PK/FK/unique/nullable), RBAC per action, message contracts,
     and a relationships section.
   - **JSON Schema** (`domain-designer-json-schema.json`): draft 2020-12
     (`$schema: https://json-schema.org/draft/2020-12/schema`), one entry per entity
     under `definitions` with `type: object`, `required` derived from required
     fields, and `additionalProperties: false`.
   - **AsyncAPI** (`<version>.websocket.yml` and `<version>.grpc.yml`, one file per
     transport, following the canonical `spec/asyncapi/` naming; landed by
     `JUM-475`): each file declares `asyncapi: 3.0.0` with `info`,
     `defaultContentType: application/json` and a `local` server whose port comes
     from `serviceConfiguration.ports` (canonical defaults 3001/3002); channels
     carry `address` (explicit `channel` or the `<domain>/<entity>/<type>`
     fallback) plus message `$ref`s; the top-level `operations` map carries
     `action: receive` for `response` contracts and `action: send` for all other
     types, with channel/message `$ref`s; message payloads are shared
     `components.schemas` entries referenced via `$ref` (structurally identical
     payloads share one entry), never inlined. Every exported document MUST pass
     the AsyncAPI 3.0 structural validation of
     `packages/designer-core/src/validation/asyncApi30Validation.js` — the same
     rules the canonical `spec/asyncapi/*.yml` files pass.
   - **gRPC proto** (`async-api.proto`; landed by `JUM-475`): aligned with the
     canonical `spec/asyncapi/async-api.proto` — proto3 syntax, package
     `realtime`, service `AsyncApiGateway`. `request` contracts become unary rpcs
     whose return message is the `response` contract on the same channel (or the
     canonical `AsyncApiResponse` envelope when unpaired); unpaired `response`
     contracts take the canonical `AsyncApiRequest` envelope; `event`/`command`
     contracts become bidirectional streaming rpcs (the canonical `Exchange`
     convention). One message per contract derives its fields from the payload
     schema (objects travel as JSON-encoded strings, the canonical `*Json`
     convention). A contract-less model exports exactly the canonical
     `async-api.proto`.
   - **Boilerplate bundle** (`domain-designer-boilerplate-bundle.json`):
     `{ kind: "boilerplate-bundle", version: "2.0.0", generatedAt, modules }` with
     one module per domain. Each module carries `{ module, path, files, entities }`:
     `files.composition` is the domain composition root
     (`composition/compose<Domain>Services.ts`), `files.eventChannels`
     (`events/contracts/<Domain>EventChannels.ts`) is present only when the domain
     declares message contracts, and every entity carries the hexagonal file set —
     `entityInterface` (`domain/Entity/I<Entity>.ts`), `model`
     (`domain/Model/<Entity>.ts`), `security` (`domain/security/<Entity>Rbac.ts`),
     `repositoryPort` (`application/ports/I<Entity>Repository.ts`), `useCasesPort`
     (`application/ports/I<Entity>UseCases.ts`), `useCases`
     (`application/use-cases/<Entity>UseCases.ts`), `persistenceAdapter`
     (`adapters/out/persistence/<Entity>DataRepository.ts`) and `controller`
     (`adapters/in/http/controllers/<Entity>Controller.ts`) — under
     `src/modules/<Domain>/`, matching the migrated Users layout. Every file is
     `{ path, content }`; the content is self-contained TypeScript whose field
     shapes, routes and event channels are consumed from the OAS 3.1/AsyncAPI
     exports (not re-derived from the model), whose imports respect the
     hexagonal dependency direction, and which compiles under `tsc --strict`.
     The Code Preview pane renders this same builder, so preview and bundle
     cannot diverge. (Shape pinned by JUM-476; `version` 1.0.0 emitted the
     pre-hexagonal path-only layout.)
   - **Domain package** (`<domain>-package.json`): versioned single-domain
     package (shape landed by `JUM-492`): `{ kind: "domain-package",
     version: "2.0.0", exportedAt, package: { name, version, dependencies:
     [{ name, range }] }, domain }`. The `package` block declares the package
     identity: `name` (the domain's `context.packageName`, falling back to
     the domain name), `version` (the domain's `context.packageVersion`,
     falling back to `1.0.0`) and `dependencies` parsed from the domain's
     `context.packageDependencies` entries (`name@range`; a bare name is a
     presence-only dependency). Import MUST keep accepting the pre-`JUM-492`
     v1 shape (`{ kind, version: "1.0.0", exportedAt, domain }`, no `package`
     block), synthesizing the identity `{ name: domain.name, version:
     1.0.0, dependencies: [] }` (backward compatibility), and MUST refuse a
     document whose `version` major is newer than the importer's (2) or a
     `kind` other than `domain-package` (forward compatibility).
   - **Domain-package versioning semantics (landed by `JUM-492`).** A domain
     package is versioned data, not code, so the usual semver semantics are
     redefined for it:
     - *patch* — documentation/metadata only (field descriptions, formats,
       constraints, domain context text, OAS composition hints);
     - *minor* — additive structure (a new entity, field or message
       contract; a required flag loosened);
     - *major* — removal or narrowing (a removed entity/field/contract, a
       field type or PK/FK/unique change, a required flag tightened, an RBAC
       or invariant change, an aggregate declaration change).
     Dependency ranges accept `*`/empty (any), exact `1.2.3`, caret `^1.2.3`
     (same major; for `0.x`, same minor — the npm convention) and tilde
     `~1.2.3` (same major.minor); anything else is invalid and satisfies
     nothing, so it is reported rather than silently accepted.
   - **Provenance (landed by `JUM-492`).** Imported content MUST be stamped:
     the domain carries `context.provenance = { package, version }` plus
     `context.packageName`/`context.packageVersion`, and every imported
     entity carries `meta.provenance = { package, version }`. The
     normalizers carry these fields additively (only when the source
     declares them), so pre-`JUM-492` payloads are unchanged and provenance
     crosses the full-suite export, the storage schema and loads intact.
     The installed-package registry derives from provenance ONLY — a
     locally-built domain is not an installation, so importing a package
     named like a hand-built domain appends (with the JUM-617 id
     recomputation) instead of merging into unrelated content.
   - **Dependency graph (landed by `JUM-492`).** Import resolves the
     registry (with the incoming package overlaid) as a graph, transitively:
     a declared dependency no installed package provides, or an installed
     version outside the declared range, is reported through the status
     region (the import proceeds — the designer reports, it is not the
     resolver); a cycle the incoming package participates in is reported by
     name chain and the import is refused — cycles are detected and
     reported, never entered.
   - **Conflict classification and resolution (landed by `JUM-492`).**
     Re-importing an installed package has a defined outcome per case, all
     deterministic and explainable:
     - same version, equal content → no-op (idempotent re-import — importing
       the same package version twice changes nothing);
     - same version, different content → refused (`same-version-conflict`):
       version immutability — the differences are listed in the merge
       preview and nothing is applied;
     - older version → refused (`downgrade-rejected`);
     - newer version → merge with a per-aspect classification:
       - *auto-merge* (applied): added entity/field/contract, required flag
         loosened, field metadata, OAS composition and domain context
         changes;
       - *requires a decision* (NEVER auto-applied — the existing designer
         content is kept for the aspect): removed entity/field/contract,
         contract change, field type or PK/FK/unique flag change, required
         flag tightened, aggregate declaration change, and ALWAYS RBAC and
         invariant changes — automatically resolving a security policy or a
         domain invariant is a decision a merge algorithm must not make.
       The merge preview renders every aspect (with its class and
       resolution) on the schema-diff surface BEFORE anything changes, and a
       merge carrying requires-decision aspects applies only after the user
       explicitly accepts (a gated `window.confirm` — a toast is not a
       substitute for the gate). After a merge the provenance advances to
       the incoming version. All user-facing outcomes surface through the
       non-blocking status region (`showStatus`), never `alert()`.
   - **OpenAPI 3.1** (`domain-designer-oas-3.1.json`): `openapi: 3.1.0`; CRUD paths
     per entity with unique operationIds on the canonical `spec/1.0.0.yml` verb
     scheme (`getAll<Schema>`/`create<Schema>`/`get<Schema>ById`/`update<Schema>`/
     `delete<Schema>`); request bodies reference `RequestCreate<Schema>`/
     `RequestUpdate<Schema>` port input objects and 2xx responses reference the
     entity schema, its `<Schema>ArrayOf` wrapper or `ResourceDeleteResponse` via
     `$ref`, every referenced schema carrying a non-empty `description`
     (Requirement 036, enforced by `ci-cd/check-oas-route-resolution.js`); error
     responses use the canonical `ERROR-CONTRACTS-AND-RESPONSES` codes
     (400/401/403/404/409); entity component schemas carrying `x-domain`,
     `x-entity`, `x-message-contracts`, optional `oneOf`/`allOf`/`anyOf`
     composition with `discriminator` and `x-external-refs`, plus top-level
     `x-message-contracts` and `x-relations`. Port input/output wrappers are
     marked `'x-port-object': true` and skipped by the OAS importer (JUM-474).
     JUM-478 extended the extension set so the OAS crossing is lossless for
     designer-exported documents: entity schemas additionally carry
     `x-aggregate-root` and `x-invariants` when set, `x-rbac` when the
     entity's normalized RBAC policy diverges from the designer default,
     `x-fieldless: true` for entities with an empty field set, and per-field
     `x-field-flags: { pk, fk, unique }` when those flags diverge from the
     importer's name heuristic (`id` → PK/unique, `*Id` → FK); `x-relations`
     rows carry `{ name, fromSchema, toSchema, fromCardinality,
     toCardinality }` — schema names, not model ids, which the importer
     recomputes. The importer normalizes this extension set back into
     `entity.meta` (RBAC rules are rebuilt against the tenant RBAC contract,
     JUM-477), restores relationships from `x-relations` re-keyed to the
     recomputed entity ids, and — for unmarked foreign documents such as the
     canonical `spec/1.0.0.yml` — recognizes port objects by the same
     conventions (`Request<Action>*` and `*ArrayOf` names,
     `ResourceDeleteResponse`, "Port input/output object" descriptions that
     are not `<Name> resource` entity contracts, and non-object schemas).
   - **Export quality gate.** When `view.exportBlockCritical` is true (the default),
     every exporter MUST refuse to run while model validation reports any
     `error`-severity issue, surfacing the blocking issues instead of producing a
     file. When the flag is false, export proceeds ungated.

## Acceptance Criteria

- Requirement filed under `.agents/requirements/software/` with unique ID `126`,
  indexed exactly once in `.agents/README.md`, passing `bun run requirements:check`.
- All three public contracts specified precisely enough that a violation is
  detectable by a test (the `JUM-466` smoke asserts them) rather than by reading.
- The env-file location is pinned (item 2), so a future re-homing that breaks it
  fails a check instead of silently serving defaults.
- Ownership registered in `.agents/COMPONENT-OWNERSHIP.md`; NFR registry
  synchronized in the same PR.

## Evidence

- This requirement file.
- `.agents/COMPONENT-OWNERSHIP.md` — component ownership registry established here;
  first entry names `kimi-code-primary-001` as owner of `apps/service-management`.
- Contract sources of truth: `apps/service-management/server.js`,
  `apps/service-management/script.js`, `apps/service-management/index.html`,
  `apps/service-management-api/src/ServiceManagementCatalogAPI.ts`,
  `apps/service-management-api/spec/1.0.0.yml`,
  `apps/backend-template/src/interface/runtime/RuntimeEnvironment.ts`,
  `documentation/md/RUNTIME-ENVIRONMENT-CONTRACTS.md`,
  `documentation/md/SERVICE-MANAGEMENT-APPLICATION.md`.
- Behavior pinned as of the `JUM-458`/`JUM-558`/`JUM-459`/`JUM-462` fix branch
  (`kimi/fix/JUM-458-service-management-env-path`), including its integration suite
  `apps/service-management/test/integration/server/runtimeEnv.integration.test.ts`;
  enum validation and the full 23-key key classification landed via `JUM-460`
  (branch `kimi/feature/JUM-460-env-allowlist-runtime-matrix`, same integration
  suite extended), the UI label/selector alignment via `JUM-461`, the
  error-surface split via `JUM-543`.
- Contract 3 amended by `JUM-475` (branch
  `kimi/feature/JUM-475-asyncapi-proto-exports`): the AsyncAPI exporter now emits
  one AsyncAPI 3.0 `<version>.<transport>.yml` file per transport targeting the
  canonical `spec/asyncapi/` conventions (replacing the single
  `domain-designer-asyncapi.json` 2.x-shaped document), and the gRPC proto export
  (`async-api.proto`) was added, taking the exporter count from seven to eight.
  Pinned by
  `apps/service-management/test/unit/designerAsyncApiExport.test.ts`.
- Contract 1b added by `JUM-480` (branch
  `kimi/feature/JUM-480-multi-env-pm2-preview`): the read-only
  `GET /api/runtime/pm2-ecosystem` endpoint pins the PM2 preview to the real
  `pm2/ecosystem.*.cjs` files. Pinned by
  `apps/service-management/test/integration/server/pm2Ecosystem.integration.test.ts`
  (server behavior) and
  `apps/service-management/test/unit/pm2EcosystemUi.contract.test.ts`
  (designer-side no-hardcoded-command rule).
- Contract 3 amended by `JUM-547` (branch
  `kimi/feature/JUM-547-full-suite-export-import`): the JSON export became the
  versioned full-suite document carrying all persisted authoring sections, and the
  `runtimeEnvironment` decision (selection crosses, values never leave the
  machine) is recorded above, in the JSON export bullet. Pinned by
  `apps/service-management/test/unit/designerRoundTrip.test.ts`
  (full-suite deep-equal, backward/forward compatibility) and
  `apps/service-management/test/unit/designerExporters.test.ts`
  (document shape).
- Contract 2 and 3 amended by `JUM-736`: the Code Workspace tab persists
  generated-file overlays in `codeWorkspace`, suite JSON export/import carries that
  section, and boilerplate bundle export applies edited/stale file content. Pinned
  by `apps/service-management/test/unit/designerState.test.ts`,
  `apps/service-management/test/unit/designerRoundTrip.test.ts`
  and `apps/service-management/test/unit/designerExporters.test.ts`.
  This is additive and normalizes old payloads to an empty workspace, so there is
  no versioned key bump.
- Contract 1c amended by `JUM-736` and extended for host + async-context fields:
  the Monitoring HTTP one-shot `GET /api/runtime/pm2-metrics` still collects via
  the PM2 Node API, compares live processes with the selected ecosystem file, and
  now also returns `host` CPU/memory/disk plus optional per-process
  `asyncContext` scrapes. Pinned by
  `apps/service-management/test/integration/server/pm2Ecosystem.integration.test.ts`
  and `apps/service-management/test/unit/pm2EcosystemUi.contract.test.ts`.
- Contract 1e: Monitoring live UI uses `WS /api/runtime/pm2-ws` (500–2000 ms
  interval, default 1000) with process/namespace/ecosystem-missing start/stop/
  restart actions. Contract 1c remains the HTTP one-shot. Pinned by the same
  integration + UI contract suites.
- Contract 1d amended by `JUM-748`: the shared catalog moved out of
  `apps/backend-template` into the Service Management platform API
  `apps/service-management-api`. The designer's `catalogSyncClient` now fails closed
  without an explicit `JUMENTIX_SERVICE_MANAGEMENT_CATALOG_API_URL`; PM2 starts a
  dedicated catalog API process next to the designer; and
  `apps/backend-template/test/unit/ownership/backendTemplateCatalogOwnership.test.ts`
  prevents catalog runtime, `/catalogs` OAS paths, catalog stores, and catalog role
  scopes from drifting back into the generated-service template.
- Contract 3 amended by `JUM-492` (branch
  `kimi/feature/JUM-492-domain-package-versioning`): the domain package became
  a versioned document (`package` block with name/version/dependencies), with
  the versioning semantics, provenance stamping, dependency-graph resolution
  and conflict classification recorded above. Contract 2 gained the additive
  provenance/package fields (backward-compatible extension — no versioned key
  bump). Pinned by
  `apps/service-management/test/unit/designerPackageVersioning.test.ts`
  (version parsing/ordering, ranges, dependency graph, conflict policies) and
  `apps/service-management/test/unit/designerRoundTrip.test.ts`
  (versioned export→import, idempotent re-import, conflicting re-import,
  compatible/incompatible dependency pairs).
- Registry sync: `.agents/NFR-REGISTRY.md`,
  `documentation/md/SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.md` (+ `.pt-BR.md`),
  `documentation/md/SPEC-REQUIREMENTS-COVERAGE-STATUS.md` (+ `.pt-BR.md`),
  `.agents/README.md`; validated by `bun run requirements:check` and
  `bun run test-map:check`.
- The canonical agent registry lives in Firestore (Requirement `089`); the frozen
  `.agents/AGENT-REGISTRY.md` mirror is intentionally not edited.
