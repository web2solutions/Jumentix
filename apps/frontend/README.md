# @jumentix/frontend

Jumentix frontend workspace app — seed for generated frontends: 100% offline (consuming backend controllers in-process), hybrid, or online (talking to Jumentix backends over HTTP/realtime contracts).

## Status

Seed copied from an external Vue 3 + Vite + CoreUI project. `src/` is intentionally empty — the app has not started yet.

## Layout

- `src/` — where the product code will live (empty on purpose).
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
bun run dev        # vite dev server (once src/ exists)
bun run build      # vite build
bun run lint       # eslint
```
