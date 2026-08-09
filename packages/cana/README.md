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

## Full documentation

**Usage guide** — API reference, querying, transactions, hooks, crash recovery,
troubleshooting:

- English: [`CANA-USAGE-GUIDE.md`](../../documentation/md/CANA-USAGE-GUIDE.md)
- Português: [`CANA-USAGE-GUIDE.pt-BR.md`](../../documentation/md/CANA-USAGE-GUIDE.pt-BR.md)

**Design rationale** — why each behaviour is what it is, and what is not yet
proven:

- English: [`CANA-INDEXEDDB-ADAPTER.md`](../../documentation/md/CANA-INDEXEDDB-ADAPTER.md)
- Português: [`CANA-INDEXEDDB-ADAPTER.pt-BR.md`](../../documentation/md/CANA-INDEXEDDB-ADAPTER.pt-BR.md)

The release-readiness notes in that document are required reading before
relying on this package in production. Real dedicated Worker hosting and the
localStorage fallback path are covered by the Cana browser suite (JUM-615).
