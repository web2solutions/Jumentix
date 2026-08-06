# Requirement 126 - Service Management Ownership and Public Contracts

- Status: Active
- Nature: NFR (governance, component contract specification, drift detection)
- Source: Linear `JUM-465`, epic "Service Management ownership, modernization and Cana
  adoption", milestone H1 (Correctness & runtime alignment), 2026-08-05.
- Strengthens: `038`, `043`. Relates to: `044`, `052`, `123` and Linear `JUM-458`,
  `JUM-558`, `JUM-459`, `JUM-460`, `JUM-461`, `JUM-462`, `JUM-543`, `JUM-466`,
  `JUM-468`, `JUM-475`, `JUM-484`.

## Context

The Wave 5 re-homing moved `apps/backend-template` and silently broke the
`apps/service-management/server.js` env-file path: nothing pinned where the env files
live, no owner watched the component, and no smoke asserted the path resolves. The
defect served default values as though they were real configuration. This requirement
registers a formal owner for the component and pins its three public contracts —
the `/api/runtime/env` API, the `service-management.v1` localStorage schema, and the
export formats — precisely enough that a violation is detectable by a test rather
than by reading. The H1 child issues implement the behavior; this requirement is the
contract they converge on, and the smoke expansion in `JUM-466` asserts it.

## Requirement

1. **Ownership registration.**
   - `apps/service-management` MUST have a registered owner in the component ownership
     registry `.agents/COMPONENT-OWNERSHIP.md` (established by this requirement).
     The registered owner is agent `kimi-code-primary-001`.
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
     The full 23-key classification of `.env.dev` (each addition to the editable set
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
     - *Read-only (read allowlist only, 14 keys):*
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
   - **Error contract (per `JUM-543`).** Parse, validation, and filesystem failures
     are distinguishable:
     - malformed JSON body → `400 { "error": "Invalid payload.", "details": … }`;
     - unsupported/invalid environment →
       `400 { "error": "Invalid environment request.", "details": … }` whose details
       name the unsupported value and the accepted list;
     - missing or wrong bearer token → `401 { "error": "Unauthorized." }`;
     - filesystem failures (missing env file — internally error code
       `ENV_FILE_NOT_FOUND` — permission errors, full disk) MUST NOT be reported as
       `400 Invalid payload`; they surface as a distinct, identifiable failure so the
       user can tell a broken installation from a malformed request.
     The UI surfaces these failures through non-blocking status surfaces, not
     `window.alert` (`JUM-543`).
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

4. **Contract 2 — `service-management.v1` localStorage storage schema.**
   - The entire suite state (all four tabs) persists as ONE JSON payload under the
     single localStorage key `service-management.v1`, with exactly these top-level
     sections: `domains`, `relationships`, `selectedDomainId`, `selectedEntityId`,
     `selectedRelationshipId`, `idCounter`, `activeTab`, `interfaces`,
     `serviceConfiguration`, `runtimeEnvironment`, `deployments`, `view`.
   - `activeTab` ∈ { `domain-designer`, `interface-designer`, `service-config`,
     `deploy-management` } — one per tab.
   - `serviceConfiguration`: `{ serviceKind, runMode, cloudProvider,
     staticAssetsPath, ports: { rest, websocket, grpc } }` with
     `serviceKind` ∈ { `rest-api`, `websocket-rest-api`, `grpc-rest-api` },
     `runMode` ∈ { `dedicated-server`, `virtual-machine`, `container`, `functions` },
     and `cloudProvider` ∈ { `aws`, `google`, `azure`, `vercel`, `cloudflare`,
     `docker` }.
   - `runtimeEnvironment`: `{ environment, fileName, values }` mirroring Contract 1
     (environment enum and the visible runtime keys — the editable and read-only
     tiers; never-exposed keys never enter this state).
   - `view`: `{ zoom (clamped 0.5–2), compactEntities, snapToGrid,
     edgeStyle ∈ { curved, orthogonal },
     modelCheckMinSeverity ∈ { info, warn, error }, exportBlockCritical (default
     true), largeCanvasMode }`.
   - Entity field types ∈ { `string`, `integer`, `number`, `boolean`, `array`,
     `object`, `date`, `datetime`, `uuid` }.
   - The schema-diff baseline lives under the separate key
     `service-management.schema-baseline.v1` and holds
     `{ domains: [{ id, name, color, context, entities: [{ id, name, meta, contracts,
     fields: [{ name, type, required, pk, fk, unique, nullable, format, itemsType,
     enumValues }] }] }], relationships: [{ id, fromEntityId, toEntityId,
     fromCardinality, toCardinality }] }`.
   - This schema is the migration source for the `IDesignerStore` port (`JUM-468`)
     and the Cana migration (`JUM-484`). Any structural change MUST bump the
     versioned key and update this requirement in the same PR.

5. **Contract 3 — Export formats and the export quality gate.**
   Eight exporters exist; each guarantees:
   - **JSON** (`domain-designer.json`): `{ domains, relationships, view }` — the
     full model, re-importable shape.
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
     `apps/service-management/src/validation/asyncApi30Validation.js` — the same
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
   - **Domain package** (`<domain>-package.json`): `{ kind: "domain-package",
     version: "1.0.0", exportedAt, domain }` for the selected domain; the package
     import flow accepts exactly this shape.
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
  `apps/backend-template/src/interface/runtime/RuntimeEnvironment.ts`,
  `documentation/md/RUNTIME-ENVIRONMENT-CONTRACTS.md`,
  `documentation/md/SERVICE-MANAGEMENT-APPLICATION.md`.
- Behavior pinned as of the `JUM-458`/`JUM-558`/`JUM-459`/`JUM-462` fix branch
  (`kimi/fix/JUM-458-service-management-env-path`), including its integration suite
  `apps/backend-template/test/integration/ServiceManagement/runtimeEnv.integration.test.ts`;
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
  `apps/backend-template/test/unit/service-management/designerAsyncApiExport.test.ts`.
- Registry sync: `.agents/NFR-REGISTRY.md`,
  `documentation/md/SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.md` (+ `.pt-BR.md`),
  `documentation/md/SPEC-REQUIREMENTS-COVERAGE-STATUS.md` (+ `.pt-BR.md`),
  `.agents/README.md`; validated by `bun run requirements:check` and
  `bun run test-map:check`.
- The canonical agent registry lives in Firestore (Requirement `089`); the frozen
  `.agents/AGENT-REGISTRY.md` mirror is intentionally not edited.
