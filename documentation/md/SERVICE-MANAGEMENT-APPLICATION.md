# Service Management Application

The previous `domaindesigner` static app was consolidated into:

- `apps/service-management/`

It is now a tabbed suite for service lifecycle design.

Core implementation files:

- `apps/service-management/index.html`
- `apps/service-management/script.js`
- `apps/service-management/src/state/designerState.js`
- `apps/service-management/src/store/IDesignerStore.js`
- `apps/service-management/src/store/CanaDesignerStore.js`
- `apps/service-management/src/store/designerStoreFactory.js`
- `apps/service-management/src/store/canaMigration.js`
- `apps/service-management/styles.css`
- `apps/service-management/server.js`

Module layering, the injection pattern and the `IDesignerStore` storage port
contract are documented in
[Service Management Module Architecture](./SERVICE-MANAGEMENT-MODULE-ARCHITECTURE.md).
What the contract exports guarantee — and the checks that prove it — are
documented in
[Service Management Contract Parity Guarantees](./SERVICE-MANAGEMENT-CONTRACT-PARITY.md).

## Tabs

1. **Domain Designer**
   - Full ER modeling MVP including:
     - domain/entity lifecycle and inspector
     - relationship anchors, bend/path controls, routing style
     - bounded-context metadata
     - aggregate + invariants
     - RBAC per entity/action
     - message contracts (`event/command/request/response`)
     - OpenAPI composition (`oneOf/allOf/anyOf`, external refs, discriminator)
     - schema diff + migration hints
     - request/response examples
     - hexagonal code preview (renders exactly what the boilerplate bundle emits)
     - code skeleton preview
     - export/import flows (JSON, OAS, Markdown, JSON Schema, AsyncAPI per-transport
       (`<version>.websocket.yml` / `<version>.grpc.yml` targeting the canonical
       `spec/asyncapi/` conventions), gRPC proto (`async-api.proto`), package,
       boilerplate bundle)
     - mini-map and large-canvas mode
2. **Communication Interface Designer**
   - Registers inbound interface adapters and controller mappings:
     - HTTP/REST
     - gRPC
     - WebSocket
     - SSE
3. **Service Configuration**
   - Captures runtime profile and deployment shape:
     - service kind (`REST API`, `WebSocket API + REST API`, `gRPC API + REST API`)
     - run mode
     - cloud provider
     - static assets behavior
     - runtime ports (`REST`, `WebSocket`, `gRPC`)
   - Shows PM2-oriented profile preview for VM runtime orchestration, read from
     the real `pm2/ecosystem.*.cjs` files via `GET /api/runtime/pm2-ecosystem`
     (JUM-480) — no hardcoded process list or package-manager command.
   - Includes runtime env controls with a three-tier key model:
     - **Editable** (read/write runtime topology selectors):
       `JUMENTIX_HTTP_FRAMEWORK`, `JUMENTIX_REALTIME_API`,
       `JUMENTIX_REALTIME_API_PROTOCOL`, `JUMENTIX_REALTIME_API_DATABASE_DRIVER`,
       `JUMENTIX_DATABASE_DRIVER`, `JUMENTIX_KEYVALUESTORAGE_DRIVER`,
       `JUMENTIX_MESSAGE_MEDIATOR_ADAPTER`, `JUMENTIX_WEBSOCKET_SOCKETIO_ADAPTER`,
       `JUMENTIX_WEBSOCKET_REDIS_URL`.
     - **Read-only** (connection endpoints and non-secret config, displayed but not
       writable): Redis host/port/database, RabbitMQ exchange/queue/prefetch,
       database name, JWT issuer/audience, CORS origins, and auth policy keys.
     - **Never exposed** (neither shown nor writable): secrets such as
       `JUMENTIX_JWT_TOKEN_SECRET_KEY`, `JUMENTIX_REDIS_PASSWORD`, and
       `JUMENTIX_RABBITMQ_URL`.
   - Editable values are validated against the enum sets of
     `documentation/md/RUNTIME-ENVIRONMENT-CONTRACTS.md`; out-of-enum values are
     rejected with the accepted list and nothing is written.
   - Runtime env editor targets the selected environment file:
    - `dev` -> `apps/backend-template/src/config/.env.dev`
    - `staging` -> `apps/backend-template/src/config/.env.staging`
    - `ci` -> `apps/backend-template/src/config/.env.ci`
   - Runtime env editor targets the selected environment file under
     `apps/backend-template/src/config/`:
    - `dev` -> `.env.dev` (`development` is an alias)
    - `staging` -> `.env.staging`
    - `ci` -> `.env.ci` (`test` is an alias)
4. **Deploy Management**
   - Tracks deploy targets and runtime deployment metadata.
   - Each target carries the Requirement 059 per-service metadata contract
     (JUM-481): `serviceType`, `deployTarget`, `runtimeProtocol`,
     `databaseDriver`, `keyValueDriver`, `pm2Profile`, alongside name, region
     and runtime.
   - Additions are validated against the Requirement 059 deploy matrix read
     from the shared machine-readable source
     `src/model/deployCapabilityMatrix.js`: service-type × deploy-target
     combinations with no matrix row, protocols the service type does not
     expose, and PM2 profiles on serverless targets (or missing on
     PM2-managed targets) are rejected on the non-blocking status surface
     with the violated constraint named. Legacy targets persisted before this
     alignment migrate forward on load.

Detailed usage guide:

- [Domain Designer Features and Usage](./DOMAIN-DESIGNER-FEATURES-AND-USAGE.md)

## Run

PM2-served:

- `bun run dev:service-management`
- default dev profile (`bun run dev`) also starts `service-management` through PM2.

The app state persists in Cana (IndexedDB). JUM-484's one-way migration moved
the legacy browser `localStorage` payload across at boot — byte copy, same
pinned keys, no fallback to localStorage.

Recommended dev path:

1. `bun run dev:service-management`
2. Open the local Service Management URL
3. Model domains/entities
4. Run exports (OAS/AsyncAPI per-transport/gRPC proto/JSON Schema/package)
5. Use generated artifacts as contracts for API implementation

## Runtime Env API (built-in)

- `GET /api/runtime/env?environment=dev|development|staging|ci|test`
- `POST /api/runtime/env`
- `GET /api/runtime/pm2-ecosystem?environment=dev|development|staging|production|prod|ci|test`

The server persists approved runtime keys to files under `apps/backend-template/src/config/`.
The authoritative contract — accepted environments, key classification, enum
sets, write semantics — is
[Runtime Environment Contracts](./RUNTIME-ENVIRONMENT-CONTRACTS.md).

### What H1 makes trustworthy

- **Fixed env-file location.** The env files live in
  `apps/backend-template/src/config/` (overridable via
  `JUMENTIX_SERVICE_MANAGEMENT_CONFIG_DIR`); the server fails closed at boot
  when the directory is missing instead of silently serving defaults.
- **Real `environment` parameter.** Only `dev`, `development`, `staging`,
  `ci`, and `test` are accepted (case-insensitive after trimming); unknown
  values are explicitly rejected with the accepted list, never coerced to
  `dev`.
- **Classified key surface.** Every env key is exactly one of *editable*,
  *read-only*, or *never exposed* (secrets); the per-key classification
  decisions live in
  [Requirement 126](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md).
- **Protected endpoint.** Loopback bind by default, optional bearer token for
  mutations, and an audit log of every mutation.
- **Distinguishable errors.** Parse, validation, and filesystem failures are
  told apart in the error response (see below).

### Security posture

- Default bind is `127.0.0.1` (loopback only).
- Binding to all interfaces requires explicit opt-in via `JUMENTIX_SERVICE_MANAGEMENT_HOST=0.0.0.0`.
- Optional bearer token for mutating requests via `JUMENTIX_SERVICE_MANAGEMENT_AUTH_TOKEN`.
- Every mutation is logged with timestamp, environment, and changed keys (not values).

### Error contract

- Unknown environment: `400` whose `details` name the value and the accepted
  list, no file written.
- Missing config directory at boot: server exits with clear error.
- Missing environment file or other filesystem failure (permissions, full
  disk): `500 { "error": "Environment file operation failed.", "code": …,
  "path": …, "details": … }` — `code` is `ENV_FILE_NOT_FOUND` or the
  underlying `fs` error code, `path` the resolved env-file path (JUM-543).
- Malformed JSON payload: `400 { "error": "Invalid payload.", "details": … }`
  with the parse failure in `details` — told apart from filesystem failures,
  which surface as the 500 class above, never as a payload error.
- Unauthorized mutation: `401 { "error": "Unauthorized." }` when auth token is configured.

## Runtime Edit Flow

1. Select environment in Service Configuration.
2. Click `Load Environment` to read current values from env file.
3. Change runtime keys in the form.
4. Click `Save Environment` to persist values.
5. Restart PM2 profile if runtime change affects active processes.

## Notes

- Runtime env editor intentionally limits updates to approved keys (guardrail).
- Unsupported runtime combinations are blocked by startup validation at bootstrap.

## Container Templates

Service-level container templates are provided in:

- `apps/backend-template/docker/services/`

Orchestrated profiles:

- `apps/backend-template/docker-compose-service-templates.yml`

## Tests

Integration smoke:

```bash
bun run test:integration:service-management
```

Unit smoke for roadmap feature presence:

```bash
NODE_ENV=dev bun x jest apps/backend-template/test/unit/service-management/mvp.roadmap.features.test.ts --runInBand
```
