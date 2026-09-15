# @jumentix/frontend

Seed for the frontends the Jumentix factory generates — the *Hybrid Backend + Frontend* and
*Frontend-only SPA/PWA* modes of the service factory matrix. An OAS-driven enterprise admin SPA
(Vue 3 + Vite + CoreUI + Pinia) over the Users / Organizations domain of `apps/backend-template`.

A versão em português está em [README.pt-BR.md](./README.pt-BR.md).
Full technical description: [Frontend Seed and the X-CRUD Kit](../../documentation/md/FRONTEND-SEED-AND-XCRUD.md).

## Contract boundary (Requirement 136)

The frontend knows the backend **only through its OpenAPI document**. `scripts/sync-contracts.mjs`
bakes `spec/1.0.0.yml` into `src/contracts/openapi.json` (`predev`/`prebuild`); the SDK
`@jumentix/sdk-rest-client` is the only HTTP channel. Importing from `apps/backend-template/**`
— even type-only — is forbidden and caught by `arch:check-workspace-boundaries`.

## What renders from the contract

- **Forms** from `components.schemas` (`type`, `format`, `required`, lengths, `enum`, `pattern`,
  `default`, `nullable`); `x-hide` keeps a property out of every form.
- **Labels** from `x-label` (`{ en, 'pt-BR' }`) → `title` → humanized name; `description` is help
  text under the control.
- **Validation** from `x-validation` (CPF mod-11, SSN, BR/US phones, pattern caps) before any HTTP.
- **References** from `x-references`: selects show the referenced label and emit the id; arrays
  of ids (organization members) resolve to labels too.
- **RBAC** from `info.x-rbac` + per-operation `security`: routes, nav items and buttons follow the
  signed-in roles; the backend enforces.
- **Lists** from `x-list-capabilities`: the X-CRUD kit asks the server for pages
  ([Paginated List Contract](../../documentation/md/PAGINATED-LIST-CONTRACT.md)) and renders sort,
  filter and search only for the declared fields; without the extension it falls back to memory.

## Surface

- **Auth** — login/register built from `RequestLogin`/`RequestRegister`; unauthenticated users go
  to `/login`; scope-guarded routes (`meta.operationId`); a rejected session drops to `/login`.
- **Dashboard** — real totals from the list envelopes and the signed-in roles/organization; an
  honest "no access" for roles without read scope.
- **Users / Organizations** — X-CRUD sub-apps: server-side listing (search, per-column filters,
  sort, pager or scroll), row detail with one tab per array field, create/update/preview forms
  with array editors, bulk delete, export, column visibility, aggregates.
- **Profile** — scalars, emails, documents, phones from the OAS sub-resource schemas.
- **i18n** — `en` and `pt-BR`, switchable from the account menu, persisted per browser.

## Layout

```text
src/contracts/   OAS engine: formSchema, oasForm, validation, labels, listSchema, rbac,
                 apiClient, appOperations, errors, openapi.json (generated)
src/components/  OasFormField, SearchableEnumInput, x-crud/* (XCrud, grid, toolbar, forms,
                 row detail, array editor, reference input, panels, chart, useXCrud)
src/features/    auth, dashboard, profile, users, organizations
src/stores/      auth, profile, network, entityStore, sidebar, theme
src/i18n/        messages (en, pt-BR), t(), localized(), useI18n()
template/        frozen CoreUI catalog — reference only, never imported
test/unit        bun:test — contract engine, stores, router, kit state
test/component   @vue/test-utils + happy-dom mounting the shipped .vue components
cypress/e2e      Cypress against the containerised backend (e2e/docker-compose.yml)
```

## Commands

```sh
bun install                 # from the monorepo root
bun run dev                 # vite on :3001, /api proxied to :3010
                            # VITE_DEV_PORT / VITE_API_PROXY_TARGET override both
bun run build               # vite build
bun run test                # unit + component suites
bun run test:coverage       # writes coverage/frontend/lcov.info (root: frontend:coverage:check)
bun run test:e2e            # Docker backend + Vite + Cypress (Chrome headless by default)
bun run typecheck && bun run lint
```

Seeded dev accounts: `eduardo@xpertminds.dev` / `eduardo@123456` (superadmin),
`admin@xpertminds.dev` / `admin@123456`, `user@xpertminds.dev` / `user@123456`.

Agent rules for this workspace: [AGENTS.md](./AGENTS.md).
