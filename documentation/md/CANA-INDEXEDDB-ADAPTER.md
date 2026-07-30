# Cana — IndexedDB Offline Database Adapter

`@jumentix/cana` is a first-party IndexedDB engine for offline-first Jumentix
applications. It is not a wrapper around an existing library, and it does not
fall back to another store when IndexedDB is unavailable.

This document records what it does, what it deliberately refuses to do, and —
most importantly — **what has not been proven yet**. That last section is not an
appendix. An offline database that overstates its guarantees is worse than one
that has none, because the application built on it will make promises to users
that it cannot keep.

---

## 1. The decision that shapes everything: no fallback

If IndexedDB is unavailable — private browsing in some browsers, a hostile
environment, storage disabled — Cana reports `Unavailable` and stops. It does
not silently fall back to `localStorage`, memory, or a cookie jar.

This is deliberate, and it is the decision most likely to be questioned, so the
reasoning is recorded here rather than in a commit message:

A fallback store has different durability, different capacity, and different
transactional semantics. An application that silently receives one instead of
the other keeps working, keeps accepting writes, and keeps telling the user
their work is saved — until the tab closes and the data was in memory, or the
5 MB `localStorage` quota is hit halfway through an import. The failure surfaces
far from its cause and is indistinguishable from data loss.

Reporting `Unavailable` is a worse user experience on the day it happens and a
much better one every day after.

The consequence is that **`exportAll()` is part of the contract, not a
convenience**. Under no-fallback, an application's own export is the only
recovery path a user has.

---

## 2. Architecture

```
contracts.ts     the frozen boundary — no IndexedDB type crosses it
  errors.ts      DOMException -> CanaError translation
  schema.ts      validation and non-destructive application
  storage.ts     eviction detection, quota observation
  database.ts    open / upgrade / close / delete
  transaction.ts commit boundary, three-state outcome, event buffering
  query.ts       planning and cursor execution
  table.ts       CRUD and bulk
  hooks.ts       beforeWrite / afterCommit / afterRollback
  client.ts      assembles the above into CanaClient
  reconciliation.ts  the operation ledger, resolving `unknown`
  protocol.ts    worker message contracts and the request router
  durability-policy.ts  what the app may tell its user
```

### Everything is plain data

`CanaError` is not an `Error` subclass. `CanaChangeEvent` is not a class. This
follows from a property that is **measured, not assumed** — there is a test
asserting it:

> A record read back from IndexedDB does not carry the reading realm's
> `Object.prototype`. It is a structured clone.

Class identity does not survive the round trip, nor the worker boundary. Any
`instanceof` check against stored or transferred data silently starts returning
`false`. So the discriminant is a field: `canaError: true`, checked by
`isCanaError()`.

---

## 3. The behaviours that are decisions

Each of these is a case where the obvious implementation is the wrong one.

### 3.1 Three write outcomes, not two

`CanaWriteOutcome` is `committed | rolled-back | unknown`.

`unknown` covers a transaction torn down without either `complete` or `abort`
firing — a killed worker, a closed tab, a browser force-quit mid-flush. A
two-state result forces that case to be reported as one of the two things it is
not, and a caller reconciling afterwards then either loses a committed write or
duplicates one.

### 3.2 `unknown` is resolvable, not just honest

Reporting ambiguity is better than lying about it, but the ambiguity still has
to be resolved. With `operationLedger: true`, the operation id is written **into
the same transaction as the data**. IndexedDB guarantees transaction atomicity,
so the store cannot commit one without the other, and afterwards:

| ledger state | meaning |
|---|---|
| id present | the write committed |
| id absent, attempted inside the horizon | it did not commit |
| id absent, attempted before the horizon | `unresolvable` — the record may have been pruned |

The third row matters. Collapsing `unresolvable` into `rolled-back` would tell a
caller to safely retry a write that already landed.

```ts
const outcome = await client.resolveWrite(correlationId, attemptedAt);
```

### 3.3 Change events are buffered until commit

Events are collected during a transaction and released only after `oncomplete`.
Emitting as writes happen would announce changes that a later abort rolls back,
and a subscriber that already acted on a phantom event cannot be told to un-act.

### 3.4 Schema application is additive, never destructive

A store present in the database but absent from the schema is **left alone**.
`deleteObjectStore` destroys user data irreversibly; doing it automatically
because a store disappeared from a schema literal means a typo deletes a table.
Removal is an explicit migration, never an inference.

### 3.5 `update` does not insert

`update(key, changes)` on a missing key fails with `NotFound`. An upsert wearing
an update's name resurrects records another tab deleted. `put` is available for
callers who mean upsert.

### 3.6 The engine owns the transaction boundary

There is no `commit()`. An IndexedDB transaction auto-commits as soon as the
event loop yields with no pending request, so `await fetch(...)` inside a scope
does not pause the transaction — it *ends* it. Exposing `commit()` would imply
control over a lifetime the caller does not have.

**The usage rule:** awaiting an IndexedDB request inside a transaction is safe
(its promise resolves in a microtask, before the task yields). Awaiting anything
else is fatal. Cana reports the violation as `TransactionInactive` with a
message that says so.

### 3.7 In-transaction hooks are synchronous by signature

`beforeWrite` returns a value, never a promise, for the reason above. There is
also a runtime guard, because JavaScript callers have no compiler.

A hook **cannot swallow a failure** — there is no `onError` returning a
substitute result. Throwing from `beforeWrite` vetoes the write and aborts the
transaction. `afterCommit` receives frozen events and a throw there does not
fail the call: the data is already on disk.

### 3.8 Queries publish their plan

```ts
const { records, plan } = await table.explain({ index: 'byOwner', equals: 'ana' });
// plan.usedIndex === 'byOwner', plan.fullScan === false
```

An implementation that reads everything into an array and filters it passes
every correctness test and collapses at 100k rows. `explain()` makes "used the
index" and "applied the offset in the cursor" assertable rather than a matter of
trust.

### 3.9 Eviction is not a first run

An evicted database and a brand-new one both open empty. Cana writes a
`localStorage` tombstone **as a marker only, never as a fallback store** — so a
later empty open is recognisable as loss. Where no tombstone can be written the
verdict is `undetectable-no-tombstone`, which is reported as itself rather than
as "not evicted".

### 3.10 Durability is never rounded up

`persistent: 'unknown'` is **not** `durable`. `assessDurability()` returns
`lost | at-risk | best-effort | durable`, and `'unknown'` maps to `best-effort`
with a message saying persistence could not be confirmed — distinct from
`false`, which says the browser refused. Neither is a guarantee.

`requestPersistenceOnOpen` defaults to `false`: a persistence prompt fired by a
library at an arbitrary moment is one the user denies, and some browsers make
that denial sticky for the origin.

---

## 4. Usage

```ts
import { createClient } from '@jumentix/cana';

const client = createClient({
  name: 'designer',
  schema: {
    version: 1,
    stores: [
      { name: 'designs', keyPath: 'id', indexes: [{ name: 'byOwner', keyPath: 'owner' }] }
    ]
  },
  operationLedger: true
});

await client.open();

await client.table('designs').add({ id: 1, name: 'first', owner: 'ana' });

const { outcome, events } = await client.transaction(
  'readwrite',
  ['designs'],
  async (scope) => {
    await scope.table('designs').put({ id: 2, name: 'second', owner: 'bruno' });
  }
);

const stop = client.subscribe((event) => console.log(event.type), { sinceCursor: 0 });

const health = await client.durabilityAssessment();
if (health.level === 'lost') {
  // Tell the user. Do NOT show an empty app that looks like a fresh install.
}
```

---

## 5. What is NOT proven

Stated plainly, because the tests that exist could otherwise be mistaken for
more coverage than they represent.

| Area | Status |
|---|---|
| Correctness of lifecycle, CRUD, queries, transactions, events, hooks, ledger | **Tested** — 106 tests against a real IndexedDB implementation (`fake-indexeddb`) |
| Cross-browser behaviour (Chrome, Safari, Firefox) | **Not tested.** `fake-indexeddb` is not a browser. JUM-417 |
| The `Unavailable` / private-browsing path | **Not tested.** The shim is installed ambiently, so the global is always present |
| Query performance | **Not measured.** `explain()` proves the index was opened, not that it is fast. JUM-561 |
| Real quota and eviction | **Not tested.** `navigator.storage` is not implemented by the shim; the policy is tested against constructed states |
| Running inside a real Worker | **Not tested.** The router is tested over a fake port. There is no worker host yet |
| A genuinely killed worker reaching `unknown` | **Not tested.** The ledger resolves correctly *given* a committed or rolled-back transaction; the engine reaching `unknown` in the first place is unproven |

### On Dexie (JUM-399 — closed)

Cana is an independent implementation. It shares no code with Dexie, and no
Dexie source is vendored, bundled or referenced by this package.

The project owner has determined that no licensing restriction applies to Cana
and closed JUM-399 on that basis. This is recorded as the owner's decision; it
is not a legal analysis by the engineering agent that wrote this code, which is
not qualified to give one.

If Dexie is ever used for comparison — the differential harness in JUM-561 is the
one planned case — it enters as an ordinary dev-time dependency under its own
Apache-2.0 terms, and nothing from it is copied into this package.

## 6. Related requirements

- Requirement `015`/`016` — hexagonal boundaries
- Requirement `065` — fail-closed, no false greens
- Requirement `076` — bilingual documentation
- Requirement `094` — epic documentation completion gate
- `.agents/NFR-REGISTRY.md` — durability and performance NFRs

Portuguese: [CANA-INDEXEDDB-ADAPTER.pt-BR.md](./CANA-INDEXEDDB-ADAPTER.pt-BR.md)
