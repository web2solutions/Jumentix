# Requirement 136 - Frontend Knows the Backend Only Through Its OAS

## Context

Jumentix generates applications in three shapes: 100% offline (frontend
consuming backend controllers in-process through contracts), hybrid
(frontend + backend), and backend-only. The frontend workspace
(`apps/frontend`) started as a copied SPA seed; nothing in a copied codebase
stops a future change from importing `apps/backend-template` source directly
— a shortcut that couples the two deployables and turns every backend
refactor into a frontend incident.

The backend already publishes its contract surface without exposing code:
when it runs, it serves Swagger UI, and the OpenAPI specification behind it
is available as a JSON document (the runtime representation the UI renders)
or as the versioned YAML spec file. That document is the whole interface a
frontend may know.

## Mandatory Rules

1. **Frontend applications never read backend source code.** No import, no
   type-only import, no path alias, no monorepo shortcut from
   `apps/frontend/**` into `apps/backend-template/**` or any backend-only
   implementation. If a type is needed on the frontend, it comes from a
   published client package or is generated from the spec — never from
   backend source.
2. **The OAS document is the only backend reference.** Frontends integrate
   against the OpenAPI specification: the JSON representation served at
   runtime by the running backend's Swagger UI, or the versioned YAML spec
   file. Behaviour not described by the spec does not exist for the
   frontend.
3. **Workspace client packages and generated SDKs are allowed.** Packages
   published from `packages/**` (for example `@jumentix/cana`,
   `@jumentix/sdk-rest-client`) and SDKs generated from the OAS spec are
   clients and contracts, not backend code. Consuming them is the sanctioned
   path, including for realtime transports whose contracts are published the
   same way.
4. **Offline and hybrid apps follow the same boundary.** A 100% offline app
   consumes the contracts as data — generated clients, adapters, and local
   persistence wired to the same vocabulary. "Runs in the same process" is
   never a license to import backend internals.

## Acceptance Criteria

1. No file under `apps/frontend/**` imports from `apps/backend-template/**`;
   `bun run arch:check-workspace-boundaries` stays green with the frontend
   workspace present.
2. Frontend integration code references the OAS document (runtime JSON or
   versioned YAML) or an SDK generated from it; hand-written payload shapes
   duplicating backend internals do not appear in `apps/frontend/src/**`.
3. The principle is stated where frontend work is guided: the requirement
   index, `apps/frontend/README.md`, and the workspace agent instructions.

## Evidence and Scope

- Machine-verifiable boundary: `arch:check-workspace-boundaries` and the
  workspace boundary checks in `ci:gate` run with `apps/frontend` present.
- Stated in `apps/frontend/README.md`, `apps/frontend/AGENTS.md` and
  `apps/frontend/CLAUDE.md` (JUM-758).
- The contract surface the frontend consumes grew vendor extensions it renders
  from (`x-label`, `x-list-capabilities`, `x-references` on arrays) and the
  frontend proves it with unit, component (`@vue/test-utils` under bun:test) and
  Docker-backed Cypress suites — `documentation/md/FRONTEND-SEED-AND-XCRUD.md`,
  `documentation/md/PAGINATED-LIST-CONTRACT.md` (JUM-776, JUM-777, JUM-778, JUM-780).
- The backend side of the contract surface — Swagger UI and the route/spec
  parity gate (`oas:check-routes`) — already exists; this requirement binds
  the frontend to consume only that surface.
- Complements the contract-first requirements that govern the backend
  template and the generated SDK packages.
