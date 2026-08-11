# @jumentix/dead-letter-queue

Private queue for transactions the mutex refused (JUM-53).

## Why

`UserService` refuses a write when the mutex reports the resource already
locked, in twelve places of the shape:

```ts
const { result: { previouslyLocked } } = await this.mutexService.lock(this.entityName, id);
if (previouslyLocked) await this.rejectLocked('update', id, data);
```

Before this package the caller got an error and the intended transaction was
discarded. A write lost to contention was indistinguishable from one never
attempted. This records the attempt so it can be replayed.

**A queued write has not happened.** The service still throws
`ResourceLockedError`. Reporting success for a queued write would be worse than
losing it.

## Contract

`new DeadLetterQueue({ store, maxAttempts, now, newId })`

- `enqueue(input)` stores `{ entityName, resourceId, operation, payload, actorId? }`
  as a `pending` record and returns it.
- `pending()` returns the replayable records, in the order they were rejected.
- `find(id)` returns one record whatever its status.
- `replay(handlers)` drains the pending records once, one handler per
  `operation`, and reports `{ replayed, retried, abandoned, skipped }`.

A handler returning normally means the write happened. Throwing means it did
not, and the record stays replayable until `maxAttempts` (default 5), after
which it becomes `abandoned` and is never picked again. A record whose
operation has no handler is **skipped**, not abandoned: a missing handler is a
wiring mistake in the process, and discarding the record for it would lose
exactly the data this exists to keep.

Terminal records are kept rather than deleted, so "did that write ever happen"
stays answerable after the fact.

## Stores

- `InMemoryDeadLetterStore` — process-local, for tests and single-process runtimes.
- `KeyValueDeadLetterStore(client, { prefix })` — Redis, through the same
  `get`/`set`/`del` client the mutex uses. That client has no `SCAN` and no
  `KEYS`, so the store keeps an explicit index of record ids under one key.

## Wiring

Pass the queue as a service; without it the behaviour is exactly as before.

```ts
new UserService({
  dataRepository,
  services: { mutexService, passwordCryptoService, deadLetterQueue }
});
```

A queue failure is swallowed at the call site and logged: "the resource is
locked" remains the true answer to the caller whether or not the record was
stored, and reporting a Redis outage to a user who hit contention would hide
the cause.

## Validation

```bash
bun run --filter @jumentix/dead-letter-queue build
bun run --filter @jumentix/dead-letter-queue typecheck
bun run --filter @jumentix/dead-letter-queue lint
bun run --filter @jumentix/dead-letter-queue test
```
