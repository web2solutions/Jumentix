# @jumentix/cana

IndexedDB offline database adapter for Jumentix applications.

```ts
import { createClient } from '@jumentix/cana';

const client = createClient({
  name: 'designer',
  schema: {
    version: 1,
    stores: [
      { name: 'designs', keyPath: 'id', indexes: [{ name: 'byOwner', keyPath: 'owner' }] }
    ]
  }
});

await client.open();
await client.table('designs').add({ id: 1, name: 'first', owner: 'ana' });
```

## Responsibility in context

- **Stack layer:** offline / browser persistence adapter
- **Owns:** IndexedDB client API (with explicit localStorage fallback) for PWAs
- **Used with:** designer-core, SPA/PWA guide, service-management
- **Not responsible for:** server databases, Redis KV, REST/WebSocket protocols

## Three things to know before using it

**IndexedDB preferred; localStorage fallback is explicit and degraded.** After
`open()`, read `client.backend`: `'indexeddb'` or `'localStorage'`. When
IndexedDB cannot open, Cana opens a localStorage-backed store by default
(`fallback: 'localStorage'`). That path has a smaller quota and no real indexes —
durability assessment reports `best-effort`. Pass `fallback: false` to restore
terminal `Unavailable` instead. There is no dual-write or auto-promote between
the two stores; use `exportAll()` / import to move data.

**Writes have three outcomes, not two.** `committed | rolled-back | unknown`.
The third covers a transaction torn down without either event firing — a killed
worker, a closed tab. Enable `operationLedger: true` and `resolveWrite()` will
answer definitively, because the operation id is written inside the same
transaction as the data.

**Never `await` anything but an IndexedDB request inside a transaction.** The
transaction auto-commits as soon as the event loop yields with no pending
request, so `await fetch(...)` does not pause it — it ends it. Cana reports the
violation as `TransactionInactive` rather than letting a bare `DOMException`
escape.

## Errors are plain data

`CanaError` is not an `Error` subclass, because structured clone does not
preserve class identity across storage or a worker boundary — an `instanceof`
check would silently return `false`. Use the guards:

```ts
import { isCanaError, isCanaErrorCode } from '@jumentix/cana';

if (isCanaErrorCode(error, 'QuotaExceeded')) { /* ... */ }
```

## Try it in the browser

Run a first client against IndexedDB in this page:

<CanaPlayground id="getting-started" />

## Design notes

Cana is intentionally closer to a small browser database engine than to a
frontend state store. IndexedDB owns the durable storage; Cana adds the client
surface, explicit transaction outcomes, change replay, crash reconciliation and
an optional worker boundary for applications that need to move persistence work
off the UI thread.

### Postgres-shaped architecture

The analogy is scoped, but useful. PostgreSQL records changes through
[write-ahead logging](https://www.postgresql.org/docs/current/wal-intro.html),
keeps foreground work separate from maintenance work through processes such as
the [background writer](https://www.postgresql.org/docs/current/runtime-config-resource.html),
and lets extensions run [background workers](https://www.postgresql.org/docs/current/bgworker.html).
Cana maps those ideas to browser primitives instead of shipping a server:

- **Storage layer:** IndexedDB is the durable page/store layer and owns atomic
  commit and rollback. The localStorage fallback is explicit and degraded.
- **Commit boundary:** a Cana transaction is the unit of durability. Change
  events are buffered during the body and released only after IndexedDB
  `oncomplete`, so subscribers never react to writes that later roll back.
- **Logical change stream:** subscribers receive committed `CanaChangeEvent`
  entries with monotonically increasing cursors. `sinceCursor` can replay a
  bounded retained window; if the requested cursor is too old, Cana reports that
  the UI must resync instead of pretending the replay was complete.
- **Crash reconciliation:** `operationLedger: true` writes an operation record in
  the same transaction as the data. After a killed worker, closed tab, or lost
  response, `resolveWrite()` can distinguish `committed`, `rolled-back` and
  `unresolvable`.
- **State-management boundary:** Cana does not replace React Context, Redux,
  Pinia, Zustand or another UI store. The recommended shape is to treat Cana as
  the durable source of truth, subscribe to Cana events, then update the
  framework store from those committed events.

### Worker model

`createWorkerHost()` runs a real Cana client behind a `MessagePort` or dedicated
`Worker`. `createRouter()` and `createWorkerClient()` sit on the page side and
turn typed method calls into plain messages.

- Messages are structured-cloneable data only: no functions, DOM objects,
  `IDBRequest` instances, class instances or `Error` subclasses cross the
  boundary.
- Every request carries a `requestId`, because a worker can answer concurrent
  requests out of order.
- The default request timeout is 15 seconds. Timed-out reads report
  `Unavailable`; timed-out writes report `UnknownOutcome`, because the worker
  may have committed before it died or before the response was posted.
- The host broadcasts committed changes as `{ kind: 'change', event }`, which is
  the hook used by React Context, Redux and Pinia tutorials to refresh their
  component state.
- Multi-operation `transaction()` bodies do not cross the worker boundary
  because the body is a function. Run that transaction inside the worker, or
  send individual write requests through `createWorkerClient()`.

### Performance data

Cana's browser performance suite runs against real disk-backed IndexedDB and
uses ratio assertions rather than absolute millisecond promises. That keeps the
data portable across CI runners and user machines while still proving the
important shape of the engine.

| Operation | Data set | Current performance contract |
| --- | --- | --- |
| Limited query | 1,000 rows vs 10,000 rows, `limit: 10` | The 10,000-row median stays at most `max(4x the 1,000-row median, 5ms)`. |
| Indexed lookup | 1,000 rows vs 10,000 rows, 100 indexed groups | The 10,000-row median stays below `max(25x the 1,000-row median, 20ms)` even though the matching result set grows 10x. |
| Native count | 10,000 rows | `count()` must be faster than reading every row with a full query. |
| Primary-key get | 1,000 rows vs 10,000 rows | The 10,000-row median stays at most `max(4x the 1,000-row median, 5ms)`. |
| Bulk add | 10,000 rows | A single `bulkAdd()` commits all rows and the final count is exactly 10,000. |
| Deep pagination | 10,000 rows, `offset: 9000`, `limit: 20` | The deep page stays below `max(60x an early-page median, 60ms)`, proving cursor advance instead of materializing 9,000 rows. |

## Junior checklist (“I can …”)

- [ ] Open a client, add a row, and read it back.
- [ ] Check `client.backend` after `open()` and explain indexeddb vs localStorage.
- [ ] Avoid `TransactionInactive` by keeping foreign `await`s outside transactions.

## Framework tutorials

Build the same categorized task app with framework state management:

- [React Context API](/docs/jumentix/packages/cana/react-context)
- [React Redux](/docs/jumentix/packages/cana/react-redux)
- [Vue 3 and Pinia](/docs/jumentix/packages/cana/vue-pinia)

## Next step

Continue with the consumer [usage guide](../../documentation/md/CANA-USAGE-GUIDE.md)
for the full API, querying, transactions, hooks, crash recovery, and
troubleshooting — then
[designer-core](/docs/jumentix/packages/designer-core/usage) to validate designs
before you persist them.
