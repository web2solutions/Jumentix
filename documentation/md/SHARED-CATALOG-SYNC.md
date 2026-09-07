# Shared Catalog Sync (JUM-491)

> Multi-user shared catalog of domain designs: a contract-first backend module
> (OAS + mediator events) as the synchronization target, optimistic concurrency
> per catalog record, and convergence driven by Cana's resync rule — document
> read-back, never replay.

This document is the English reference. A versão em português está em
[SHARED-CATALOG-SYNC.pt-BR.md](./SHARED-CATALOG-SYNC.pt-BR.md).

## What changed and why

Everything before JUM-491 treats the designer as a **single-browser tool**:
Cana persists the designer document in the browser's IndexedDB, and JUM-485
synchronizes it across that browser's tabs. JUM-491 turns the designer into a
**multi-user system**: a team shares one catalog of domain designs through the
backend, so a user's work also lives on different hardware — the only
continuous second copy in the product (export is manual).

Two honest boundaries, stated up front:

- **A sync target is not a backup.** It propagates deletions; it does not
  replace JUM-560 (storage quota/eviction) or JUM-415 (offline conflicts and
  durability policy).
- **Cana still has no fallback.** When the catalog is unreachable, the client
  declares it (status surface, `degraded`) and keeps saving locally to Cana —
  it never silently degrades into a hidden single-user mode, because there is
  no fallback store.

## Architecture

```
Designer A (browser)                Backend (backend-template)              Designer B (browser)
┌───────────────────────┐          ┌────────────────────────────┐          ┌───────────────────────┐
│ Cana (IndexedDB)      │          │ Catalogs module (hexagonal)│          │ Cana (IndexedDB)      │
│  └ CanaDesignerStore  │          │  ├ OAS spec/1.0.0.yml      │          │  └ CanaDesignerStore  │
│  └ designerSync (tabs)│          │  ├ CatalogController       │          │  └ designerSync (tabs)│
│  └ catalogSyncClient ─┼── HTTP ─▶│  ├ CatalogUseCases/Service │◀── HTTP ─┼─ catalogSyncClient    │
│    poll: read-back    │          │  ├ CatalogDataRepository   │          │    poll: read-back    │
│    push: on commits   │          │  └ mediator publish ───────┼── events │                       │
└───────────────────────┘          └────────────────────────────┘          └───────────────────────┘
```

### Backend: the `Catalogs` module

`apps/backend-template/src/modules/Catalogs/` follows the repository's
hexagonal module structure (Reqs 015/016/036), mirroring the Users reference
module:

- **Domain** — `domain/Entity/ICatalog.ts` (the record), `domain/Model/Catalog.ts`
  (the aggregate: version bump, tombstone, restore),
  `domain/security/CatalogAuthorizationPolicy.ts` (pure TENANT-RBAC decisions).
- **Application** — `application/ports/ICatalogUseCases.ts`,
  `application/use-cases/CatalogUseCases.ts`; `features/*` are thin pure
  functions over the repository port.
- **Adapters** — `adapters/in/http/controllers/CatalogController.ts`
  (`@Authorize()` + OAS validation + tenant policy before every use case);
  `adapters/out/persistence/CatalogDataRepository.ts` (the
  optimistic-concurrency enforcement point).
- **Interface** — `interface/restapi/frameworks/{express,fastify,restify}/handlers/*`
  (six operations), DTOs under `interface/dto/`.
- **Composition** — `composition/composeCatalogsServices.ts`, wired in
  `RestAPI.composeCatalogsModule()` exactly like the Users module; the
  in-memory driver registers `CatalogStoreAPI` in `InMemoryDbClient`.

### OAS contract

`spec/1.0.0.yml` (contract-first; `bun run oas:check-routes` enforces it):

| Operation | Path | Scope | Concurrency |
|---|---|---|---|
| `getAll` | `GET /catalogs` | `read_catalog` | `includeDeleted=true` returns tombstones |
| `create` | `POST /catalogs` | `create_catalog` | server assigns `version: 1` |
| `getOneById` | `GET /catalogs/{id}` | `read_catalog` | — |
| `update` | `PUT /catalogs/{id}` | `update_catalog` | body `version` required; stale → 409 |
| `deleteOne` | `DELETE /catalogs/{id}?version=` | `delete_catalog` | soft delete (tombstone); stale → 409 |
| `restore` | `POST /catalogs/{id}/restore` | `update_catalog` | recovers a tombstone; stale → 409 |

### Authorization (TENANT-RBAC)

Server-side, two layers, and a client cannot grant itself access:

1. **Scope matrix** (`Users/domain/security/Rbac.ts`): `admin` gains
   `read/create/update/delete_catalog`; `user` gains
   `read/create/update_catalog` (team members edit the shared catalog; only
   admins delete); `superadmin` keeps `*`; legacy direct-scope principals
   hold no catalog scope and are denied.
2. **Tenant policy** (`CatalogAuthorizationPolicy`): the catalog is shared
   exactly inside one organization. Tenant principals require an organization,
   are bound to it on create, and cross-organization reads/writes are denied
   with the contract's fixed messages.

### Events

Every successful write publishes on the message mediator
(`packages/message-mediator`; the in-memory adapter in tests, the broker
adapters in deployments that enable them):

- `catalogs.catalog.created | updated | deleted | restored` with payload
  `{ id, organization, version, actor }` — the version is the same
  concurrency token the API enforces, so consumers reconcile against one
  number. Event publication never breaks the primary write.

## The optimistic-concurrency model

- **Unit of concurrency: the catalog record** — one shared domain design.
  Per-record is the right grain for a team (no global catalog lock), and a
  relationship spanning two entities always lives inside the same record, so
  no consistent version check is ever impossible.
- **Token: `version`** (the etag). Create starts at 1; every write bumps it;
  every mutation requires the caller's expected version.
- **Stale write: rejected, reviewably.** The 409 `ConflictError` metadata
  carries `catalogId`, `expectedVersion`, `currentVersion` **and the current
  record** — the loser's edit is never discarded; it reconciles against real
  server state (the designer client also re-fetches on 409).
- **Rejection path in the designer:** the conflict becomes an explicit entry
  (`getConflicts()`), surfaced through the status region, resolved by
  `resolveConflict(id, 'take-server' | 'take-local')`. `take-local` re-pushes
  against the server's *current* version — a deliberate new write, never a
  blind overwrite.

## Sync over Cana's resync events

The designer side (`apps/service-management/src/state/catalogSyncClient.js`)
is a sibling consumer of the same Cana committed-event stream that
`designerSync` (JUM-485) subscribes to:

- **Outbound:** local Cana commits on the state document schedule a debounced
  push of every *dirty* shared domain. Dirty is decided by a durable marker
  at `domain.context.catalog = { id, version, contentHash }` (additive,
  JUM-492's carry pattern, Requirement 126 Contract 3): `contentHash` is the
  canonical JSON of the **normalized** domain without the marker, so the hash
  is stable across the designer's own load/apply normalization.
- **Inbound:** the client polls the catalog and converges by **document
  read-back** — `GET /catalogs?includeDeleted=true`, diffed by `(id,
  version)` against the markers. This is Cana's own resync rule (JUM-413)
  applied across the network: a gap is a reload signal, never an event
  replay (Cana cursors are per client instance and mean nothing across
  machines).
- **One apply path:** remote changes cross `applyRemoteDocument` from
  `designerSync.js` — the same path as tab-originated changes — so selection
  reconciliation, undo isolation (remote changes are not undoable) and redo
  truncation behave identically. Unlike tab sync, the client then persists
  via `saveState()`: for catalog changes the truth is on the server, not yet
  in local Cana.

## Convergence after partition

Proven, not asserted:
`apps/backend-template/test/integration/ServiceManagement/catalogSync.integration.test.ts`
boots the **real** Express backend (real JWT auth, real mediator) on an
ephemeral loopback port and runs **two real designer clients** over Node's
real `fetch`. Bob is partitioned by repointing his transport at a **closed
port** — a real `ECONNREFUSED`, not mocked latency. Both sides keep editing;
on heal, Bob's read-back converges Alice's new domain, the contested domain
surfaces as a reviewable conflict (Bob's partitioned edit survives), and
`take-server` resolution lands both clients on the same canonical document.

## Deletion semantics

- **Delete = tombstone.** The record survives with `deletedAt` set and its
  version bumped, so a delete on one client propagates to every other
  client's next read-back: a clean local copy is removed; a locally-dirty
  copy raises a `deleted-remotely` conflict instead of vanishing.
- **Recoverable.** `POST /catalogs/{id}/restore` clears the tombstone (a
  versioned write, with its own event); clients re-admit the record.
- **Local deletion of a shared domain** is pushed as a delete while online.
  An offline local deletion cannot be pushed; the surviving server record is
  then the truth and the domain is re-admitted on read-back — the same
  "committed document wins" answer designerSync gives for tabs (the marker
  is durable in Cana; the deletion-intent queue is session-scoped by design
  in this slice).

## What is deliberately descoped (12-01 carry-over candidates)

Delivered: the contract-first backend module with its tests, the designer
sync client wired behind the existing sync seam, optimistic concurrency with
the reviewable rejection path, tombstone deletion with restore, mediator
events (in-memory adapter compiled for tests), and the real-partition
convergence proof.

Not in this PR:

- **Mediator broker delivery to designer clients** (push instead of poll):
  the RabbitMQ/BullMQ adapters exist in `packages/message-mediator`, but no
  WebSocket fan-out to browsers is wired; the client converges by polling
  read-back, which is correct under any broker choice.
- **Designer UI wiring**: share/unshare/conflict-resolution surfaces in
  `script.js` — the client module is DOM-free and composable; the visual
  chrome (and the token-provider UX: the transport already accepts one) is a
  follow-up.
- **Driver-level conditional writes**: the repository's read-check-write is
  the reference behavior; production drivers should push the same check into
  `IStoreMutationOptions.expectedVersion` native conditionals.

## Verification

```bash
# backend module (unit + API integration)
NODE_ENV=dev node_modules/.bin/jest --runInBand --coverage=false \
  --testPathPattern "modules/Catalogs|Express/Catalogs"
# designer client
NODE_ENV=dev node_modules/.bin/jest --runInBand --coverage=false \
  apps/service-management/test/unit/catalogSyncClient.test.ts
# real-HTTP two-client convergence after a real partition
NODE_ENV=dev node_modules/.bin/jest --runInBand --coverage=false \
  apps/backend-template/test/integration/ServiceManagement/catalogSync.integration.test.ts
# contract gates
bun run oas:check-routes && bun run arch:check-boundaries
```
