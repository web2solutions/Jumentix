# Cana — Usage Guide

Complete API reference and task-oriented guide for `@jumentix/cana`.

The topic coverage here follows what a working IndexedDB library has to document
— getting started, schema and versioning, CRUD, querying, transactions, hooks,
change notification, errors, storage limits, workers, testing, and troubleshooting.
Dexie's documentation was used as a checklist of *which subjects to cover*; every
word, example and API here is Cana's own.

For the design rationale behind these behaviours, see
[CANA-INDEXEDDB-ADAPTER.md](./CANA-INDEXEDDB-ADAPTER.md). This document is about
using it. Portuguese: [CANA-USAGE-GUIDE.pt-BR.md](./CANA-USAGE-GUIDE.pt-BR.md).

---

## Responsibility in context

- **Stack layer:** offline / browser persistence adapter
- **Owns:** IndexedDB (with explicit localStorage fallback) for offline apps
- **Used with:** designer-core and SPA/PWA guide
- **Not responsible for:** server databases, Redis KV, or REST/WebSocket protocols

## Table of contents

1. [Getting started](#1-getting-started)
2. [Schema and versioning](#2-schema-and-versioning)
3. [Keys](#3-keys)
4. [Reading and writing](#4-reading-and-writing)
5. [Bulk operations](#5-bulk-operations)
6. [Querying](#6-querying)
7. [Transactions](#7-transactions)
8. [Change events](#8-change-events)
9. [Hooks](#9-hooks)
10. [Errors](#10-errors)
11. [Storage, quota and eviction](#11-storage-quota-and-eviction)
12. [Crash recovery](#12-crash-recovery)
13. [Export and import](#13-export-and-import)
14. [Using it with the Jumentix client factory](#14-using-it-with-the-jumentix-client-factory)
15. [Workers](#15-workers)
16. [Testing your own code](#16-testing-your-own-code)
17. [Troubleshooting](#17-troubleshooting)
18. [API reference](#18-api-reference)
19. [Glossary](#19-glossary)
20. [Junior checklist](#20-junior-checklist-i-can--)
21. [Common errors (quick reference)](#21-common-errors-quick-reference)
22. [Next step](#22-next-step)

---

## 1. Getting started

```bash
bun add @jumentix/cana
```

```ts
import { createClient } from '@jumentix/cana';

const client = createClient({
  name: 'designer',
  schema: {
    version: 1,
    stores: [
      {
        name: 'designs',
        keyPath: 'id',
        indexes: [
          { name: 'byOwner', keyPath: 'owner' },
          { name: 'byUpdatedAt', keyPath: 'updatedAt' }
        ]
      }
    ]
  }
});

await client.open();
```

**`open()` is not implicit.** No operation opens the database for you. An
implicit open would hide a schema upgrade — potentially a long, blocking one —
behind an unrelated call like `get()`. Calling a table before `open()` resolves
fails with `InvalidRequest`.

`open()` is idempotent; calling it twice is a no-op.

### Typing your records

Pass the record type at the call site:

```ts
interface Design {
  id: number;
  name: string;
  owner: string;
  updatedAt: number;
}

const designs = client.table<Design>('designs');
const one = await designs.get(1);   // Design | undefined
```

To type the key as well:

```ts
const designs = client.table<Design, number>('designs');
```

---

## 2. Schema and versioning

A schema is plain data:

```ts
const schema = {
  version: 2,
  stores: [
    { name: 'designs', keyPath: 'id', indexes: [{ name: 'byOwner', keyPath: 'owner' }] },
    { name: 'drafts', autoIncrement: true },
    { name: 'members', keyPath: ['tenantId', 'userId'] }
  ]
};
```

### Upgrading

Raise `version` and change `stores`. IndexedDB applies schema changes **only**
when the version increases — this is the single most common source of "my change
did nothing".

```ts
// v1
{ version: 1, stores: [{ name: 'designs', keyPath: 'id' }] }

// v2 — adds a store and an index
{
  version: 2,
  stores: [
    { name: 'designs', keyPath: 'id', indexes: [{ name: 'byOwner', keyPath: 'owner' }] },
    { name: 'deployments', keyPath: 'id' }
  ]
}
```

### What an upgrade will and will not do

| Change | Applied automatically? |
|---|---|
| New store | Yes |
| New index on any store | Yes |
| Store missing from the schema | **No — left in place** |
| Index definition changed | **No — left as it is** |
| `keyPath` or `autoIncrement` changed | **No** |

Stores are never dropped automatically. `deleteObjectStore` is irreversible, and
doing it because a store vanished from a schema literal means one typo deletes a
user's table. Removal is an explicit migration you write.

An index that already exists is left alone even if its definition changed.
Recreating it would rebuild the whole index inside the upgrade transaction,
which on a large store is a long block. Rename the index to force a rebuild.

### Downgrades are refused

Opening version 2 against a database written at version 3 fails with
`UpgradeFailed` and a message naming both versions. This happens routinely when
a user has two tabs open across a deploy.

### Validation happens before anything is touched

`validateSchema` runs first, and rejects:

- a non-positive or non-integer `version`
- a schema with no stores
- duplicate store or index names
- an empty `keyPath`, or an empty segment in a compound one
- **`multiEntry` combined with a compound `keyPath`** — IndexedDB forbids this,
  and reports it from inside the upgrade transaction where it reads as a broken
  migration rather than a bad schema

```ts
import { validateSchema } from '@jumentix/cana';

const problems = validateSchema(schema);   // readonly string[]; empty means fine
```

---

## 3. Keys

IndexedDB has two key shapes, and mixing them up is a common source of confusion.

| Shape | Declaration | Supplying the key |
|---|---|---|
| Inbound | `keyPath: 'id'` | Inside the record |
| Inbound, generated | `keyPath: 'id', autoIncrement: true` | Inside the record, or omitted |
| Outbound | no `keyPath` | As the second argument |
| Outbound, generated | `autoIncrement: true` | Omitted |

```ts
// Inbound: the key lives in the record
await client.table('designs').add({ id: 1, name: 'a' });

// Outbound: the key is supplied alongside
await client.table('cache').put({ body: '...' }, 'https://example.com/x');
```

Passing an explicit key to an inbound store fails with `InvalidRequest` and a
message naming the store's `keyPath`. IndexedDB's own error for this is a bare
`DataError` that does not say why.

`keyStrategyOf(store)` returns `inbound | generated-inbound | outbound |
generated-outbound` if you need to branch on it.

### Valid key types

`number`, `string`, `Date`, `ArrayBuffer`, `ArrayBufferView`, and arrays of
those (compound keys). `CanaKey` is Cana's own type rather than `IDBValidKey`, so
no IndexedDB type crosses the boundary.

Compound keys sort left to right:

```ts
{ name: 'members', keyPath: ['tenantId', 'userId'] }
await table.get(['acme', 42]);
```

---

## 4. Reading and writing

```ts
const designs = client.table<Design>('designs');

await designs.get(1);                          // Design | undefined
await designs.add({ id: 1, name: 'first' });   // fails if the key exists
await designs.put({ id: 1, name: 'replaced' }); // insert or replace
await designs.update(1, { name: 'renamed' });  // merge into an existing record
await designs.delete(1);
await designs.clear();
```

### `add` vs `put` vs `update`

| Call | Key exists | Key does not exist |
|---|---|---|
| `add` | `ConstraintViolation` | inserts |
| `put` | replaces the whole record | inserts |
| `update` | merges the given fields | **`NotFound`** |

`update` does not insert. An upsert wearing an update's name resurrects records
another tab deleted, and the resurrected row lacks whatever fields the rest of
the schema expects. Use `put` when you mean upsert.

`update` is a read-modify-write **inside one transaction**, so two tabs updating
different fields of the same record do not lose each other's changes.

### The result

Every write returns:

```ts
{
  outcome: 'committed' | 'rolled-back' | 'unknown',
  key?: CanaKey,
  events: readonly CanaChangeEvent[]
}
```

`events` is populated only when `outcome === 'committed'`.

### Deleting a key that is not there

Succeeds, and emits **no** event. IndexedDB deletes a missing key silently;
announcing it anyway would tell subscribers a record vanished that never existed.

---

## 5. Bulk operations

```ts
await designs.bulkAdd([{ id: 1, name: 'a' }, { id: 2, name: 'b' }]);
await designs.bulkPut([{ id: 1, name: 'changed' }, { id: 3, name: 'new' }]);
await designs.bulkDelete([1, 2]);
```

Bulk writes are **atomic**: one row failing rolls the whole batch back. The
alternative — committing rows 1..k and reporting an error — leaves you with no
way to know how far it got.

```ts
{
  outcome: 'committed',
  keys: readonly CanaKey[],       // in input order
  failedAt?: readonly number[],   // indices within the input
  events: readonly CanaChangeEvent[]
}
```

Rows are written sequentially so `keys` and `failedAt` line up with your input.

`bulkPut` reports each row as `created` or `updated` according to what actually
happened, matching single `put`. On an outbound store with no key to probe with,
every row reports `created`.

---

## 6. Querying

```ts
// Everything
await designs.query();

// By index, exact match
await designs.query({ index: 'byOwner', equals: 'ana' });

// Range
await designs.query({ index: 'byUpdatedAt', range: { lower: start, upper: end } });

// Half-open range
await designs.query({ index: 'byUpdatedAt', range: { lower: start, upperOpen: true } });

// Reverse, limited
await designs.query({ index: 'byUpdatedAt', direction: 'prev', limit: 20 });

// Pagination
await designs.query({ index: 'byUpdatedAt', offset: 40, limit: 20 });

// Unique values only
await designs.query({ index: 'byOwner', distinct: true });
```

### `CanaQuery`

| Field | Meaning |
|---|---|
| `index` | Read through this index instead of the primary key |
| `equals` | Exact key match |
| `range` | `{ lower, upper, lowerOpen, upperOpen }` |
| `direction` | `next` (default), `prev`, `nextunique`, `prevunique` |
| `offset` | Records to skip, applied by advancing the cursor |
| `limit` | Maximum to return; the cursor stops there |
| `distinct` | Shorthand for a `*unique` direction |

`equals` takes precedence over `range` when both are given.

### Counting

```ts
await designs.count();                                   // all
await designs.count({ index: 'byOwner', equals: 'ana' }); // matching
```

`count` uses IndexedDB's native count — one request, no records read. A query
carrying `offset` or `limit` cannot be counted natively, so it falls back to the
cursor. It still agrees with `query` on the same input.

### `explain` — checking that an index was used

```ts
const { records, plan } = await designs.explain({ index: 'byOwner', equals: 'ana' });

plan.usedIndex             // 'byOwner'
plan.fullScan              // false
plan.boundedByRange        // true
plan.appliedOffsetInCursor // false
```

`fullScan` is true only when nothing narrows the read: no index and no bound.
That is the case that degrades with data volume rather than with query
complexity, so it is worth asserting against in your own tests:

```ts
it('does not full-scan the designs table', async () => {
  const { plan } = await designs.explain({ index: 'byOwner', equals: currentUser });
  expect(plan.fullScan).toBe(false);
});
```

### What Cana does not do

There is no expression-based `.filter(record => ...)`. Filtering in JavaScript
after reading every record is the failure mode `explain()` exists to make
visible, so it is not offered as a first-class operation. Read a bounded set and
filter it yourself, deliberately:

```ts
const recent = await designs.query({ index: 'byUpdatedAt', range: { lower: since } });
const mine = recent.filter((design) => design.owner === me);
```

There are also no joins. Read from each store inside one transaction.

---

## 7. Transactions

```ts
const { outcome, result, events, correlationId, attemptedAt } =
  await client.transaction('readwrite', ['designs', 'deployments'], async (scope) => {
    const design = await scope.table<Design>('designs').get(1);
    await scope.table('deployments').add({ id: 9, designId: design.id });
    return design;
  });
```

Everything in the body commits together or not at all.

### The one rule

> **Never `await` anything except an IndexedDB request inside a transaction.**

An IndexedDB transaction auto-commits as soon as the event loop yields with no
pending request against it. So this does not pause the transaction — it *ends*
it:

```ts
// WRONG
await client.transaction('readwrite', ['designs'], async (scope) => {
  const remote = await fetch('/api/design/1');   // ← transaction ends here
  await scope.table('designs').put(await remote.json());  // TransactionInactive
});
```

```ts
// RIGHT — fetch first, then open the transaction
const remote = await (await fetch('/api/design/1')).json();
await client.transaction('readwrite', ['designs'], async (scope) => {
  await scope.table('designs').put(remote);
});
```

Awaiting a Cana table call is safe: its promise resolves in a microtask from the
IndexedDB success handler, before the task yields.

There is no `commit()`. Exposing one would suggest you control a lifetime you do
not control.

### Aborting

```ts
await client.transaction('readwrite', ['designs'], async (scope) => {
  await scope.table('designs').add({ id: 1, name: 'a' });
  scope.abort('the user cancelled');
});
```

Rejects with `TransactionAborted` carrying your reason. Nothing is written, and
**no events are emitted** — a subscriber must never see a change that was rolled
back, because it cannot be told to un-see it.

Throwing from the body has the same effect.

### Scope

Name every store you will touch. Touching one outside the scope fails. Read-only
transactions can run concurrently; `readwrite` transactions over overlapping
stores are serialised by the browser.

---

## 8. Change events

```ts
const stop = client.subscribe((event) => {
  console.log(event.type, event.store, event.key);
});

stop();  // unsubscribe
```

### `CanaChangeEvent`

| Field | Meaning |
|---|---|
| `type` | `created` \| `updated` \| `deleted` \| `cleared` |
| `store` | Store name |
| `key` | Key affected; absent for `cleared` |
| `record` | The written record; absent for `deleted` and `cleared` |
| `cursor` | Monotonic sequence number |
| `correlationId` | Shared by every event from one transaction |
| `at` | Epoch milliseconds |
| `originId` | Identifies the writing client |

Events are published **only for committed writes**, after durability.

### Ignoring your own writes

```ts
const client = createClient({ ..., originId: 'tab-a' });
client.subscribe((event) => {
  if (event.originId === 'tab-a') return;   // our own echo
  applyRemoteChange(event);
});
```

### Ordering and isolation

Listeners run in registration order. A listener that throws does not stop the
others and does not lose the event — one broken subscriber must not become a
database-wide inconsistency reported far from its cause.

### Resuming after a gap

```ts
let lastSeen = loadCursorFromSomewhere();

const stop = client.subscribe(
  (event) => { apply(event); lastSeen = event.cursor; },
  { sinceCursor: lastSeen }
);
```

Events since that cursor are replayed synchronously before `subscribe` returns.

If the requested cursor has fallen out of the retained window, `subscribe`
**throws `NotFound`** rather than replaying what remains. A partial replay would
look complete and silently omit the middle. Reload from the database instead:

```ts
try {
  client.subscribe(apply, { sinceCursor: lastSeen });
} catch (error) {
  if (isCanaErrorCode(error, 'NotFound')) {
    await reloadEverything();
    client.subscribe(apply);
  }
}
```

The window defaults to 1000 events; set `retainedEvents` to change it. It is
bounded because an unbounded history is a memory leak in a long-lived tab.

---

## 9. Hooks

```ts
const client = createClient({
  name: 'designer',
  schema,
  hooks: {
    beforeWrite: (context) => ({ ...(context.record as Design), updatedAt: Date.now() }),
    afterCommit: (events) => telemetry.record(events.length),
    afterRollback: (outcome, reason) => telemetry.warn(outcome, reason)
  }
});
```

### `beforeWrite(context) => replacement | void`

Runs inside the transaction, before the write is issued.

- Return a record to **transform** what is written.
- Return nothing to leave it unchanged.
- **Throw to veto**: the transaction aborts and nothing is written.

`context` is `{ store, type, key?, record?, correlationId }`.

**It must be synchronous.** The signature enforces this, and a returned promise
is rejected at runtime with an explanation — because awaiting anything here
would have already closed the transaction's auto-commit window.

It does not run for `delete`, which carries no record.

### `afterCommit(events) => void`

Runs after the data is durable, with **frozen** events. It cannot rewrite
history for subscribers that have not run yet, and a throw does not fail the
call — the write is on disk, and reporting otherwise causes duplicate writes on
retry.

### `afterRollback(outcome, reason) => void`

`outcome` is `'rolled-back'` or `'unknown'`. They are kept distinct because only
the second needs reconciliation.

### What hooks cannot do

There is no `onError` returning a substitute result. A hook may veto loudly; it
may not observe a failure and report success in its place.

---

## 10. Errors

Errors are **plain data with a discriminant**, not `Error` subclasses, because
structured clone strips prototypes across storage and worker boundaries — an
`instanceof` check would silently start returning `false`.

```ts
import { isCanaError, isCanaErrorCode } from '@jumentix/cana';

try {
  await designs.add(record);
} catch (error) {
  if (isCanaErrorCode(error, 'QuotaExceeded')) {
    await freeSomeSpace();
  } else if (isCanaErrorCode(error, 'ConstraintViolation')) {
    showDuplicateMessage();
  } else if (isCanaError(error)) {
    report(error.code, error.message, error.cause);
  }
}
```

### `CanaError`

```ts
{
  canaError: true,
  code: CanaErrorCode,
  message: string,
  retryable: boolean,
  store?: string,
  key?: CanaKey,
  cause?: string
}
```

### Codes

| Code | Meaning | Retryable |
|---|---|---|
| `Unavailable` | No usable store after IndexedDB and configured fallback both failed | no |
| `QuotaExceeded` | Storage budget exhausted; the write did not happen | **no** |
| `Evicted` | A database that existed is gone | no |
| `UpgradeFailed` | Upgrade did not complete, or a downgrade was refused | no |
| `UpgradeBlocked` | Another connection is holding a version change | **yes** |
| `ConstraintViolation` | Uniqueness rejected the write | no |
| `NotFound` | No such key, index, or replayable cursor | no |
| `TransactionAborted` | Aborted by the caller or the engine | **yes** |
| `TransactionInactive` | The auto-commit window closed — see §7 | no |
| `Cancelled` | Cancelled by the caller | no |
| `Backpressure` | A bounded queue refused rather than growing | **yes** |
| `UnknownOutcome` | The outcome cannot be determined — see §12 | no |
| `InvalidRequest` | Malformed request, rejected before storage | no |
| `Internal` | Unclassified; `cause` carries the original | no |

`QuotaExceeded` is deliberately **not** retryable: retrying a write that did not
fit will not make it fit, and marking it retryable invites a loop that burns
battery and never converges. Freeing space is a different operation.

---

## 11. Storage, quota and eviction

### Asking what state you are in

```ts
const health = await client.durabilityAssessment();

health.level               // 'lost' | 'at-risk' | 'best-effort' | 'durable'
health.evictionDetectable  // false when a wipe would be invisible
health.summary             // plain language, suitable for a user
health.advice              // readonly string[]
```

| Level | Meaning | What to do |
|---|---|---|
| `lost` | Data was there and is gone | **Tell the user.** Do not show an empty app that looks like a fresh install |
| `at-risk` | Close to quota; the browser may evict | Free space, export anything critical |
| `best-effort` | Not persistent, or unconfirmable | Treat local data as a cache |
| `durable` | Persistent storage granted | Nothing |

`requiresUserAttention(level)` is true for `lost` and `at-risk`.

### `'unknown'` is not `durable`

`storageState().persistent` is `true`, `false`, or `'unknown'`. The third means
the Storage API is unavailable — which is not evidence of durability. It maps to
`best-effort`, with a message distinguishing "the browser refused" from "we
cannot tell".

### Requesting persistence

```ts
await client.storageState();   // check first

const client = createClient({
  ...,
  durabilityPolicy: { requestPersistenceOnOpen: true }
});
```

Defaults to **off**. Some browsers prompt the user, and a prompt fired by a
library at an arbitrary moment is one the user denies — a denial the origin may
be stuck with. Ask at a moment your user will understand.

### Eviction detection

An evicted database and a brand-new one both open empty. Cana writes a
`localStorage` tombstone — **as a marker only, never as a fallback store** — so a
later empty open is recognisable as loss.

Where no tombstone can be written (private browsing throws on `localStorage` in
some browsers), `evictionDetectable` is `false`. This is reported rather than
being papered over as "not evicted".

```ts
const health = await client.durabilityAssessment();
if (health.level === 'lost') {
  showDataLossNotice(health.summary);
  await resyncFromServer();          // if you have one
}
```

---

## 12. Crash recovery

Writes have **three** outcomes, not two:

```ts
type CanaWriteOutcome = 'committed' | 'rolled-back' | 'unknown';
```

`unknown` means a transaction was torn down without either completing or
aborting observably — a killed worker, a closed tab, a browser force-quit
mid-flush. Reporting it as failure risks a duplicate write on retry; reporting it
as success risks claiming data that was never written.

### Making it resolvable

```ts
const client = createClient({ name: 'designer', schema, operationLedger: true });
```

The operation id is then written **into the same transaction as the data**, so
IndexedDB's own atomicity guarantees they commit together.

```ts
const { outcome, correlationId, attemptedAt } = await client.transaction(...);

if (outcome === 'unknown') {
  await persistPendingOperation({ correlationId, attemptedAt });   // survive the crash
}

// After restarting:
const verdict = await client.resolveWrite(correlationId, attemptedAt);
// 'committed'    → done; do not retry
// 'rolled-back'  → safe to retry
// 'unresolvable' → the evidence was pruned; reconcile from your own data
```

`unresolvable` is separate from `rolled-back` on purpose. Both look like "the id
is not there", but one means the write definitely did not happen and the other
means the record aged out. Collapsing them would tell you to safely retry a write
that already landed.

### Enabling it on an existing database

The ledger adds a store, so **you must raise the schema version**. Turning it on
without doing so fails at `open()` with `UpgradeFailed` and a message saying to
raise the version — rather than silently recording nothing.

### Pruning

```ts
import { pruneLedger, DEFAULT_LEDGER_HORIZON_MS } from '@jumentix/cana';

await pruneLedger(database, { horizonMs: DEFAULT_LEDGER_HORIZON_MS });  // default 24h
```

A bounded range delete over a time index, not a scan.

### Cost

One extra request per write transaction. It is off by default because it only
pays for itself where a worker or tab can actually die mid-write.

---

## 13. Export and import

Under the no-fallback decision, your own export is the only recovery path a user
has — so it is part of the contract, not a utility.

```ts
const dump = await client.exportAll();
// { designs: [...], deployments: [...] }

const blob = new Blob([JSON.stringify(dump)], { type: 'application/json' });
```

Importing is your own code, so you control conflict resolution:

```ts
async function importAll(dump: Record<string, readonly unknown[]>) {
  const stores = Object.keys(dump);
  await client.transaction('readwrite', stores, async (scope) => {
    for (const store of stores) {
      await scope.table(store).bulkPut(dump[store]);
    }
  });
}
```

Offer export somewhere a user can reach it, especially when
`durabilityAssessment()` reports `at-risk`.

---

## 14. Using it with the Jumentix client factory

Jumentix supports applications that are **100% offline with no backend at all**.
For those, IndexedDB is not an exception case — it is the database, and
`'IndexedDB'` is a first-class driver.

```ts
import { buildDatabaseClientCompilers } from '@jumentix/database-client-factory';
import { createCanaDatabaseClient } from '@jumentix/cana';

const compilers = buildDatabaseClientCompilers<IDatabaseClient>({
  inMemoryClient: InMemoryDbClient,
  indexedDbClient: () => createCanaDatabaseClient({ name: 'designer', schema })
});
```

Then select it like any other driver — `JUMENTIX_DATABASE_DRIVER=IndexedDB`, or
`compileDatabaseClientByDriver('IndexedDB')`. The aliases `indexeddb`,
`indexed-db` and `cana` all resolve.

It is **injected** rather than imported so that server-side processes building a
Mongo client do not pull a browser-only package into their dependency graph.

Selecting it without wiring `indexedDbClient`, or in a runtime with no
`indexedDB` global, throws with an explanation. It does **not** fall back to
in-memory: an offline app silently running on a store that vanishes with the tab
would look healthy and lose everything.

### The adapter shape

```ts
const database = createCanaDatabaseClient({ name: 'designer', schema });

await database.connect();               // opens
database.stores.designs                 // CanaTable, keyed by schema store names
database.cana                           // the full client, for transactions etc.
database.subscribe(listener);
await database.disconnect();
```

`stores` is derived from the schema, so the two cannot disagree.

---

## 15. Workers

`@jumentix/cana` provides the message contracts and the request router for
running the engine in a worker.

```ts
import { createRouter } from '@jumentix/cana';

const router = createRouter({
  port: worker,
  timeoutMs: 15_000,
  onBroadcast: (event) => applyChange(event)
});

const rows = await router.send({ kind: 'query', store: 'designs' });
```

- Requests carry ids; responses are paired by id, never by arrival order.
- A timed-out **write** rejects with `UnknownOutcome` — it may have committed, so
  resolve it against the ledger rather than retrying blind.
- A timed-out **read** rejects with `Unavailable`; it changed nothing.
- `router.abandonAll(reason)` fails everything in flight, for a worker known to
  be gone.
- Payloads must be structured-cloneable. Functions and class instances reject
  with `InvalidRequest`, and that request never reached the worker.

> **Status:** the protocol and router are implemented and tested; a worker host
> that runs the engine inside a real `Worker` is not yet part of this package.

---

## 16. Testing your own code

Cana takes an `IDBFactory`, so tests need no browser:

```bash
bun add -d fake-indexeddb
```

```ts
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { createClient } from '@jumentix/cana';

function testClient() {
  // A fresh factory per test, so no database state leaks between them.
  return createClient({ name: 'designer', schema, factory: new IDBFactory() });
}
```

Inject durability to control eviction and quota:

```ts
import { StorageDurability } from '@jumentix/cana';

const durability = new StorageDurability({
  estimate: async () => ({ usage: 95, quota: 100 }),   // near quota
  persisted: async () => true
});

const client = createClient({ ..., durability });
```

Note what `fake-indexeddb` does **not** give you: real quota, real eviction, real
`navigator.storage`, or real cross-browser behaviour. Test your logic against it;
do not conclude your app handles a full disk.

---

## 17. Troubleshooting

**`TransactionInactive`, and the line looks fine**
You awaited something that is not an IndexedDB request inside the transaction.
See §7. Move the foreign await outside the scope.

**My schema change did nothing**
You did not raise `version`. IndexedDB applies changes only when it increases.

**My store disappeared from the schema but is still in the database**
By design. Stores are never dropped automatically — write an explicit migration.

**My index change did not take effect**
Existing indexes are left as they are. Rename it to force a rebuild.

**`UpgradeBlocked`**
Another tab holds the old version. Listen for `versionchange` in the other tab
and close there. It is `retryable`.

**Everything reports `Unavailable`**
IndexedDB failed and the localStorage fallback could not open either (or
`fallback: false` was set). Check `client.backend` after a successful open —
`'localStorage'` means degraded mode is already active.

**Eviction is never detected**
`evictionDetectable` is `false` when no tombstone can be written. Check
`durabilityAssessment()`.

**`resolveWrite` always says `unresolvable`**
`operationLedger` is off, or was enabled without raising the schema version — the
latter now fails loudly at `open()`.

**`bulkPut` reported `created` for a row I expected to be an update**
On an outbound store there is no key to probe with, so every row reports
`created`.

**A query is slow**
Call `explain()`. If `fullScan` is true, add an index or a range.

---

## 18. API reference

### `createClient(options): Client`

| Option | Type | Default | Meaning |
|---|---|---|---|
| `name` | `string` | — | Database name |
| `schema` | `CanaSchema` | — | Version and stores |
| `factory` | `IDBFactory` | global | Injected for tests |
| `durability` | `StorageDurability` | browser environment | Injected for tests |
| `retainedEvents` | `number` | `1000` | Replayable event window |
| `originId` | `string` | random | Identifies this client in events |
| `hooks` | `CanaHooks` | — | See §9 |
| `durabilityPolicy` | `DurabilityPolicy` | see §11 | Persistence behaviour |
| `operationLedger` | `boolean` | `false` | See §12 |

### `Client`

| Member | Returns |
|---|---|
| `name` / `version` | `string` / `number` |
| `open()` / `close()` | `Promise<void>` |
| `table<T, K>(name)` | `CanaTable<T, K>` |
| `transaction(mode, stores, body)` | `Promise<CanaTransactionResult<T>>` |
| `subscribe(listener, options?)` | `() => void` |
| `storageState()` | `Promise<CanaStorageState>` |
| `durabilityAssessment()` | `Promise<DurabilityAssessment>` |
| `resolveWrite(correlationId, attemptedAt, options?)` | `Promise<ResolvedOutcome>` |
| `exportAll()` | `Promise<Record<string, readonly unknown[]>>` |

### `CanaTable<TRecord, TKey>`

| Method | Returns |
|---|---|
| `get(key)` | `Promise<TRecord \| undefined>` |
| `add(record, key?)` / `put(record, key?)` | `Promise<CanaWriteResult>` |
| `update(key, changes)` / `delete(key)` / `clear()` | `Promise<CanaWriteResult>` |
| `bulkAdd` / `bulkPut` / `bulkDelete` | `Promise<CanaBulkWriteResult>` |
| `count(query?)` | `Promise<number>` |
| `query(query?)` | `Promise<readonly TRecord[]>` |
| `explain(query?)` | `Promise<{ records; plan }>` |

### Standalone functions

| Function | Purpose |
|---|---|
| `isCanaError` / `isCanaErrorCode` | Narrow a rejection |
| `validateSchema` / `keyStrategyOf` | Inspect a schema |
| `planQuery` / `toKeyRange` | Inspect a query without running it |
| `assessDurability` / `requiresUserAttention` | Storage policy |
| `classifyOpen` / `browserStorageEnvironment` | Eviction primitives |
| `pruneLedger` / `resolveOutcome` | Ledger maintenance |
| `createRouter` | Worker messaging |
| `createCanaDatabaseClient` | Jumentix adapter |

---

## 19. Glossary

| Term | Meaning |
| --- | --- |
| **Client** | Return value of `createClient` — entry point for `open`, tables, transactions, and subscriptions. |
| **Store** | One object store in the schema (like a table); named in `schema.stores`. |
| **Schema version** | Integer `schema.version`; must increase for IndexedDB to apply structural changes. |
| **Inbound key** | Key stored inside the record via `keyPath`. |
| **Outbound key** | Key passed as the second argument to `add`/`put`. |
| **Transaction scope** | List of store names passed to `transaction`; touching others fails. |
| **Change event** | `CanaChangeEvent` emitted only after a committed write (`created`, `updated`, `deleted`, `cleared`). |
| **Write outcome** | `committed`, `rolled-back`, or `unknown` — see §12 for crash recovery. |
| **Operation ledger** | Optional store that records operation ids in the same transaction as data (`operationLedger: true`). |
| **Durability assessment** | `durabilityAssessment()` — user-facing health of local storage (`lost`, `at-risk`, `best-effort`, `durable`). |

---

## 20. Junior checklist (“I can …”)

- [ ] Create a client, define a schema, call `open()`, and add one record.
- [ ] Explain why `open()` is explicit and what happens if I skip it.
- [ ] Choose `add` vs `put` vs `update` for a given scenario.
- [ ] Run a bounded `query` with an index and confirm with `explain()` that `fullScan` is false.
- [ ] Write a multi-store transaction without awaiting non-IndexedDB work inside the scope.
- [ ] Subscribe to change events and ignore my own writes with `originId`.
- [ ] Handle `QuotaExceeded` and `TransactionInactive` using `isCanaErrorCode`.
- [ ] Export with `exportAll()` and describe when to warn the user about `at-risk` storage.

---

## 21. Common errors (quick reference)

Condensed from §10 and §17. For full context, follow the section links.

| Symptom | Cause | Fix | Verify success |
| --- | --- | --- | --- |
| `InvalidRequest` before any read | Called a table before `await client.open()` | Await `open()` once at startup | `get`/`add` succeed |
| Schema change had no effect | Did not bump `schema.version` | Increase version and reopen | New store/index appears in DevTools |
| `TransactionInactive` | `await fetch` or other non-IDB work inside a transaction | Move external awaits outside; open a new transaction | Write commits with `outcome: 'committed'` |
| `UpgradeBlocked` | Another tab holds the old DB version | Close or reload the other tab | `open()` succeeds on retry |
| `QuotaExceeded` | Browser storage full | Free space; export critical data first | `durabilityAssessment().level` improves |
| Subscriber missed changes | Used `sinceCursor` outside the retained window | Full reload; resubscribe without stale cursor | Events apply without gap |
| `resolveWrite` → `unresolvable` | Ledger off or schema version not raised when enabling ledger | Enable `operationLedger` and bump schema version | Definitive `committed` or `rolled-back` |

---

## 22. Next step

Pair offline persistence with domain validation in
[designer-core](/docs/jumentix/packages/designer-core/usage), then follow the
[SPA/PWA guide](/docs/jumentix/guides/spa-pwa) to ship a zero-build offline app.

---

## Related

- [CANA-INDEXEDDB-ADAPTER.md](./CANA-INDEXEDDB-ADAPTER.md) — design rationale and
  the list of what is **not** yet proven. Read that before relying on this in
  production.
- Package README: `packages/cana/README.md`