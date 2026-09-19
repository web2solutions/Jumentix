# Service Management Cana Adoption, Migration and Offline Behaviour

This is the E6 document of the Service Management E1–E8 documentation chain
([JUM-487](https://linear.app/jumentix/issue/JUM-487/docs-e6-documentation-cana-adoption-migration-and-offline-behavior)).
It documents Cana adoption from the **consumer's** side — what the designer
promises its users about their data — exactly as the code behaves today, after
the Cana-adoption lane
([JUM-483](https://linear.app/jumentix/issue/JUM-483/feature-canadesignerstore-idesignerstore-adapter-over-the-cana-client),
[JUM-484](https://linear.app/jumentix/issue/JUM-484/feature-one-way-migration-of-service-managementv1-from-localstorage-to),
[JUM-485](https://linear.app/jumentix/issue/JUM-485/feature-write-event-integration-multi-tab-sync-via-cana-message),
[JUM-486](https://linear.app/jumentix/issue/JUM-486/test-offlineonline-matrix-for-designer-persistence-on-cana))
landed.

Cana's own documentation
([CANA-INDEXEDDB-ADAPTER](./CANA-INDEXEDDB-ADAPTER.md) and
[CANA-USAGE-GUIDE](./CANA-USAGE-GUIDE.md), Cana
[JUM-418](https://linear.app/jumentix/issue/JUM-418/docs-document-cana-architecture-api-migration-and-offline-examples))
documents what the database does. This document records what a user of the
designer can rely on, what can destroy their work, and what to do about it —
with every state naming both what is shown and what the user can do.

Two deliberate boundaries:

- **The storage schema is linked, not duplicated.** Keys and payload shape are
  pinned by
  [Requirement 126, Contract 2](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md);
  this document references that contract and does not restate it.
- **The internals live in the sibling documents.** The port contract and the
  module architecture belong to the E3 document,
  [Service Management Module Architecture](./SERVICE-MANAGEMENT-MODULE-ARCHITECTURE.md);
  the parity guarantees (including the export-scope boundary) to the E4
  document,
  [Service Management Contract Parity Guarantees](./SERVICE-MANAGEMENT-CONTRACT-PARITY.md);
  the status-surface contract every message below is rendered through to the
  E5 document,
  [Service Management Operations Console](./SERVICE-MANAGEMENT-OPERATIONS-CONSOLE.md).

## The one fact everything else follows from: no fallback

**Cana has no fallback to localStorage. No fallback at all** (decision
2026-07-29). Since
[JUM-484](https://linear.app/jumentix/issue/JUM-484/feature-one-way-migration-of-service-managementv1-from-localstorage-to)'s
one-way migration, the designer's data lives in Cana and nowhere else: the
transitional `LocalStorageDesignerStore` is retired and deleted, and no driver
argument, environment global or URL parameter can route the designer away from
Cana
([`designerStoreFactory.js`](../../apps/service-management/src/store/designerStoreFactory.js)).
Every failure state below is therefore genuine — there is nothing behind the
store to catch the designer.

Three things follow that a user should know without having to infer them:

1. **Where your work lives.** In this browser, on this machine, in this
   browser profile — an IndexedDB database named `service-management`, one
   object store (`designerDocuments`), two documents under the pinned keys
   `service-management.v1` and `service-management.schema-baseline.v1`. It is
   **not synced** to any server (the application server serves the shell; it
   never sees your design data), **not backed up by us**, and **not
   recoverable by support**. Another browser, another profile, another machine
   is another, empty, designer.
2. **How it can be lost.** Browser storage eviction (the browser reclaiming
   origin storage under disk pressure), clearing site data, a
   private/incognito session or blocked storage, an unsupported browser
   without usable IndexedDB, quota exhaustion, and corruption. Each is named
   plainly in the matrix below — none of them is a "degraded mode", because
   there is no degraded mode: a store that cannot keep your data is a store
   that has lost it.
3. **What to do about it.** **Export.** Under the no-fallback requirement,
   the designer's export (and the one automatic backup the migration
   produces) is the only recovery mechanism that exists — see
   [Export and backup](#export-and-backup).

Documentation that described Cana adoption as an improvement without stating
these loss modes would be accurate about the technology and misleading about
the product. The matrix below is the product truth, and it is the same matrix
[JUM-486](https://linear.app/jumentix/issue/JUM-486/test-offlineonline-matrix-for-designer-persistence-on-cana)'s
browser suite tests; the two must not drift.

## Migration: one-way, verified, terminal (JUM-484)

The migration of `service-management.v1` from localStorage to Cana runs at
boot, before any state load, on the first launch after the upgrade — and
exactly once
([`canaMigration.js`](../../apps/service-management/src/store/canaMigration.js)).
Because safety cannot come from retreat, it comes from construction:

- **Backup before the first write.** Before anything is written to Cana, the
  verbatim localStorage payload is downloaded as
  `service-management-v1-backup-<timestamp>.json`. This file is the recourse
  that replaces the retired fallback — keep it.
- **Verify before cutover.** The state payload (and the schema-diff baseline,
  when one exists) is written through the storage port, read back, and
  content-compared against the source. Only a verified migration records its
  marker (`service-management.v1.cana-migration`, status `verified`) and a
  provenance record in Cana (`service-management.migration.v1`, schema
  version 1).
- **Failure is declared, never silent, and never destructive.** Any failure —
  an unwritable store, a read-back mismatch — leaves the localStorage source
  untouched and the migration re-runnable on the next launch. A source
  payload that is not readable JSON cannot be migrated and is never deleted:
  it stays in place for manual recovery, and the boot says so.
- **Idempotent.** The writes are `put`s of the same payload under the same
  pinned keys; an interrupted migration re-runs to the identical result, and
  a verified marker short-circuits re-entry — including across an offline
  period (proven by the JUM-486 matrix).
- **30-day delayed source retention.** After a verified migration the
  localStorage source stays in place, UNUSED, for 30 days — a manual recovery
  path only, never a fallback: no code path reads it as a store. After the
  retention period the boot removes it. The migration is terminal.
- **One-way means one-way.** There is no rollback. Once the migration has
  verified, the designer reads and writes Cana exclusively, and no setting
  can take it back.

What the user sees:

- On success, the status region announces: *"Your saved design was moved to
  the new persistent store and verified. A backup was downloaded as
  `service-management-v1-backup-<timestamp>.json`; the previous copy stays,
  unused, for 30 days as a manual recovery path."*
- On failure, an error names the reason
  (*"Your previously saved design could not be migrated: …"*) and the
  migration retries on the next launch — the source is still there.
- The wire format did not change (Requirement 126 Contract 2): same keys,
  same JSON documents — only where they live. A baseline that existed crosses
  with the state; an absent baseline stays absent, never fabricated.

**Proven by:**
[`canaMigration.test.ts`](../../apps/service-management/test/unit/canaMigration.test.ts)
(unit) and
[`canaMigration.browser.integration.test.ts`](../../apps/service-management/test/integration/browser/canaMigration.browser.integration.test.ts)
(real browser, real IndexedDB), plus the migration-idempotence-offline cell
of the JUM-486 matrix.

## Offline behaviour: everything works, and "offline" is not "safe"

**Everything works with no network — the designer was always local.** The
model, the console tabs, undo/redo, import/export and every save run against
Cana in the browser; the server only serves the application shell and the
runtime-env/PM2 APIs. With the installable PWA shell
([JUM-489](https://linear.app/jumentix/issue/JUM-489)) the app even loads
with no network at all: the shell comes from the service-worker cache, the
data from Cana — two different stores that never impersonate each other (the
shell never masks an evicted database as a first run, and never presents
cached data of its own; see the
[component README](../../apps/service-management/README.md)).

What "offline-first" does **not** guarantee:

- **No sync.** Offline means *no server is needed*, not *your data exists
  anywhere else*. There is no account, no cloud copy, no cross-device or
  cross-browser replication.
- **No backup.** Durability is the browser's storage policy, not ours.
  "Clear site data" removes BOTH the shell cache and the Cana database —
  the shell's presence never implies designer data is safe.
- **No immunity.** Eviction, quota exhaustion and corruption all happen
  offline. Offline work is exactly as exposed as online work, and the answer
  is the same: export.

**Proven by:** the JUM-486 offline cells — the server is genuinely killed
(never an emulated offline flag), edits continue against the real IndexedDB,
a reload comes back from the shell cache with both the online and the
offline edits intact, and coming back online loses nothing and duplicates
nothing.

## The state matrix: what you see, what you can do

One matrix, three columns: the storage condition (from Cana's quota,
persistence, eviction and crash-recovery policies — Cana
[JUM-560](https://linear.app/jumentix/issue/JUM-560/feature-storage-quota-persistence-and-eviction-policy)
and
[JUM-411](https://linear.app/jumentix/issue/JUM-411/fix-implement-worker-crash-recovery-and-state-resynchronization)),
what the designer shows you, and what you can do. Every message is rendered
through the JUM-543 non-blocking status region — never a blocking alert. The
boot declares the environment states at startup, BEFORE you invest work; the
write-path states surface at the moment they happen.

### Private/incognito or blocked storage — non-persisting session

- **What you see** (at startup, severity error): *"Persistent storage is
  unavailable in this browsing context (private/incognito mode, blocked
  storage, or storage not yet wired into this host). The designer cannot save
  your work: anything you build in this session will be lost when it ends."*
  The designer still opens and is fully explorable — in memory only. If you
  try to save, the failure is surfaced (*"A save could not be confirmed…"*),
  never silently accepted; a reload loses the edit and the declaration
  recurs.
- **What you can do:** export the in-memory model (Export JSON works without
  storage) before closing, and redo the work in a normal window/profile where
  storage is allowed. Nothing you build in this session can be recovered
  afterwards.

### A browser without usable IndexedDB — unsupported environment

- **What you see** (at startup, severity error): *"This browser provides no
  usable IndexedDB storage. The Service Management designer depends on it for
  persistence, so this environment is unsupported: you can explore the
  designer, but nothing you build here can be saved."* This is a distinct
  state from the private-mode one above — not a blank screen, and not the
  same message.
- **What you can do:** explore and export; do real work in a browser with
  IndexedDB.

### Persistence not granted — degraded durability

- **What you see** (severity info): *"Storage is working but durability is
  degraded: durability: storage is not persistent; the browser may reclaim it
  under pressure."* Reads and writes work; the browser simply has not promised to
  keep the data when disk runs tight, which makes eviction (below) more
  likely.
- **What you can do:** keep working, but export regularly; where the browser
  offers a persistence grant, allow it.

### Quota near exhaustion — warning before failure

- **What you see** (severity info): *"Storage is working but durability is
  degraded: quota: storage usage is near the origin quota (usage/quota
  bytes); writes may start failing."* The warning arrives BEFORE the hard
  failure — reads still work, and the export path is reachable from the
  warned session (proven by the JUM-486 quota cell, which exports
  `domain-designer.json` from exactly this state).
- **What you can do:** export now, then free origin storage (browser
  settings) before continuing.

### Quota exhausted — the write did not happen

- **What you see:** a write rejected for quota is reported as unconfirmed
  (*"A save could not be confirmed (quota: …); reconciling with the stored
  document."*) — never as success. Cana's taxonomy is explicit: a
  quota-rejected write DID NOT happen; the durable record does not carry the
  doomed edit, and a reload tells the same truth.
- **What you can do:** your edit is still on screen in this session — export
  it before reloading, free storage, then redo the save.

### Evicted database — data loss, declared

- **What you see** (at startup, severity error): *"Previously saved designer
  data is no longer readable (storage eviction or corruption) and there is no
  fallback store. A fresh template was loaded instead; your only recourse is
  a backup/export made earlier."* An evicted database and a first run are
  indistinguishable by inspection; only Cana's tombstone verdict tells them
  apart, so this state is NEVER presented as a first run — and a genuinely
  fresh profile is never reported as data loss (both directions proven).
- **What you can do:** restore from an earlier export or migration backup
  (Import JSON). There is no other recourse — no fallback store, no server
  copy, no support recovery.

### Corrupted record — lost, not empty, announced, and the designer recovers

- **What you see** (at startup, severity error): *"Your previously saved
  design could not be loaded: the stored data is corrupted and there is no
  fallback store, so a fresh template was loaded instead and the saved model
  was lost. Your recourse is a backup/export made earlier — restore it with
  Import JSON."* A stored payload that no longer parses reports `'lost'`
  through the port — never `'empty'` — and the designer recovers instead of
  crashing: the seed template loads and the recovered save makes the record
  readable again. The probe-time environment states cannot see an unreadable
  record (only eviction), so the loss is declared at load time through the
  same `data-lost` state and the same status region
  ([JUM-626](https://linear.app/jumentix/issue/JUM-626/fix-announce-load-time-storage-corruption-recovery-in-the-boot-ui)).
  When the verified pre-migration copy is still retained in localStorage
  (its 30-day window, JUM-484), the message names it — the pinned key and the
  retention date — as the first recourse.
- **What you can do:** restore from an earlier export or migration backup
  (Import JSON); when the message names the retained pre-migration copy, copy
  it out before its retention date and import that.

### Unknown write outcome — worker crash after dispatch

- **What you see:** *"A save could not be confirmed (unknown-outcome: …);
  reconciling with the stored document."* When Cana reports a write's outcome
  as unknown (a storage worker that died after the write was dispatched, Cana
  JUM-411), the designer never assumes success: it reads the stored document
  back. A read-back matching the attempted payload confirms the save
  (*"The save was confirmed after reconciliation."*); anything else reloads
  the last confirmed state into the designer, so the screen never diverges
  from what is durable. If the read-back itself fails, the message says to
  export immediately — and means it.
- **What you can do:** nothing, in the common case — the reconciliation is
  automatic. On the failure message: export now.

**Proven by:** the eight cells of
[`offlinePersistenceMatrix.browser.integration.test.ts`](../../apps/service-management/test/integration/browser/offlinePersistenceMatrix.browser.integration.test.ts)
(the JUM-486 matrix — offline persistence, offline migration idempotence,
crash classification, private/blocked storage, missing IndexedDB, eviction,
corruption, quota warning-then-failure), run in a real WebKit browser against
the real server and the real vendored Cana bundle, plus
[`canaDesignerStore.test.ts`](../../apps/service-management/test/unit/canaDesignerStore.test.ts)
(the error-taxonomy → port mapping) at unit level. The matrix and this
section are the same promise; change one, change both.

## Multi-tab behaviour (JUM-485)

Open the designer in two tabs of the same browser profile and both tabs stay
consistent: each tab holds its own Cana client over the same database, and
committed writes cross between tabs over a `BroadcastChannel` bridge —
Cana's ordered write events (`CanaClient.subscribe`, Cana JUM-413) reach only
the subscribing client instance, so the channel is the cross-tab boundary
([`designerSync.js`](../../apps/service-management/src/state/designerSync.js)).
The recorded semantics:

- **Undo is local-only; remote changes are not undoable.** A change from
  another tab never enters your undo stack, and it truncates your redo
  branch. Undoing one of YOUR actions after a remote change restores your
  snapshot and persists it as a new, deliberate local write — it is never an
  undo OF the remote change.
- **A pending local edit survives a remote change.** When another tab's
  change touches what you are editing, the committed document wins (Cana
  holds the truth), but your mid-form input, focus, caret and canvas
  scroll/zoom are preserved, the status region announces the remote change,
  and your next explicit save asserts your version. Neither your pending edit
  nor the remote change is silently dropped. Conflict resolution is
  whole-document last-writer-wins — there is no field-level merge.
- **The selection is per-tab and reconciled, never imported.** If another tab
  deletes the relationship or entity you have selected, your selection
  clears; if it deletes your selected domain, the selection moves to the
  first remaining domain. Every reconciliation is announced — a dangling
  selection is impossible and never silent.
- **Backgrounded and closed tabs catch up without loss or duplication.** A
  frozen tab that missed channel messages resynchronises by document
  read-back when it becomes visible; a tab reopened later already loads the
  current document at boot. The persisted event cursor is best-effort
  bookkeeping only — losing it just means the next start resyncs by document,
  which is always correct (see the follow-ups section).
- **An unavailable channel is declared, not hidden.** Without a usable
  `BroadcastChannel` the designer still saves to Cana, but the status region
  says plainly that this tab will not see other tabs' changes until reload —
  the designer never quietly reverts to a single-tab local session.

**Proven by:**
[`designerSync.test.ts`](../../apps/service-management/test/unit/designerSync.test.ts)
(unit) and
[`multiTabSync.browser.integration.test.ts`](../../apps/service-management/test/integration/browser/multiTabSync.browser.integration.test.ts)
(real two-tab browser contexts).

## Export and backup

Under no-fallback, export is the only recovery mechanism that exists — so it
must be obvious, not merely available.

- **How to export:** the Domain Designer toolbar's **Export JSON** button
  downloads `domain-designer.json` — the full-suite document (JUM-547:
  `{ kind: "service-management-suite", version: "2.0.0", domains,
  relationships, interfaces, serviceConfiguration, runtimeEnvironment,
  codeWorkspace, deployments, view }`). **Import JSON** on the same toolbar restores it. The
  other export buttons (Markdown, JSON Schema, OAS 3.1, AsyncAPI, gRPC proto,
  boilerplate bundle, domain package) are design artifacts for downstream
  tooling, not backups.
- **The export's scope, honestly:** the JSON export carries all five tabs of
  the suite state — the domain model, the interface adapters, the service
  configuration, the generated-code workspace and the deploy targets — with one recorded boundary: the
  runtime environment crosses as the environment *selection* only
  (`environment`, `fileName`), never its values, so no machine configuration
  (and no secret) leaves in a bundle; import restores the selection and keeps
  the local machine's values. Bundles exported before JUM-547 (the domain-only
  shape) still import cleanly, with the missing sections defaulted; a bundle
  with an unknown section or a newer major version is refused clearly rather
  than half-imported. The details and their proof live in the E4 document,
  [Service Management Contract Parity Guarantees](./SERVICE-MANAGEMENT-CONTRACT-PARITY.md).
- **The migration backup is the one full-fidelity copy.** The
  `service-management-v1-backup-<timestamp>.json` the migration downloads is
  the verbatim `service-management.v1` payload — every section. Keep it: it
  is the only automatic backup the designer ever makes. (Since JUM-547 the UI
  import reads every section back — including the runtime environment values
  the backup carries, which a bundle never does — so it doubles as a
  full-fidelity restore path.)
- **When to export:** before clearing site data or switching
  browser/profile/machine; the moment a quota or durability warning appears;
  before and after a large redesign session; and periodically on any project
  you could not afford to rebuild. After an eviction or corruption message,
  an earlier export is your only way back.
- **Why it matters more here:** in a system with a fallback, export is a
  convenience. Here it is the difference between an inconvenience and a
  total, unrecoverable loss — the browser owes your data nothing.

## Troubleshooting

- **"My design disappeared and I got a data-lost message."** That is an
  eviction (or corruption) declaration, not a first run: the designer had
  data, the browser's storage no longer does, and there is no fallback.
  Restore your latest export with Import JSON. To make recurrence less
  likely, keep the origin's storage pressure low and grant persistence when
  the browser offers it.
- **"My design disappeared with NO message."** If this is a new browser, a
  new profile, a new machine, or after clearing site data, this is a first
  run — your data was never here, because it never leaves the browser profile
  it was created in. The two situations are deliberately distinguishable: a
  genuinely fresh start shows the seed template silently; a real loss is
  announced.
- **"Everything works in a normal window but vanishes in private mode."**
  Expected: the private window is a declared non-persisting session. Work
  done there does not carry over — export it before closing if you need it.
- **"I got an unsupported-environment message."** This browser provides no
  usable IndexedDB. The designer is explorable, but nothing can be saved; use
  a browser with IndexedDB.
- **"A save could not be confirmed."** Read the reason in the message:
  `quota:` means the origin is full (export, free space, retry);
  `unknown-outcome:` means the outcome was indeterminate and the designer has
  already reconciled by read-back; `unavailable:` means the storage
  environment itself is gone (see the first three rows of the matrix).

## Known follow-ups

Recorded honestly, with their owning issues:

- **The Cana bundle bundling defect — belongs to the Cana lane.** The
  designer's vendored Cana bundle is built from `packages/cana`'s
  `adapter.ts` entry rather than the package index, because bun's full-graph
  bundling of the index emits dangling export bindings WebKit refuses to
  link. The artifact check in
  [`apps/service-management/scripts/sync-service-management-cana-bundle.js`](../../apps/service-management/scripts/sync-service-management-cana-bundle.js)
  fails closed against exactly that regression until the bundler defect is
  fixed upstream.
- **Multi-tab cursor persistence is best-effort.** The sync cursor survives
  an in-session gap but not a page reload (a fresh client restarts its
  retained event window), and losing it is safe by construction — catch-up is
  always by document read-back. A more durable cursor is a possible
  refinement, not a correctness gap.

## What this document deliberately does not cover

- **The storage schema itself** — keys, sections and payload shapes are
  pinned by
  [Requirement 126, Contract 2](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md);
  this document links it rather than duplicating it.
- **The port contract and module internals** — the `IDesignerStore` state
  sets, the adapter's error-taxonomy mapping and the migration module's
  construction belong to the E3 document,
  [Service Management Module Architecture](./SERVICE-MANAGEMENT-MODULE-ARCHITECTURE.md).
- **Parity guarantees** — including the full-suite export scope, the
  `codeWorkspace` crossing and the JUM-547 `runtimeEnvironment` decision — belong to the E4 document,
  [Service Management Contract Parity Guarantees](./SERVICE-MANAGEMENT-CONTRACT-PARITY.md).
- **The status-surface contract** — how messages are rendered (aria-live
  region, severities, no `alert()`) belongs to the E5 document,
  [Service Management Operations Console](./SERVICE-MANAGEMENT-OPERATIONS-CONSOLE.md).
- **What the Cana engine itself guarantees** — its durability policy, error
  taxonomy, transaction outcomes and subscription API are documented by Cana:
  [CANA-INDEXEDDB-ADAPTER](./CANA-INDEXEDDB-ADAPTER.md) and
  [CANA-USAGE-GUIDE](./CANA-USAGE-GUIDE.md)
  ([JUM-418](https://linear.app/jumentix/issue/JUM-418/docs-document-cana-architecture-api-migration-and-offline-examples)).

## References

- Migration + environment states: [`apps/service-management/src/store/canaMigration.js`](../../apps/service-management/src/store/canaMigration.js); Cana adapter: [`apps/service-management/src/store/CanaDesignerStore.js`](../../apps/service-management/src/store/CanaDesignerStore.js); factory: [`apps/service-management/src/store/designerStoreFactory.js`](../../apps/service-management/src/store/designerStoreFactory.js)
- Multi-tab sync engine: [`apps/service-management/src/state/designerSync.js`](../../apps/service-management/src/state/designerSync.js); state core: [`packages/designer-core/src/state/designerState.js`](../../packages/designer-core/src/state/designerState.js); boot wiring and export/import glue: [`apps/service-management/script.js`](../../apps/service-management/script.js)
- Vendored Cana bundle sync: [`apps/service-management/scripts/sync-service-management-cana-bundle.js`](../../apps/service-management/scripts/sync-service-management-cana-bundle.js)
- Suites: [`canaMigration.test.ts`](../../apps/service-management/test/unit/canaMigration.test.ts), [`canaDesignerStore.test.ts`](../../apps/service-management/test/unit/canaDesignerStore.test.ts), [`designerSync.test.ts`](../../apps/service-management/test/unit/designerSync.test.ts) (unit); [`canaMigration.browser.integration.test.ts`](../../apps/service-management/test/integration/browser/canaMigration.browser.integration.test.ts), [`multiTabSync.browser.integration.test.ts`](../../apps/service-management/test/integration/browser/multiTabSync.browser.integration.test.ts) (browser); the JUM-486 offline/online matrix [`offlinePersistenceMatrix.browser.integration.test.ts`](../../apps/service-management/test/integration/browser/offlinePersistenceMatrix.browser.integration.test.ts) (browser, [JUM-486](https://linear.app/jumentix/issue/JUM-486/test-offlineonline-matrix-for-designer-persistence-on-cana))
- Storage schema: [Requirement 126, Contract 2](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md); bilingual parity: [Requirement 076](../../.agents/requirements/project/076-task-documentation-and-bilingual-governance.md)
- Cana engine documentation: [CANA-INDEXEDDB-ADAPTER](./CANA-INDEXEDDB-ADAPTER.md), [CANA-USAGE-GUIDE](./CANA-USAGE-GUIDE.md)
- Sibling E-chain documents: [Runtime Environment Contracts](./RUNTIME-ENVIRONMENT-CONTRACTS.md) (E1), [Service Management Module Architecture](./SERVICE-MANAGEMENT-MODULE-ARCHITECTURE.md) (E3), [Service Management Contract Parity Guarantees](./SERVICE-MANAGEMENT-CONTRACT-PARITY.md) (E4), [Service Management Operations Console](./SERVICE-MANAGEMENT-OPERATIONS-CONSOLE.md) (E5), [Service Management Application](./SERVICE-MANAGEMENT-APPLICATION.md), [Domain Designer Features and Usage](./DOMAIN-DESIGNER-FEATURES-AND-USAGE.md)
- Linear: [JUM-483](https://linear.app/jumentix/issue/JUM-483/feature-canadesignerstore-idesignerstore-adapter-over-the-cana-client), [JUM-484](https://linear.app/jumentix/issue/JUM-484/feature-one-way-migration-of-service-managementv1-from-localstorage-to), [JUM-485](https://linear.app/jumentix/issue/JUM-485/feature-write-event-integration-multi-tab-sync-via-cana-message), [JUM-486](https://linear.app/jumentix/issue/JUM-486/test-offlineonline-matrix-for-designer-persistence-on-cana), [JUM-547](https://linear.app/jumentix/issue/JUM-547/feature-full-suite-exportimport-carry-interfaces-service-configuration), [JUM-626](https://linear.app/jumentix/issue/JUM-626/fix-announce-load-time-storage-corruption-recovery-in-the-boot-ui), Cana [JUM-418](https://linear.app/jumentix/issue/JUM-418/docs-document-cana-architecture-api-migration-and-offline-examples), [JUM-560](https://linear.app/jumentix/issue/JUM-560/feature-storage-quota-persistence-and-eviction-policy), [JUM-411](https://linear.app/jumentix/issue/JUM-411/fix-implement-worker-crash-recovery-and-state-resynchronization), [JUM-415](https://linear.app/jumentix/issue/JUM-415/feature-define-offline-conflicts-migrations-and-data-durability-policy), [JUM-413](https://linear.app/jumentix/issue/JUM-413)
