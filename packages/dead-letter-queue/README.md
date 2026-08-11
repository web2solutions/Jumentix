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

## The replay worker

`new DeadLetterReplayWorker({ queue, handlers, intervalMs, onReport, onError })`

`start()` drains on the interval (default 30s), `stop()` ends it, `tick()`
forces one drain. The timer is `unref`ed, so a background drain never keeps a
CLI or a test runner alive.

Three properties it holds, each a way a naive timer loop goes wrong:

- **No overlap.** A drain slower than the interval is not started again while
  the previous one runs, or the same record is replayed twice concurrently.
- **A failing drain does not stop the worker.** Redis down is a bad tick, not
  the end. One that dies on the first error is indistinguishable from one never
  started.
- **Stopping is complete.** No tick runs after `stop()`.

In `apps/backend-template`, `composeUserDeadLetterReplay.ts` builds the handlers
from `UserService`. Replay goes **through the service**, not the repository, so
it re-acquires the mutex: a record whose lock has not cleared is refused again
and stays queued. A repository-level replay would write past the lock.

That file also carries the subtlest point in the design: `UserService` reports
failure in `response.error` and does not throw. A handler that ignored it would
return normally for a still-locked record, the queue would mark it `succeeded`,
and the write would be lost while the report said it landed. Every handler goes
through `orThrow`.

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
bun run smoke:dead-letter:redis   # against a real Redis container
```

The integration suite skips itself without `RUN_REDIS_INTEGRATION=1` rather
than passing, because a suite that reports success without its dependency is
the false green this repository keeps finding.
