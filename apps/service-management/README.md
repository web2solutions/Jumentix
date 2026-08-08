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
- [Contract Parity Guarantees](../../documentation/md/SERVICE-MANAGEMENT-CONTRACT-PARITY.md)
- [Operations Console](../../documentation/md/SERVICE-MANAGEMENT-OPERATIONS-CONSOLE.md)
- [Design System and PWA Shell](../../documentation/md/SERVICE-MANAGEMENT-DESIGN-SYSTEM-PWA.md)
- [Cana Adoption, Migration and Offline Behaviour](../../documentation/md/SERVICE-MANAGEMENT-CANA-ADOPTION.md)
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
   - RBAC mapping editor by entity/action, aligned to the tenant RBAC authorization contract (normalized roles; tenant scope derived from roles).
   - Event/message contract designer (`event`, `command`, `request`, `response`) with payload schema metadata.
   - Entity templates: `crudAggregate`, `eventSourced`, `referenceData`, `tenantOwned`.
   - Code generation preview for domain model/repository/use-case/controller/handler skeletons.
   - Request/response example generator from entity schema.
   - Exporters: JSON, OpenAPI 3.1, Markdown, JSON Schema, AsyncAPI 3.0 per transport
     (`<version>.websocket.yml` / `<version>.grpc.yml`, canonical `spec/asyncapi/`
     conventions), gRPC proto (`async-api.proto`) and boilerplate bundle.
   - The JSON export is the versioned full-suite document (JUM-547): it carries all
     four tabs (`domains`/`relationships`, `interfaces`, `serviceConfiguration`,
     `deployments`) plus the runtime-environment selection — never its values — and
     Import JSON restores them, accepting pre-JUM-547 domain-only files and refusing
     unknown sections or newer major versions clearly.
   - OpenAPI composition controls (`oneOf`, `allOf`, `anyOf`, external `$ref`, discriminator) per entity.
   - Domain package export/import for reusable model sharing.
   - Mini-map navigation and large-canvas performance mode.
2. **Communication Interface Designer**
   - Register inbound interface adapters (`HTTP/REST`, `gRPC`, `WebSocket`, `SSE`).
   - Track framework/runtime, entrypoint, and controller mapping.
3. **Service Configuration**
   - Configure service kind (`REST API`, `WebSocket API + REST API`, `gRPC API + REST API`),
   execution model, cloud provider, static assets profile, and runtime ports.
   - Saves are validated (JUM-544): ports must be integers in 1–65535 and unique across the
   protocols the selected service kind actually binds, and the run-mode × cloud-provider
   combination must exist in the Requirement 059 deploy matrix (read from the shared
   machine-readable source `src/model/deployCapabilityMatrix.js`). Invalid profiles are
   reported on the tab's status surface and are not saved.
   - PM2 runtime profile preview for VM deployments reads the real
     `pm2/ecosystem.*.cjs` files through `GET /api/runtime/pm2-ecosystem`
     (JUM-480): the process list and the suggested `pm2 start` command derive
     from the selected preview environment's ecosystem file — no process list
     or package-manager invocation is hardcoded, so an ecosystem edit (or the
     Bun cutover's invocation-format change) is reflected without a designer
     change. Environments without an ecosystem file render an explicit empty
     state, never a silently blank preview.
   - Multi-environment runtime env editor (JUM-480): the Environment selector
     loads the chosen environment's values, the panel names the exact env file
     the next save writes, and the save response confirms the file written.
   - Includes runtime env editor for:
     - `JUMENTIX_HTTP_FRAMEWORK`
     - `JUMENTIX_REALTIME_API`
     - `JUMENTIX_REALTIME_API_PROTOCOL`
     - `JUMENTIX_REALTIME_API_DATABASE_DRIVER`
4. **Deploy Management**
   - Register deployment targets for VMs, dedicated servers, EC2, and function providers.
   - Each target carries the Requirement 059 per-service metadata (JUM-481):
     `serviceType`, `deployTarget`, `runtimeProtocol`, `databaseDriver`,
     `keyValueDriver` and `pm2Profile`. Additions are validated against the
     deploy matrix read from the shared machine-readable source
     `src/model/deployCapabilityMatrix.js` — combinations with no matrix row,
     protocols the service type does not expose, and PM2 profiles on
     serverless targets are rejected on the status surface with the
     constraint named. Targets persisted before this alignment migrate
     forward on load.

## Design System and Accessibility

The designer adopts the Jumentix design system at the token layer (JUM-488) —
it is a zero-build vanilla SPA, so adoption means shared tokens and idioms,
not React component imports:

- `tokens.css` — vendored copy of the shared `--jtx-*` custom properties
  (source of truth: `apps/jumentix-website/components/design-system/tokens.css`):
  color ramps, surfaces, lines, radii, shadows, the spacing scale, motion, and
  the Inter/IBM Plex Mono typography stacks. Token changes land in the website
  file first and are mirrored here.
- `styles.css` — every cosmetic value (color, typography, radius, shadow,
  spacing) resolves to a `--jtx-*` token. Only structural geometry the canvas
  math depends on stays literal (3200×2200 canvas, 24px grid, 520px domains,
  190px entities — pinned by `src/model/modelQueries.js` and its unit suite),
  plus the compact inspector density. Element-level rules are scoped under
  `.service-management-shell` so the stylesheet can be embedded in the website
  Storybook without leaking.
- Storybook coverage lives in the website workspace
  (`apps/jumentix-website/components/service-management-designer/`), mounting
  the designer's real markup and stylesheets; the manifest smoke check
  requires those stories.

Accessibility semantics layered onto the same markup: WAI-ARIA tablist with
roving tabindex and Arrow/Home/End navigation (`src/ui/tabs.js`), `aria-pressed`
on the view toggles (synced by `src/ui/canvas.js`), accessible names on every
control, a live-region selection status, a skip link to the canvas workspace,
and Space restored to native button activation. The canvas keyboard path is
structural: select entities from the sidebar lists, move the selection with
the arrow keys (Shift for larger steps), delete with Delete/Backspace.

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

## PWA Shell

The designer is an installable PWA (JUM-489). The shell is:

- `manifest.webmanifest` — name, icons (`icons/`), theme, `standalone`
  display, start URL/scope `./`. Served as `application/manifest+json`.
- `sw.js` — the app-shell service worker. A CLASSIC script (not a module),
  served from the app root so its scope is the whole app.
- `src/pwa/pwaShell.js` — page-side registration, the update prompt and the
  recovery path, wired by a small inline module in `index.html` (deliberately
  outside `script.js`: the shell never reorders the designer boot).

### Caching strategy

The worker precaches the SHELL ONLY — HTML, CSS, the JS module graph, the
manifest and icons — under a VERSIONED cache name
(`service-management-shell@<SHELL_VERSION>`), and serves those entries
cache-first. `SHELL_VERSION` (in `sw.js`) is bumped on every shell change, so
a shipped update never mutates the cache the running version serves from, and
`activate` deletes every stale `service-management-shell@*` cache.

Application data is NEVER cached here: `/api/` responses, non-GET and
cross-origin requests pass straight to the network, and offline they fail
naturally. Persistence belongs to Cana (JUM-483/484 — no fallback); a
convenience copy in the Cache API would be a fallback by the back door.

The precache list and the server's static manifest must agree about what the
shell is (JUM-463): the unit suite asserts every precached entry exists on
disk, and the browser smoke requests every entry against the real server.

### Update flow

A cache-first shell is a cache with no expiry that the user cannot see — so
the update path is the substance, not an afterthought:

1. A shipped update (a changed `sw.js`) installs and WAITS; the running shell
   keeps serving. There is no silent swap mid-edit.
2. The page shows a banner: "A new version of Service Management is
   available." — with "Reload to update", "Later" and "Reset app shell".
3. Only on "Reload to update" does the page post `SKIP_WAITING`; the waiting
   worker activates, deletes stale caches, claims clients, and the page
   reloads on `controllerchange`. "Later" defers: the waiting worker is still
   there on the next load, and the prompt returns.

### Offline scope and the storage boundary

With the network disabled the SHELL loads and stays interactive — that is the
whole offline contract. Data availability is Cana's domain, not the shell's:
the shell never masks an evicted database as a first run, and it never
presents cached data of its own.

The service worker cache and the Cana database are DIFFERENT storage, but the
browser's "clear site data" removes BOTH. The shell's presence never implies
designer data is safe. The "Reset app shell" action is the recovery path that
requires no service-worker knowledge: it unregisters the worker, deletes ONLY
the `service-management-shell@*` caches and reloads — Cana data is untouched.

### PWA tests

- Unit: `apps/backend-template/test/unit/service-management/pwaShell.test.ts`
  (worker handlers, update flow, recovery — with injected fakes).
- Browser smoke:
  `apps/backend-template/test/integration/ServiceManagement/pwaShell.browser.integration.test.ts`
  (manifest/worker content types, precache↔static-manifest agreement,
  registration, offline shell load with the server down, the full update
  flow with stale-cache cleanup).

## Runtime Env API

Built into `apps/service-management/server.js`:

- `GET /api/runtime/env?environment=dev|development|staging|ci|test`
- `POST /api/runtime/env`
- `GET /api/runtime/pm2-ecosystem?environment=dev|development|staging|production|prod|ci|test`
  (read-only; the PM2 preview's source — reports the apps of the selected
  environment's real `pm2/ecosystem.*.cjs` file with per-app `pm2 start`
  commands derived from the ecosystem definition, an explicit
  `exists: false` state when the file is absent, and the honest 500 envelope
  when the file is unreadable or broken)

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
