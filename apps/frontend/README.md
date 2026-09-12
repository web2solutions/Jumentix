# @jumentix/frontend

Jumentix frontend workspace app — seed for generated frontends: 100% offline (consuming backend controllers in-process), hybrid, or online (talking to Jumentix backends over HTTP/realtime contracts).

## Status

The product is live in `src/`: an OAS-driven enterprise admin SPA (Vue 3 + Vite + CoreUI + Pinia) with authentication, profile management, RBAC and the generic **X-CRUD** kit powering the Users and Organizations sub-apps. Everything renders from the bundled OpenAPI contract at runtime — no field, column, filter or permission is hardcoded.

Current surface:

- **Auth**: login/register built from `RequestLogin`/`RequestRegister` (`x-hide` keeps `schemaType` out of the form). Unauthenticated users redirect to `/login`; scope-guarded routes (`meta.operationId`) enforce the OAS security scopes.
- **Profile**: scalars + emails/documents/phones with masks, checksums and country rules from the OAS `x-validation` blocks (CPF mod-11, SSN, BR/US phones…).
- **Users Domain**: X-CRUD **Users** and **Organizations** — listing (sortable, per-column filters, selection, bulk delete, export JSON, pager or scroll), row detail card with one tab per array field, create/update/preview forms, aggregate widgets + chart.
- **RBAC from the contract**: the UI reads `info.x-rbac` + per-operation `security` from the bundled spec (`contracts/rbac.ts`); nav, tabs and buttons reflect the role. Only superadmins manage multiple organizations.
- **NetworkActivity** widget in the header, fed by `@jumentix/sdk-rest-client` request lifecycle events.

Seeded dev data (backend): organization **XpertMinds**; `eduardo@xpertminds.dev` (superadmin), `admin@xpertminds.dev`, `user@xpertminds.dev`.

## Layout

- `src/` — the product.
  - `contracts/` — OAS runtime engine: `openapi.json` (bundled spec), `formSchema` (field descriptors), `oasForm` (collect/validate), `validation` (masks/checksums), `rbac`, `apiClient` (SDK singleton), `errors`.
  - `components/x-crud/` — the generic X-CRUD kit (`XCrud` shell, grid, toolbar, filters, row detail, forms, array editor, reference input, panels, chart, `useXCrud`).
  - `features/` — `auth`, `dashboard`, `profile`, `users`, `organizations`.
  - `stores/`, `router/`, `layouts/`, `_nav.ts` (RBAC-filtered nav).
- `template/` — frozen, fully working CoreUI Vue 3 + TypeScript reference app (`layouts/`, `components/`, `features/`, `router/`, Pinia stores, `vue-tsc` toolchain, `ARCHITECTURE.md`). It is the visual/architectural catalog for generated frontends — reference only, never imported into `src/`.

## Contract boundary (requirement 136)

Frontend applications never read backend source code. The only backend reference a
frontend may know is the **OpenAPI documentation**: the JSON representation served at
runtime by the running backend's Swagger UI, or the versioned YAML spec file.

Allowed integrations:

- The OAS document (runtime JSON or versioned YAML) and SDKs generated from it.
- Public workspace packages from `packages/**` (e.g. `@jumentix/cana`,
  `@jumentix/sdk-rest-client`) — they are clients/contracts, not backend code.

Forbidden: importing from `apps/backend-template/**` or any backend implementation,
including type-only imports. Offline and hybrid apps follow the same rule — contracts
are consumed as data, never as imported code.

See `.agents/requirements/software/136-frontend-knows-backend-only-through-oas.md`.

## Tooling

This workspace follows the monorepo's Bun toolchain (pinned in `/.bun-version`). There is no npm lockfile here — dependencies resolve through the root `bun.lock` (`apps/*` workspace glob).

```sh
bun install        # from the monorepo root
bun run dev        # vite dev server (syncs the bundled OAS first via predev)
bun run build      # vite build
bun run lint       # eslint
bun run typecheck  # vue-tsc --noEmit
bun run test       # bun test test/unit
```

Dev integration: `bun run dev` serves on `:3001` and proxies `/api` to the standalone backend instance (`JUMENTIX_HTTP_PORT`, `:3010` in this workspace's pm2 setup). Icons must be registered by name in `app.provide('icons', …)` in `src/main.ts` — see `AGENTS.md` §10 for the full consolidated requirement set.
