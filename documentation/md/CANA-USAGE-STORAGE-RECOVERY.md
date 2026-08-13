# Storage and crash recovery

Cana prefers IndexedDB. When IndexedDB is unavailable, the localStorage fallback
is explicit and degraded: it has smaller quota, no real indexes and lower
durability confidence.

## Backend selection

```ts
import { createClient, type CanaSchema } from '@jumentix/cana';

const schema: CanaSchema = {
  version: 1,
  stores: [
    { name: 'categories', keyPath: 'id' },
    { name: 'tasks', keyPath: 'id', indexes: [{ name: 'byCategory', keyPath: 'categoryId' }] }
  ]
};

const client = createClient({
  name: 'tasks-storage-demo',
  schema,
  fallback: 'localStorage'
});

await client.open();

const storage = await client.storageState();
const durability = await client.durabilityAssessment();

console.log({
  backend: client.backend,
  storage,
  durability
});
```

Pass `fallback: false` when your application prefers a terminal error over a
degraded store.

## Export and import

```ts
const exported = await client.exportAll();

const restored = createClient({
  name: 'tasks-restored-demo',
  schema
});

await restored.open();
await restored.importAll(exported);

console.log({
  categories: await restored.table('categories').query(),
  tasks: await restored.table('tasks').query()
});
```

Use export/import for user-controlled backup, migration from fallback storage or
diagnostics. Cana does not dual-write between IndexedDB and localStorage.

## Resolve an uncertain write

```ts
const ledgerClient = createClient({
  name: 'tasks-ledger-demo',
  schema,
  operationLedger: true
});

await ledgerClient.open();

const tx = await ledgerClient.transaction('readwrite', ['categories', 'tasks'], async (scope) => {
  const now = Date.now();
  await scope.table('categories').put({
    id: 'support',
    name: 'Support',
    color: '#0f766e',
    createdAt: now,
    updatedAt: now
  });
  await scope.table('tasks').put({
    id: 'support-1',
    title: 'Verify uncertain writes',
    categoryId: 'support',
    completed: false,
    priority: 'high',
    createdAt: now,
    updatedAt: now
  });
  return 'done';
});

const resolved = await ledgerClient.resolveWrite(tx.correlationId, tx.attemptedAt);

console.log({
  outcome: tx.outcome,
  resolved
});
```

`resolveWrite()` is for writes reported as `unknown`, usually after a worker,
tab or connection dies before the caller receives the result.

## Run it here

<CanaPlayground id="storage-durability" />

<CanaPlayground id="crash-recovery" />

<CanaPlayground id="export-import" />

<CanaPlayground id="fallback-backend" />

## Next

Continue to [workers and testing](./CANA-USAGE-WORKERS-TESTING.md).
