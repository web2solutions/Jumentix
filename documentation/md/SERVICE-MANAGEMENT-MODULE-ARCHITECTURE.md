# Service Management Module Architecture and IDesignerStore Port Contract

This is the E3 document of the Service Management E1–E8 documentation chain
([JUM-473](https://linear.app/jumentix/issue/JUM-473/docs-e3-documentation-module-architecture-and-storage-port-contract)).
It documents two things, exactly as the code behaves today:

1. The module architecture of `apps/service-management` as delivered by
   [JUM-468](https://linear.app/jumentix/issue/JUM-468/refactor-extract-statepersistence-core-as-es-module-behind)
   (merged in PR #86).
2. The `IDesignerStore` storage port contract — precisely enough that a new
   adapter can be implemented from this document alone.

Every behavioural claim below is pinned by the source modules and by the unit
suites
[`designerStore.test.ts`](../../apps/backend-template/test/unit/service-management/designerStore.test.ts)
and
[`designerState.test.ts`](../../apps/backend-template/test/unit/service-management/designerState.test.ts).

## Audience

Most of the E-chain documents the component for its maintainers. This one also
has two external readers who need it before their own work starts:

- **H3's `CanaDesignerStore`**
  ([JUM-483](https://linear.app/jumentix/issue/JUM-483/feature-canadesignerstore-idesignerstore-adapter-over-the-cana-client))
  implements `IDesignerStore` against the Cana client. Its author needs the
  port's exact semantics: what `load()` returns when nothing is stored, what
  `save()` guarantees about durability, and how the port expresses "storage
  unavailable" and "storage lost". Those states exist in the port precisely
  because Cana will produce them (Cana
  [JUM-560](https://linear.app/jumentix/issue/JUM-560/feature-storage-quota-persistence-and-eviction-policy)
  — storage quota, persistence and eviction policy).
- **[JUM-493](https://linear.app/jumentix/issue/JUM-493/feature-publish-designer-core-as-jumentix-package-xpertminds-org-dry)**
  publishes the designer core as an `@jumentix` package. A published package's
  module boundaries are its public API, so this document is the reference an
  external consumer reads.

## Module architecture (post-PR #86)

The application is a zero-build vanilla SPA. `index.html` loads `script.js` as
an ES module; everything else is reached through static imports.

### The layering convention

The architecture is a single rule: **pure logic lives in DOM-free modules
under `src/`; DOM access lives in the entry module.** The DOM-free set is what
can be unit-tested under Bun/Node with no DOM shim — and what JUM-493 can
publish — so the boundary is the architecture. The boundary is enforced by a
test: `designerState.test.ts` reads the three `src/` modules, strips comments,
and fails if `document.` or `window.` appears.

### Current modules

| Module | Layer | Role |
| --- | --- | --- |
| `apps/service-management/script.js` | DOM-bound | Entry module: event wiring, rendering, import/export flows. Owns every `document`/`window` interaction. |
| `apps/service-management/src/state/designerState.js` | DOM-free | State and persistence core: the state object, the `normalizeStatePayload` normalisation chain, snapshot/apply, history (undo/redo), `loadState`, `buildModelSnapshot`. |
| `apps/service-management/src/store/IDesignerStore.js` | DOM-free, dependency-free | The storage port: contract + base class. Importable under any JavaScript runtime. |
| `apps/service-management/src/store/LocalStorageDesignerStore.js` | DOM-free | TRANSITIONAL `IDesignerStore` adapter over `localStorage`. Retired by JUM-484. |

The dependency direction is one-way: `script.js` → `src/state/designerState.js`
→ (port) `src/store/IDesignerStore.js` ← `src/store/LocalStorageDesignerStore.js`.
The state core imports nothing DOM-bound and nothing store-concrete — it knows
only the port.

> **In flight — [JUM-469](https://linear.app/jumentix/issue/JUM-469/refactor-modularize-designer-canvas-validation-exporters-importers).**
> The exporters, importers, validation, canvas and tabs modules are being
> extracted in parallel and are not part of this document's module table. They
> land via JUM-469 and extend the same convention: DOM-free logic in modules
> under `src/`, DOM-bound wiring in the entry module. When they merge, this
> table grows; the layering rule does not change.

### The injection pattern

`script.js` constructs the core once, at module top level:

```js
const store = new LocalStorageDesignerStore();
const designerState = createDesignerState({
  store,
  seed,
  render,
  runtimeEnvDefaults: RUNTIME_ENV_EDITABLE_DEFAULTS
});
```

`createDesignerState({ store, seed, render, runtimeEnvDefaults })` takes its
three impure collaborators as injections:

- **`store`** — an `IDesignerStore` adapter. All persistence crosses this
  boundary; the core never touches `localStorage` itself.
- **`seed`** — a callback that populates `state` with the default template.
  The core calls it on first run and on recovery, but does not know what the
  template is.
- **`render`** — a callback invoked after undo/redo restores a snapshot, so
  the core can trigger a re-render without importing the renderer.
- **`runtimeEnvDefaults`** — default values for the
  `runtimeEnvironment.values` section, owned by the UI layer's env metadata.

The returned `state` and `history` objects are **shared by reference**: the UI
layer mutates `state` directly (as it always has) and every core method
observes the same objects. Mutating operations go through
`withPersist(action, options)`, which records history before the action
(unless `options.recordHistory === false`) and saves after it. History is
capped at 100 entries (`HISTORY_LIMIT`); recording a new entry clears the redo
future; `undo()`/`redo()` restore a snapshot, save, and call `render()` —
and are no-ops on an empty past/future.

Startup is a single `await loadState()` in `script.js`.

### The state core (`src/state/designerState.js`)

- **State object.** One object holding the twelve persisted sections of the
  `service-management.v1` document (schema pinned by
  [Requirement 126, Contract 2](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md)
  — link, not copy).
- **`normalizeStatePayload(parsed)`** — normalises a decoded payload into the
  model slice restored on load. Only `domains`, `relationships`, the three
  selections, `idCounter` and `view` come back; the other pinned sections are
  intentionally not restored at load time. Normalisation drops relationships
  pointing at unknown entities and clamps the view (zoom to 0.5–2, edge style
  and severity to their enums).
- **`snapshotState()`/`applySnapshot()`** — deep-copy the persisted sections
  out of `state` and restore them back, recomputing `idCounter` from the
  highest numeric id suffix.
- **`saveState()`** — builds the twelve-section payload and calls
  `store.save(payload)` without awaiting (fire-and-forget, preserving
  pre-extraction behaviour; see the adapter section for why this is safe
  today and why callers must not depend on it).
- **`loadState()`** — maps the port's load outcomes onto designer state; see
  the outcome table below.
- **`buildModelSnapshot()`** — builds the schema-diff baseline document
  (`{ domains, relationships }`, shape pinned by Requirement 126 Contract 2)
  that `script.js` writes through `store.saveBaseline()`.

### The `service-management.v1` storage schema

The entire suite state (all four tabs) persists as ONE JSON payload under the
single localStorage key `service-management.v1`; the schema-diff baseline lives
under `service-management.schema-baseline.v1`. The schema — the twelve
top-level sections, their enums, and the baseline shape — is pinned by
[Requirement 126, Contract 2](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md)
and is **not duplicated here** so the two cannot drift. Any structural change
must bump the versioned key and update that requirement in the same PR. The
port itself is schema-agnostic: the pinned wire format belongs to the
transitional adapter and to JUM-484's migration.

## The `IDesignerStore` port contract

Source: [`apps/service-management/src/store/IDesignerStore.js`](../../apps/service-management/src/store/IDesignerStore.js).

### Why the port is shaped around Cana, not localStorage

`LocalStorageDesignerStore` is TRANSITIONAL: it carries the designer only
until JUM-484's one-way migration of `service-management.v1` retires it. Cana
has **no fallback to localStorage — no fallback at all** (decision 2026-07-29).
The port is therefore shaped around the semantics Cana (an offline database
behind a postmaster/worker boundary) produces, and the localStorage adapter
stretches to fit.

### The no-fallback rule and its consequence

Under the no-fallback rule, an adapter failure surfaces as designer state —
never as a silent swap to another backend. Concretely, `loadState()` maps the
port's load outcomes onto recovery behaviour:

| `load()` outcome | Meaning | `loadState()` behaviour |
| --- | --- | --- |
| `'ok'` | A stored document was found and decoded. | Normalise and apply the model slice. If normalisation itself throws (corrupt-but-decodable payload), recover exactly like `'lost'`. |
| `'empty'` | Nothing is stored. First run — NOT an error, NOT data loss. | Seed the default template, persist it, clear history. |
| `'lost'` | Storage was available and held data that is no longer readable (eviction, corruption). Distinct from `'empty'`. | Seed, persist the recovered state (overwriting the unreadable payload), reset the view, clear history. |
| `'unavailable'` | The storage backend itself cannot be used (private mode, missing IndexedDB). Terminal under no-fallback. | Seed **in memory only** — there is nothing behind the store to write to, and no fallback. |

### Operations

All seven operations are async and return Promises. Cana routes through a
postmaster and workers, so every operation crosses a boundary. Adapters over
synchronous backends perform their work synchronously and return
already-resolved Promises — **callers MUST NOT rely on that** and MUST treat
every result as asynchronous.

- **`probe()` → `DesignerStoreStatus`.** Asks about storage health at startup,
  before any state exists: `'available'`, `'unavailable'` or `'lost'`, with an
  optional human-readable `reason` for non-available states. It answers without
  requiring a prior `load()`, so private mode and browsers without usable
  IndexedDB become detectable terminal states under the no-fallback rule.
- **`load()` → `DesignerStoreLoadResult`.** Reads the persisted designer state
  document: `{ status: 'ok', payload }` when a document was found and decoded;
  `{ status: 'empty' | 'unavailable' | 'lost', payload: null }` otherwise, with
  an optional `reason` for `'unavailable'`/`'lost'`.
- **`save(payload)` → `DesignerStoreSaveResult`.** Guarantees durability or
  says it cannot:
  - `'persisted'` — the write is durable: any subsequent `load()` against the
    same backend returns this payload (until the next `save()`).
  - `'unknown'` — the outcome is indeterminate (e.g. a worker crashed after
    the write was dispatched). An unknown outcome **MUST NOT be reported to
    the user as success**.
  Adapters MAY throw synchronously for programmer errors (an unserializable
  payload); backend failures are reported through the result, never as
  `'persisted'`.
- **`clear()` → `DesignerStoreSaveResult`.** Removes the state document.
  Resolving `'persisted'` means the document is gone for good: a subsequent
  `load()` reports `'empty'`.
- **`loadBaseline()` / `saveBaseline(snapshot)` / `clearBaseline()`.** The
  schema-diff baseline document crosses the same storage boundary, so the port
  carries it: these follow the same result semantics as `load()`, `save()` and
  `clear()` respectively.

### The base class fails loudly

`IDesignerStore` is the contract, not an implementation: every base method
throws `IDesignerStore.<method>() must be implemented by the adapter.`
Adapters MUST subclass and override every method, so a partial adapter fails
loudly instead of silently dropping designer state. The unit suite asserts all
seven base methods reject.

## The reference implementation — and what it cannot express

Source:
[`apps/service-management/src/store/LocalStorageDesignerStore.js`](../../apps/service-management/src/store/LocalStorageDesignerStore.js).

`LocalStorageDesignerStore` is the reference implementation, but the port is
shaped around Cana and this adapter **stretches to fit**. Its behaviour must
not be mistaken for the contract:

- **Synchronous work behind resolved Promises.** localStorage is synchronous,
  so every method performs its work before returning an already-resolved
  Promise. `save()` runs `setItem` synchronously, preserving the
  pre-extraction fire-and-forget durability for callers that do not await (the
  whole designer today). No caller may depend on this timing — the port is
  async.
- **Throwing `setItem` propagates synchronously.** A quota or blocked-storage
  error from `setItem`/`removeItem` throws out of `save()`/`clear()` to the
  caller, exactly as the pre-extraction direct `localStorage` access behaved
  (pinned by test).
- **Corrupt JSON → `'lost'`.** A stored payload that is not valid JSON is the
  only corruption localStorage can express, and it reports `'lost'` — never
  `'empty'`. True eviction has no localStorage analogue and is never reported
  by this adapter.
- **`'unknown'` is never reported.** A `setItem` that returns is durable by
  the HTML storage contract, and one that throws propagates — so this adapter
  never resolves `'unknown'`.
- **`'unavailable'` only for a missing/throwing backend.** The ambient
  `localStorage` global is resolved lazily and defensively (property access
  itself can throw when storage is blocked). No backend, a throwing global, or
  a `getItem` that throws all report `'unavailable'`; a `getItem` returning
  `null` (or `undefined`) reports `'empty'`. `probe()` writes and removes a
  `${stateKey}.probe` key: success is `'available'`, a throw is
  `'unavailable'` with the error message as `reason`.
- **Pinned keys.** The default keys are exported as `LOCAL_STORAGE_STATE_KEY`
  (`service-management.v1`) and `LOCAL_STORAGE_BASELINE_KEY`
  (`service-management.schema-baseline.v1`), pinned by Requirement 126
  Contract 2. The constructor accepts `storage`, `stateKey` and `baselineKey`
  overrides for tests; the wire format (one `JSON.stringify` under the pinned
  key) must not change here — the schema belongs to JUM-484's migration.

Because this adapter will rarely report `'unavailable'` or `'lost'` and never
reports `'unknown'`, an implementer reading only its behaviour would miss most
of the contract. The contract is the port; this class is one degenerate
backend.

## Implementing a new adapter: `CanaDesignerStore` (JUM-483)

A new adapter MUST:

1. Subclass `IDesignerStore` and override **all seven** methods — the base
   implementations throw.
2. Honour the async contract: return Promises from every method; never require
   callers to depend on synchronous completion.
3. Honour the result semantics: `'persisted'` only when a subsequent `load()`
   is guaranteed to return the payload; `'unknown'` (never success) when the
   outcome is indeterminate; `'empty'` only when nothing is stored; `'lost'`
   when stored data is gone or unreadable — always distinguishable from
   `'empty'`; `'unavailable'` when the backend itself cannot be used.
4. Carry the baseline document across the same boundary with the same
   semantics (`loadBaseline`/`saveBaseline`/`clearBaseline`).
5. Reserve synchronous throws for programmer errors; report backend failures
   through the result object.

The states a Cana adapter will produce that localStorage never does:

- **`'unknown'`** — a worker crashed after the write was dispatched; the
  outcome is indeterminate.
- **`'lost'` by eviction** — Cana's quota, persistence and eviction policy
  (Cana [JUM-560](https://linear.app/jumentix/issue/JUM-560/feature-storage-quota-persistence-and-eviction-policy))
  can remove stored data under quota pressure; with nothing behind Cana this
  is data loss and must surface as `'lost'`, never as `'empty'`.
- **`'unavailable'` at `probe()`** — private mode or a browser without usable
  IndexedDB, detectable at startup before any state exists.

Under the no-fallback rule these surface through `loadState()` as designer
state (see the outcome table) — the designer never silently swaps to another
backend.

## The implemented adapter: `CanaDesignerStore` (JUM-483)

Sources:
[`apps/service-management/src/store/CanaDesignerStore.js`](../../apps/service-management/src/store/CanaDesignerStore.js)
(adapter) and
[`apps/service-management/src/store/designerStoreFactory.js`](../../apps/service-management/src/store/designerStoreFactory.js)
(selection seam); unit suite
[`canaDesignerStore.test.ts`](../../apps/backend-template/test/unit/service-management/canaDesignerStore.test.ts).

`CanaDesignerStore` implements all seven port methods over the Cana client,
and the swap required **no designer-logic change** — the port abstraction
held. The decisions a reader needs:

- **Wire format unchanged.** Both documents live in one object store
  (`designerDocuments`, database `service-management`, schema version 1)
  under the pinned Contract 2 keys, each value the exact `JSON.stringify` of
  the same document the transitional adapter writes. JUM-484's migration is a
  byte copy, not a transformation.
- **State mapping.** Missing/unusable IndexedDB (Cana `'Unavailable'`) →
  `'unavailable'` at `probe()`/`load()`; eviction (Cana JUM-560's
  `storageState().evicted`, or an `'Evicted'` rejection) with no record found
  → `'lost'`, never `'empty'` — while a record that IS found loads normally;
  unreadable JSON → `'lost'`, as in the transitional adapter. Quota, eviction
  and unknown-outcome each surface **distinctly**: within a port state, the
  `reason` is tagged (`quota:`, `evicted:`, `unknown-outcome:`,
  `unavailable:`).
- **Quota pressure → which port state.** A quota-REJECTED write did not
  happen; the port has no deterministic-failure save state, so `save()`
  resolves `'unknown'` with a `quota:` reason — never `'persisted'`. Quota
  pressure that has not failed a write (`nearQuota`, non-persistent storage)
  is surfaced at `probe()` as `'available'` with a diagnostic `reason`,
  feeding JUM-484's environment states.
- **Unknown outcomes carry their reconciliation handles.** Writes go through
  `client.transaction()` (not the auto-commit table) so an `'unknown'`
  outcome embeds `correlationId`/`attemptedAt` in the reason — the two values
  `client.resolveWrite()` needs (Cana JUM-411/559).
- **Failed opens are not cached.** `UpgradeBlocked` is transient; the next
  operation retries rather than turning one bad moment into a permanent
  outage with nothing behind it.
- **Client injection, factory-style.** The adapter never imports
  `@jumentix/cana`: the client is injected (`client`/`clientProvider`),
  mirroring `buildDatabaseClientCompilers`'s `indexedDbClient`. The seam
  (`createDesignerStore`) selects by name (`cana`, aliases `indexeddb`/
  `indexed-db`, like the factory's normaliser), with precedence explicit
  argument → ambient `JUMENTIX_DESIGNER_STORE_DRIVER` global →
  `?designer-store=cana` URL parameter → **default `localstorage`**. With no
  client wired, the default provider lazily `import()`s `@jumentix/cana` and
  builds through `createCanaDatabaseClient`; a host that cannot resolve it
  gets `'unavailable'`, never a silent fallback. The default stays
  localStorage until JUM-484's migration makes the Cana store sole.

## References

- Port contract: [`apps/service-management/src/store/IDesignerStore.js`](../../apps/service-management/src/store/IDesignerStore.js)
- Transitional adapter: [`apps/service-management/src/store/LocalStorageDesignerStore.js`](../../apps/service-management/src/store/LocalStorageDesignerStore.js)
- Cana adapter + selection seam: [`apps/service-management/src/store/CanaDesignerStore.js`](../../apps/service-management/src/store/CanaDesignerStore.js), [`apps/service-management/src/store/designerStoreFactory.js`](../../apps/service-management/src/store/designerStoreFactory.js)
- State core: [`apps/service-management/src/state/designerState.js`](../../apps/service-management/src/state/designerState.js)
- Entry module: [`apps/service-management/script.js`](../../apps/service-management/script.js)
- Unit suites: [`designerStore.test.ts`](../../apps/backend-template/test/unit/service-management/designerStore.test.ts), [`designerState.test.ts`](../../apps/backend-template/test/unit/service-management/designerState.test.ts), [`canaDesignerStore.test.ts`](../../apps/backend-template/test/unit/service-management/canaDesignerStore.test.ts)
- Storage schema: [Requirement 126, Contract 2](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md)
- Component overview: [Service Management Application](./SERVICE-MANAGEMENT-APPLICATION.md)
- Linear: [JUM-468](https://linear.app/jumentix/issue/JUM-468/refactor-extract-statepersistence-core-as-es-module-behind) (the port), [JUM-469](https://linear.app/jumentix/issue/JUM-469/refactor-modularize-designer-canvas-validation-exporters-importers) (the module graph), [JUM-483](https://linear.app/jumentix/issue/JUM-483/feature-canadesignerstore-idesignerstore-adapter-over-the-cana-client) (CanaDesignerStore), [JUM-484](https://linear.app/jumentix/issue/JUM-484) (migration retiring the transitional adapter), [JUM-493](https://linear.app/jumentix/issue/JUM-493/feature-publish-designer-core-as-jumentix-package-xpertminds-org-dry) (package publish), Cana [JUM-560](https://linear.app/jumentix/issue/JUM-560/feature-storage-quota-persistence-and-eviction-policy) (quota/eviction policy)
