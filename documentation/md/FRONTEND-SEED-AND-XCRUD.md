# Frontend Seed and the X-CRUD Kit

Linear epic: `[EPIC][Frontend] Frontend seed and X-CRUD kit hardening` (JUM-774…778, 780, 781, 782).
Requirements `112`, `115`, `117`, `118`, `134`, `135`, `136`.

A versão em português está em [FRONTEND-SEED-AND-XCRUD.pt-BR.md](./FRONTEND-SEED-AND-XCRUD.pt-BR.md).

## What it is

`apps/frontend` (`@jumentix/frontend`) is the **seed for frontends the Jumentix factory
generates** — the *Hybrid Backend + Frontend* and *Frontend-only SPA/PWA* modes of the
[Service Factory Capabilities Matrix](./JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX.md). It is
to frontends what `apps/backend-template` is to backends: a working product over the Users /
Organizations domain that shows the pattern any generated domain follows.

The rule that shapes everything (Requirement `136`): **the frontend knows the backend only through
its OpenAPI document.** `scripts/sync-contracts.mjs` bakes `spec/1.0.0.yml` into
`src/contracts/openapi.json`; the SDK (`@jumentix/sdk-rest-client`) is the only HTTP channel; no
file under `src/` imports backend code.

## Contract-driven rendering

| OAS surface | Frontend module | Renders |
| --- | --- | --- |
| `components.schemas.*.properties` (+ `allOf`, `$ref`) | `contracts/formSchema.ts` | one `FieldDescriptor` per property: forms, grid columns, filters |
| `x-label` (`{ en, pt-BR }`) → `title` → humanized name | `contracts/labels.ts` | every caption; `description` is help text under the control |
| `x-hide` | `formSchema.ts` | property stays in the contract, never renders |
| `x-relation` (`entity`, `match`, `display`, `kind`) | `XCrudReferenceInput`, `useXCrud.loadReferences` | FK selects that show the label and emit the id; list op is `<Entity>ArrayOf`; arrays of ids (members) resolved the same way |
| `x-validation` | `contracts/validation.ts` | masks/checksums (CPF, SSN, phones) before any HTTP |
| `x-list-capabilities` | `contracts/listSchema.ts` | server-side paging/sort/filter/search (see below) |
| `info.x-rbac` + per-operation `security` | `contracts/rbac.ts`, router guards, `modules/nav.ts` | which routes, nav items and buttons a role sees |

Operation ids the shell needs (login, register, logout, profile) live in
`contracts/appOperations.ts` and are validated at boot: a generated app with renamed operations
fails loudly instead of rendering an empty, permission-less UI. Sub-apps declare their own ids in
their `XCrudEntityConfig`.

Session expiry (JUM-783, merged alongside this epic): `contracts/sessionGuard.ts` subscribes to
the SDK event stream — a 401 on any operation other than the configured `auth.login` /
`auth.register` expires the session, resets the cached profile and lands on `/login` from any
page; the router guard and a 30 s timer in `DefaultLayout` catch a JWT whose `exp` already passed.

## X-CRUD: server-side data (JUM-778)

The kit chooses its data mode from the contract, never from component config:

- **Server mode** — the list operation declares `x-list-capabilities`. Each search / filter /
  sort / page change is one request on the [paginated list contract](./PAGINATED-LIST-CONTRACT.md)
  (`page`, `size`, `sort`, `q`, base64 `filter`), and the grid shows exactly the page returned in
  `{ result, page, size, total }`. Sort arrows, the filter row and the search box render only for
  the fields the contract declares. Typed input is debounced (`debounceMs`, default 250 ms). A
  page past the last one (400 after a delete on a stale total) steps back one page. Aggregates:
  `count` without `groupBy` uses the server `total`; the others are computed over the loaded
  page and say so ("(this page)").
- **Memory mode** — no capabilities: the whole list is loaded once and the same controls run in
  memory (operations that predate JUM-777).

Grid affordances (JUM-781): actions column sticky at the right edge, `Filters` toolbar button
with the active count, stacked date-range filters, enum/boolean selects, reference labels instead
of uuids, locale-formatted timestamps, `id` hidden by default (Columns menu restores it).

## i18n and labels (JUM-780)

`src/i18n` holds one flat message table per locale (`en`, `pt-BR`), `t(key, params)` and
`localized(value)` for config captions (`title`, aggregate `label`, quick-filter `allLabel` accept
`{ en, 'pt-BR' }`). The locale is detected from the browser, switchable from the account menu and
persisted in `localStorage`. Field labels are **not** messages: they come from the contract
(`x-label`), so a generated domain needs no message entry per field. A unit test pins that both
locales declare the same keys.

## Testing (JUM-776)

- `bun run test` — `test/unit` (contract engine, stores, router) + `test/component`
  (`@vue/test-utils` + happy-dom mounting the shipped `.vue` components; `test/setup/vue-sfc.ts`
  is a Bun plugin that compiles SFCs with `@vue/compiler-sfc`, registered through the app's
  `bunfig.toml`). Chart.js is stubbed — it needs a real canvas — and says so in the harness.
- `bun run test:coverage` + `bun run frontend:coverage:check` (root) — bun lcov over `src/`
  gated by `ci-cd/check-frontend-coverage.js` on lines and functions; untouched sources count at
  zero; branches are reported as *unmeasured* because Bun emits no branch records (Requirement
  `110` §2). The gate runs inside `ci:gate`; the lcov feeds Sonar.
- `bun run test:e2e` — `scripts/run-e2e.mjs` builds and starts the real Express REST API in Docker
  (`e2e/docker-compose.yml`, `oven/bun` image from the monorepo root, InMemory, seeded), starts
  Vite with `/api` proxied to it, runs Cypress (Chrome headless by default —
  `FRONTEND_E2E_BROWSER` overrides; Cypress' bundled Electron segfaults on macOS typing into the
  password/datalist inputs) and tears everything down. No Docker → non-zero exit (Requirement `118`).
- `test-map.json` registers every suite; the `frontend` layer depends on the `contracts` layer,
  so a change to `spec/1.0.0.yml` or the REST SDK selects the frontend suites.

## Running

```sh
bun install                                   # monorepo root
bun run dev                                   # :3001, proxy /api → :3010
VITE_DEV_PORT=3021 VITE_API_PROXY_TARGET=http://localhost:3020 bun run dev   # other ports
bun run test && bun run typecheck && bun run lint && bun run build && bun run test:e2e
```

Seeded accounts: `eduardo@xpertminds.dev` / `eduardo@123456` (superadmin),
`admin@xpertminds.dev` / `admin@123456` (admin), `user@xpertminds.dev` / `user@123456` (user).

## Modules

A generated domain ships one `ModuleManifest` (`src/modules/manifest.ts`): `id`, localizable `title`, `icon`, `entities[]` (each with an `XCrudEntityConfig` and a `load()` chunk) and a mandatory `dashboard.load()`. `src/modules/index.ts` registers the Users module (entities `users` and `organizations` plus the existing `DashboardView`). `validateModules()` runs at boot and throws listing every operationId missing from the bundled OAS.

The navigation menu is generated from the registry (`src/modules/nav.ts`). Routes are `/m/:moduleId/:tab?`. `/users`, `/organizations` and `/dashboard` redirect into the Users module.

## Multitask

The shell is login-gated: `DefaultLayout` never mounts (and module `load()` never runs) before authentication. `src/stores/tasks.ts` keeps **one task instance per module**. `open(moduleId)` activates an already-open task. Closing the active task activates the previous one. The open list and active id persist in `sessionStorage`; X-CRUD form state does not — it survives because every open module stays mounted and is shown with `v-show` (`DefaultLayout.vue`).

`AppTaskbar.vue` is the full-width bottom bar: one button per task (icon, title, close), keyboard arrows / Enter / Delete, overflow menu, compact icons below `md`, bottom-sheet switcher on `xs`. The URL deep-links the active task (`#/m/users/users`).

```
┌────────────┬──────────────────────────────┐
│            │         main toolbar         │
│   menu     ├──────────────────────────────┤
│ navegação  │      lazy load modules       │
│            │                              │
├────────────┴──────────────────────────────┤
│                  taskbar                  │
└───────────────────────────────────────────┘
```

A module is a tabbed layout (`ModuleLayout.vue`): one tab per entity the role may list, **Dashboard always last**. Tab state is part of the task (kept alive with `v-show`). The user role sees `Users | Dashboard` and not Organizations.

## Toolbar widgets

`src/shell/toolbarWidgets.ts` is the contract: `{ id, component, placement: 'left' | 'right', order, requiredScopes?, moduleId? }`. Shell registers account, locale, network activity, plus reserved empty slots `notifications` and `online-offline` for later epics. A module may contribute widgets while its task is active (`manifest.toolbarWidgets` / `moduleId` on the widget). `AppHeader.vue` renders the registry; below `md` non-account widgets collapse into an overflow menu.

## Responsive

Breakpoint tokens live in `src/styles/breakpoints.scss` and `src/shell/breakpoints.ts` (CoreUI/Bootstrap: xs <576, sm ≥576, md ≥768, lg ≥992, xl ≥1200, xxl ≥1400). Menu: CoreUI offcanvas below `lg`. Taskbar compact below `md`, sheet switcher on `xs`. Module tabs scroll horizontally. Touch targets are ≥ 44 px (`.app-taskbar__touch`). Cypress `shell-responsive.cy.ts` asserts `document.documentElement.scrollWidth <= window.innerWidth` at 375×812, 768×1024 and 1280×800.

## Related

- [Paginated List Contract](./PAGINATED-LIST-CONTRACT.md)
- [Creating SPA/PWA with Jumentix](../../apps/service-management/documentation/guides/CREATING-SPA-PWA-WITH-JUMENTIX.md)
- `apps/frontend/AGENTS.md` — rules for agents working in the workspace
- `.agents/requirements/software/136-frontend-knows-backend-only-through-oas.md`
