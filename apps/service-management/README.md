# Service Management Application

[![CircleCI](https://dl.circleci.com/status-badge/img/gh/XpertMinds/Jumentix/tree/dev.svg?style=svg)](https://dl.circleci.com/status-badge/redirect/gh/XpertMinds/Jumentix/tree/dev)
[![codecov](https://codecov.io/gh/XpertMinds/Jumentix/branch/dev/graph/badge.svg)](https://codecov.io/gh/XpertMinds/Jumentix)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=Jumentix&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=Jumentix)
[![Node](https://img.shields.io/badge/node-22.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-3.1-6BA539?logo=openapiinitiative&logoColor=white)](../../spec/1.0.0.yml)
[![AsyncAPI](https://img.shields.io/badge/AsyncAPI-3.0-9146FF)](../../spec)
[![License](https://img.shields.io/github/license/XpertMinds/Jumentix)](../../LICENSE.md)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=Jumentix&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=Jumentix)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=Jumentix&metric=bugs)](https://sonarcloud.io/summary/new_code?id=Jumentix)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=Jumentix&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=Jumentix)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
![Made in Brazil with Love](https://img.shields.io/badge/made%20in-%F0%9F%87%A7%F0%9F%87%B7%20Brazil%20with%E2%9D%A4%EF%B8%8F-blue)
[![#StandWithUkraine](https://raw.githubusercontent.com/vshymanskyy/StandWithUkraine/main/badges/StandWithUkraine.svg)](https://vshymanskyy.github.io/StandWithUkraine)
[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/XpertMinds/Jumentix)

`service-management` is a tabbed local application for engineering setup and design workflows in this boilerplate.

Detailed feature usage:

- [Domain Designer Features and Usage](../../documentation/md/DOMAIN-DESIGNER-FEATURES-AND-USAGE.md)
- [Module Architecture and IDesignerStore Port Contract](../../documentation/md/SERVICE-MANAGEMENT-MODULE-ARCHITECTURE.md)
- [Service Management Technical Documentation](./documentation/README.md)

## Tabs

1. **Domain Designer**
   - Full ER/domain modeling MVP.
   - Domain rectangles, entity modeling, relationship design, OpenAPI export/import, model checks.
   - Anchor-to-anchor relationship drag connectors on entity edges.
   - Domain bounded-context editor (including package dependencies and shared value-object metadata).
   - Relationship label position controls (offset editor + reset) and bend-point path controls.
   - Aggregate root + invariants editor with visual AR marker on entity cards.
   - Schema diff/migration preview with baseline snapshot support.
   - Validation severity filter and export quality gate (block on critical issues).
   - RBAC mapping editor by entity/action with tenant-scope flags.
   - Event/message contract designer (`event`, `command`, `request`, `response`) with payload schema metadata.
   - Entity templates: `crudAggregate`, `eventSourced`, `referenceData`, `tenantOwned`.
   - Code generation preview for domain model/repository/use-case/controller/handler skeletons.
   - Request/response example generator from entity schema.
   - Exporters: JSON, OpenAPI 3.1, Markdown, JSON Schema, AsyncAPI 3.0 per transport
     (`<version>.websocket.yml` / `<version>.grpc.yml`, canonical `spec/asyncapi/`
     conventions), gRPC proto (`async-api.proto`) and boilerplate bundle.
   - OpenAPI composition controls (`oneOf`, `allOf`, `anyOf`, external `$ref`, discriminator) per entity.
   - Domain package export/import for reusable model sharing.
   - Mini-map navigation and large-canvas performance mode.
2. **Communication Interface Designer**
   - Register inbound interface adapters (`HTTP/REST`, `gRPC`, `WebSocket`, `SSE`).
   - Track framework/runtime, entrypoint, and controller mapping.
3. **Service Configuration**
   - Configure service kind (`REST API`, `WebSocket API + REST API`, `gRPC API + REST API`),
   execution model, cloud provider, static assets profile, and runtime ports.
   - Includes PM2 runtime profile preview for VM deployments.
   - Includes runtime env editor for:
     - `JUMENTIX_HTTP_FRAMEWORK`
     - `JUMENTIX_REALTIME_API`
     - `JUMENTIX_REALTIME_API_PROTOCOL`
     - `JUMENTIX_REALTIME_API_DATABASE_DRIVER`
4. **Deploy Management**
   - Register deployment targets for VMs, dedicated servers, EC2, and function providers.

## Run

This application is served via PM2:

- `apps/service-management/server.js`

Commands:

- `pnpm run dev:service-management`
- `pnpm run dev` (auto-starts service management + REST profile)

## Static Serving

`server.js` serves this zero-build vanilla SPA from a boot-time manifest: an
allowlist of the files that existed when the process started. The manifest is a
traversal-safety mechanism — it bounds the servable surface even if path
normalisation has a flaw — so **production serves only the boot manifest** and
files added later require a restart.

In development this would be a defect (a hand-edited file added after boot
would 404 until restart), so dev mode re-scans the manifest **on miss only** —
never per request, which would turn every 404 into a directory walk — and the
retry passes the same normalisation and containment validation as a boot-time
hit.

Mode selection is explicit configuration, not inferred from `NODE_ENV` alone:

- `JUMENTIX_SERVICE_MANAGEMENT_STATIC_MANIFEST_REFRESH=on-miss` — re-scan on
  miss (dev behaviour), regardless of `NODE_ENV`.
- `JUMENTIX_SERVICE_MANAGEMENT_STATIC_MANIFEST_REFRESH=boot-only` — frozen boot
  manifest (production behaviour), regardless of `NODE_ENV`.
- Unset — default derives from `NODE_ENV`: `dev`/`development` => `on-miss`,
  anything else => `boot-only`.

## Runtime Env API

Built into `apps/service-management/server.js`:

- `GET /api/runtime/env?environment=dev|development|staging|ci|test`
- `POST /api/runtime/env`

The full contract (enum sets, write semantics, response hygiene) lives in
[Runtime Environment Contracts](../../documentation/md/RUNTIME-ENVIRONMENT-CONTRACTS.md).

### Editable Keys

- `JUMENTIX_HTTP_FRAMEWORK`
- `JUMENTIX_REALTIME_API`
- `JUMENTIX_REALTIME_API_PROTOCOL`
- `JUMENTIX_REALTIME_API_DATABASE_DRIVER`

Every env key belongs to exactly one of three tiers: *editable* (readable and
writable), *read-only* (visible in GET, never writable), and *never exposed*
(secrets — absent from GET and not writable). The authoritative per-key
classification is maintained in
[Requirement 126](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md).

### Environment Mapping

Env files live in `apps/backend-template/src/config/`:

- `dev` -> `apps/backend-template/src/config/.env.dev`
- `development` -> `apps/backend-template/src/config/.env.dev` (alias)
- `staging` -> `apps/backend-template/src/config/.env.staging`
- `ci` -> `apps/backend-template/src/config/.env.ci`
- `test` -> `apps/backend-template/src/config/.env.ci` (alias)

`environment` is a real parameter: comparison is case-insensitive after
trimming, unknown values are rejected with `400` and the accepted list (never
silently coerced to `dev`), and when omitted it defaults to `NODE_ENV` or
`dev`. The config directory can be overridden with
`JUMENTIX_SERVICE_MANAGEMENT_CONFIG_DIR`; the server exits at boot with an
error if the directory does not exist.

### Security Posture

- Default bind is `127.0.0.1` (loopback only); override with
  `JUMENTIX_SERVICE_MANAGEMENT_HOST`, port with
  `JUMENTIX_SERVICE_MANAGEMENT_PORT` (default `3200`).
- When `JUMENTIX_SERVICE_MANAGEMENT_AUTH_TOKEN` is set, `POST
  /api/runtime/env` requires `Authorization: Bearer <token>` and returns `401`
  otherwise; when unset, loopback-only operation is allowed without a token.
- Every mutation is logged with timestamp, environment, and changed keys (not
  values).

### Error Contract

- Unknown environment: `400` naming the value and the accepted list; no file
  written.
- Malformed JSON body: `400` with the parse failure in `details`.
- Missing env file: `400` with the resolved path in `details`.
- Missing/wrong bearer token: `401` (`{ "error": "Unauthorized." }`).
