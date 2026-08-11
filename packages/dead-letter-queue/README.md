# @jumentix/dead-letter-queue

Private queue for transactions the mutex refused (JUM-53).

> **A queued write has not happened.** Everything in this package follows from
> that one sentence. The service still throws `ResourceLockedError`; the queue
> only makes the attempt recoverable.

---

## 1. The problem

`UserService` guards every mutation with the mutex. When the resource is
already locked, it refuses:

```ts
const { result: { previouslyLocked } } = await this.mutexService.lock(this.entityName, id);
if (previouslyLocked) await this.rejectLocked('update', id, data);
```

There are **twelve** such sites. Before this package, the caller got an error
and the intended transaction was discarded. Nothing recorded that it had been
attempted, so a write lost to contention was indistinguishable from a write
nobody ever made.

<svg viewBox="0 0 720 300" role="img" aria-label="Before JUM-53 the refused write disappeared; after JUM-53 it is recorded and still refused" width="720" height="300" preserveAspectRatio="xMidYMid meet">
  <defs>
    <marker id="dlq-arrow" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto">
      <path d="M0,0 L8,3 L0,6 z" fill="currentColor"/>
    </marker>
  </defs>
  <g fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.35">
    <line x1="90" y1="46" x2="90" y2="285"/>
    <line x1="270" y1="46" x2="270" y2="285"/>
    <line x1="450" y1="46" x2="450" y2="285"/>
    <line x1="630" y1="46" x2="630" y2="285"/>
  </g>
  <g font-size="13" font-family="inherit" fill="currentColor" text-anchor="middle">
    <text x="90" y="26" font-weight="600">Client</text>
    <text x="270" y="26" font-weight="600">UserService</text>
    <text x="450" y="26" font-weight="600">MutexService</text>
    <text x="630" y="26" font-weight="600">DeadLetterQueue</text>
  </g>
  <g stroke="currentColor" stroke-width="1.6" marker-end="url(#dlq-arrow)" fill="none">
    <line x1="90" y1="70" x2="264" y2="70"/>
    <line x1="270" y1="105" x2="444" y2="105"/>
    <line x1="450" y1="135" x2="276" y2="135" stroke-dasharray="5 4"/>
    <line x1="270" y1="196" x2="96" y2="196" stroke-dasharray="5 4"/>
    <line x1="270" y1="246" x2="624" y2="246"/>
    <line x1="270" y1="276" x2="96" y2="276" stroke-dasharray="5 4"/>
  </g>
  <g font-size="12" font-family="inherit" fill="currentColor">
    <text x="100" y="64">update(user-1, payload)</text>
    <text x="280" y="99">lock(User, user-1)</text>
    <text x="286" y="129">previouslyLocked = true</text>
    <text x="106" y="190">ResourceLockedError</text>
    <text x="280" y="240">enqueue(User, user-1, update, payload)</text>
    <text x="106" y="270">ResourceLockedError</text>
  </g>
  <g font-size="11" font-family="inherit" fill="currentColor" opacity="0.75">
    <rect x="60" y="160" width="620" height="46" rx="6" fill="none" stroke="currentColor" stroke-dasharray="4 4" opacity="0.5"/>
    <text x="66" y="176">before JUM-53 — the attempt disappeared</text>
    <rect x="60" y="216" width="620" height="70" rx="6" fill="none" stroke="currentColor" stroke-dasharray="4 4" opacity="0.5"/>
    <text x="66" y="232">after JUM-53 — recorded, and still refused</text>
  </g>
</svg>

The client is refused in **both** paths. That is the point: the write has not
happened, and a client told otherwise would act on a lie.

---

## 2. The pieces

<svg viewBox="0 0 720 300" role="img" aria-label="UserService enqueues into DeadLetterQueue; the replay worker drains it back through the service; stores are in-memory or Redis" width="720" height="300" preserveAspectRatio="xMidYMid meet">
  <defs>
    <marker id="dlq-arrow2" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto">
      <path d="M0,0 L8,3 L0,6 z" fill="currentColor"/>
    </marker>
  </defs>
  <g fill="none" stroke="currentColor" stroke-width="1.4" opacity="0.4">
    <rect x="16" y="20" width="200" height="150" rx="8" stroke-dasharray="5 4"/>
    <rect x="270" y="20" width="240" height="260" rx="8" stroke-dasharray="5 4"/>
  </g>
  <g font-size="11" font-family="inherit" fill="currentColor" opacity="0.7">
    <text x="26" y="38">apps/backend-template</text>
    <text x="280" y="38">@jumentix/dead-letter-queue</text>
  </g>
  <g fill="none" stroke="currentColor" stroke-width="1.6">
    <rect x="32" y="52" width="168" height="44" rx="6"/>
    <rect x="32" y="112" width="168" height="44" rx="6"/>
    <rect x="288" y="52" width="200" height="44" rx="6"/>
    <rect x="288" y="118" width="200" height="44" rx="6"/>
    <rect x="288" y="184" width="90" height="42" rx="6"/>
    <rect x="396" y="184" width="92" height="42" rx="6"/>
    <rect x="566" y="184" width="130" height="42" rx="6"/>
  </g>
  <g font-size="12" font-family="inherit" fill="currentColor" text-anchor="middle">
    <text x="116" y="70">UserService</text><text x="116" y="86" font-size="10" opacity="0.8">12 rejection sites</text>
    <text x="116" y="130">composeUserDeadLetterReplay</text><text x="116" y="146" font-size="10" opacity="0.8">handlers + wiring</text>
    <text x="388" y="70">DeadLetterQueue</text><text x="388" y="86" font-size="10" opacity="0.8">enqueue · pending · replay</text>
    <text x="388" y="136">DeadLetterReplayWorker</text><text x="388" y="152" font-size="10" opacity="0.8">interval drain</text>
    <text x="333" y="203">InMemory</text><text x="333" y="217" font-size="10" opacity="0.8">Store</text>
    <text x="442" y="203">KeyValue</text><text x="442" y="217" font-size="10" opacity="0.8">Store</text>
    <text x="631" y="210">Redis</text>
  </g>
  <g stroke="currentColor" stroke-width="1.5" fill="none" marker-end="url(#dlq-arrow2)">
    <line x1="200" y1="70" x2="282" y2="70"/>
    <line x1="388" y1="118" x2="388" y2="100"/>
    <line x1="333" y1="162" x2="333" y2="178"/>
    <line x1="442" y1="162" x2="442" y2="178"/>
    <line x1="488" y1="205" x2="560" y2="205"/>
    <path d="M288 140 C 240 140, 210 120, 200 118"/>
  </g>
  <g font-size="10" font-family="inherit" fill="currentColor" opacity="0.85">
    <text x="206" y="64">rejectLocked()</text>
    <text x="206" y="112">handlers call back</text>
    <text x="494" y="200">get · set · del</text>
  </g>
</svg>

| Piece | Responsibility |
|---|---|
| `DeadLetterQueue` | Records, statuses, attempt bound, replay ordering |
| `DeadLetterReplayWorker` | Calls `replay` on an interval, without overlapping |
| `InMemoryDeadLetterStore` | Process-local; tests and single-process runtimes |
| `KeyValueDeadLetterStore` | Redis, through the client the mutex already uses |
| `composeUserDeadLetterReplay` | Maps operation names back to `UserService` methods |

---

## 3. The record lifecycle

<svg viewBox="0 0 720 220" role="img" aria-label="A record starts pending, becomes succeeded when a handler wrote, retries while under the attempt bound, and is abandoned at the bound" width="720" height="220" preserveAspectRatio="xMidYMid meet">
  <defs>
    <marker id="dlq-arrow3" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto">
      <path d="M0,0 L8,3 L0,6 z" fill="currentColor"/>
    </marker>
  </defs>
  <g fill="none" stroke="currentColor" stroke-width="1.6">
    <circle cx="52" cy="110" r="10"/>
    <rect x="140" y="86" width="140" height="48" rx="24"/>
    <rect x="420" y="26" width="150" height="48" rx="24"/>
    <rect x="420" y="146" width="150" height="48" rx="24"/>
  </g>
  <g font-size="13" font-family="inherit" fill="currentColor" text-anchor="middle">
    <text x="210" y="115">pending</text>
    <text x="495" y="55">succeeded</text>
    <text x="495" y="175">abandoned</text>
  </g>
  <g stroke="currentColor" stroke-width="1.6" fill="none" marker-end="url(#dlq-arrow3)">
    <line x1="64" y1="110" x2="134" y2="110"/>
    <path d="M280 100 C 340 100, 370 60, 414 52"/>
    <path d="M280 122 C 340 122, 370 160, 414 168"/>
    <path d="M180 86 C 175 50, 245 50, 240 84"/>
  </g>
  <g font-size="11" font-family="inherit" fill="currentColor">
    <text x="72" y="102">enqueue()</text>
    <text x="300" y="80">handler returned</text>
    <text x="300" y="150">bound reached</text>
    <text x="150" y="46">handler threw, under the bound</text>
  </g>
  <g font-size="11" font-family="inherit" fill="currentColor" opacity="0.75">
    <text x="140" y="212">Terminal records are kept, not deleted: "did that write ever happen" must stay answerable.</text>
  </g>
</svg>

| Status | Meaning | Picked by `replay`? |
|---|---|---|
| `pending` | Refused, replayable | yes |
| `succeeded` | A handler performed the write | no |
| `abandoned` | Attempt bound reached | no, ever |

---

## 4. Replay goes through the service

This is the decision most likely to be got wrong, so it is worth being explicit.

<svg viewBox="0 0 720 250" role="img" aria-label="Replay calls the service, which re-acquires the mutex; a cleared lock marks the record succeeded, a held lock counts an attempt and keeps it pending" width="720" height="250" preserveAspectRatio="xMidYMid meet">
  <defs>
    <marker id="dlq-arrow4" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto">
      <path d="M0,0 L8,3 L0,6 z" fill="currentColor"/>
    </marker>
  </defs>
  <g fill="none" stroke="currentColor" stroke-width="1.6">
    <rect x="16" y="98" width="120" height="44" rx="6"/>
    <rect x="176" y="98" width="140" height="44" rx="6"/>
    <rect x="356" y="98" width="150" height="44" rx="6"/>
    <rect x="546" y="26" width="158" height="52" rx="6"/>
    <rect x="546" y="162" width="158" height="52" rx="6"/>
  </g>
  <g font-size="12" font-family="inherit" fill="currentColor" text-anchor="middle">
    <text x="76" y="124">ReplayWorker</text>
    <text x="246" y="118">handler</text><text x="246" y="134" font-size="10" opacity="0.8">orThrow</text>
    <text x="431" y="118">UserService</text><text x="431" y="134" font-size="10" opacity="0.8">re-acquires the mutex</text>
    <text x="625" y="48">lock cleared</text><text x="625" y="66" font-size="10" opacity="0.85">status = succeeded</text>
    <text x="625" y="184">still locked</text><text x="625" y="202" font-size="10" opacity="0.85">attempts + 1, stays pending</text>
  </g>
  <g stroke="currentColor" stroke-width="1.6" fill="none" marker-end="url(#dlq-arrow4)">
    <line x1="136" y1="120" x2="170" y2="120"/>
    <line x1="316" y1="120" x2="350" y2="120"/>
    <path d="M506 110 C 526 108, 530 70, 540 60"/>
    <path d="M506 130 C 526 132, 530 170, 540 180"/>
  </g>
  <g font-size="11" font-family="inherit" fill="currentColor" opacity="0.8">
    <text x="16" y="240">Through the service, never the repository: a repository-level replay would write past the lock.</text>
  </g>
</svg>

Two things this diagram is defending:

**Through the service, not the repository.** The service re-acquires the mutex,
so a record whose lock has not cleared is refused again and stays queued. A
repository-level replay would write *past* the lock, which is exactly the
corruption the mutex exists to prevent.

**`orThrow` is not decoration.** `UserService` reports failure in
`response.error` and does **not** throw. A handler that ignored that would
return normally for a still-locked record, the queue would mark it `succeeded`,
and the write would be lost while the report said it landed. Every handler goes
through `orThrow`.

---

## 5. API

### `DeadLetterQueue`

```ts
new DeadLetterQueue({ store?, maxAttempts?, now?, newId? })
```

| Option | Default | Notes |
|---|---|---|
| `store` | `InMemoryDeadLetterStore` | Use `KeyValueDeadLetterStore` in a real runtime |
| `maxAttempts` | `5` | Must be at least 1; a queue that never attempts is refused at construction |
| `now` | `() => new Date()` | Injected for deterministic tests |
| `newId` | timestamp + counter | The counter is why two records in the same millisecond do not collide |

| Method | Returns |
|---|---|
| `enqueue(input)` | The stored `pending` record |
| `pending()` | Replayable records, in rejection order |
| `find(id)` | One record, whatever its status |
| `replay(handlers)` | `{ replayed, retried, abandoned, skipped }` — ids, not counts |

`enqueue` refuses input that could not be replayed: `entityName`, `resourceId`
and `operation` are all required.

### `DeadLetterReplayWorker`

```ts
new DeadLetterReplayWorker({ queue, handlers, intervalMs?, onReport?, onError? })
```

| Member | Behaviour |
|---|---|
| `start()` | Begins the interval (default `30_000` ms). The timer is `unref`ed |
| `stop()` | Ends it; no tick runs afterwards |
| `tick()` | Forces one drain — on shutdown, or on the unlock of a resource |
| `running` | Whether the interval is active |

Three properties, each a way a naive timer loop goes wrong:

- **No overlap.** A drain slower than the interval is not started again while
  the previous one runs, or the same record is replayed twice concurrently.
- **A failing drain does not stop the worker.** Redis down is a bad tick, not
  the end. A worker that dies on the first error is indistinguishable from one
  that was never started.
- **Stopping is complete**, including a tick already scheduled.

### Stores

| Store | Use |
|---|---|
| `InMemoryDeadLetterStore` | Tests, single-process runtimes |
| `KeyValueDeadLetterStore(client, { prefix })` | Redis, prefix defaults to `dlq` |

The Redis client this repository uses exposes `get`, `set` and `del` — **no
`SCAN`, no `KEYS`**. The store therefore keeps an explicit index of record ids
under one key, which is also what preserves replay order.

<svg viewBox="0 0 720 170" role="img" aria-label="One index key holds the record ids in rejection order, each pointing at its own record key" width="720" height="170" preserveAspectRatio="xMidYMid meet">
  <defs>
    <marker id="dlq-arrow5" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto">
      <path d="M0,0 L8,3 L0,6 z" fill="currentColor"/>
    </marker>
  </defs>
  <g fill="none" stroke="currentColor" stroke-width="1.6">
    <rect x="16" y="56" width="220" height="56" rx="6"/>
    <rect x="380" y="10" width="300" height="38" rx="6"/>
    <rect x="380" y="66" width="300" height="38" rx="6"/>
    <rect x="380" y="122" width="300" height="38" rx="6"/>
  </g>
  <g font-size="12" font-family="inherit" fill="currentColor">
    <text x="34" y="80" font-weight="600">dlq:index</text>
    <text x="34" y="98" font-size="11" opacity="0.85">id-1, id-2, id-3</text>
    <text x="398" y="34">dlq:record:id-1</text>
    <text x="398" y="90">dlq:record:id-2</text>
    <text x="398" y="146">dlq:record:id-3</text>
  </g>
  <g stroke="currentColor" stroke-width="1.5" fill="none" marker-end="url(#dlq-arrow5)">
    <path d="M236 76 C 300 70, 320 40, 374 32"/>
    <line x1="236" y1="84" x2="374" y2="84"/>
    <path d="M236 92 C 300 98, 320 132, 374 140"/>
  </g>
  <g font-size="11" font-family="inherit" fill="currentColor" opacity="0.85">
    <text x="252" y="52">1st</text><text x="286" y="78">2nd</text><text x="252" y="124">3rd</text>
  </g>
</svg>

---

## 6. Wiring

Pass the queue as a service. Without it, behaviour is **exactly** as before.

```ts
import { composeUserDeadLetterQueue, composeUserDeadLetterWorker }
  from '@src/modules/Users/composition/composeUserDeadLetterReplay';

const deadLetterQueue = composeUserDeadLetterQueue(keyValueStorageClient);
const userService = UserService.compile({
  dataRepository,
  services: { mutexService, passwordCryptoService, deadLetterQueue }
});
const deadLetterWorker = composeUserDeadLetterWorker(deadLetterQueue, userService);
```

`composeUsersAuthServices` already does this and returns both. It builds the
worker but does **not** start it: a background timer is the runtime's to start
and, more importantly, to stop.

```ts
deadLetterWorker?.start();
process.on('SIGTERM', () => deadLetterWorker?.stop());
```

Without a `keyValueStorageClient` both are `undefined`, on purpose: a
process-local queue would be lost on restart while looking like durability.

---

## 7. Try it

A runnable script, no Redis required:

```bash
bun run --filter @jumentix/dead-letter-queue example
```

It is `examples/replay.ts` in this package — edit it and re-run. It walks the
whole lifecycle: a refused write, a replay that fails because the lock still
holds, a replay that succeeds, and a record that reaches the attempt bound.

```ts
import { DeadLetterQueue } from '@jumentix/dead-letter-queue';

const queue = new DeadLetterQueue({ maxAttempts: 2 });
await queue.enqueue({
  entityName: 'User', resourceId: 'user-1', operation: 'update', payload: { firstName: 'Ada' }
});

let locked = true;
const handlers = {
  update: async () => { if (locked) throw new Error('User user-1 is locked'); }
};

await queue.replay(handlers); // retried: [ 'dlq-...' ]
locked = false;
await queue.replay(handlers); // replayed: [ 'dlq-...' ]
```

---

## 8. Operating it

| Symptom | What it means | What to do |
|---|---|---|
| `pending()` grows | Locks are not clearing, or the worker is not started | Check `worker.running` and the mutex TTL |
| Records reach `abandoned` | A resource stayed locked for `maxAttempts` drains | Read `lastError`; the write is lost and the record is the evidence |
| `skipped` in a report | An operation has no registered handler | A wiring mistake — the record is kept, not discarded |
| `onError` fires | The drain itself failed, for example Redis down | The worker keeps ticking; fix the store |

The report returns **ids**, not counts, so an operator can look a record up
rather than infer from a total.

---

## 9. Validation

```bash
bun run --filter @jumentix/dead-letter-queue build
bun run --filter @jumentix/dead-letter-queue typecheck
bun run --filter @jumentix/dead-letter-queue lint
bun run --filter @jumentix/dead-letter-queue test
bun run smoke:dead-letter:redis   # against a real Redis container
```

The integration suite **skips itself** without `RUN_REDIS_INTEGRATION=1` rather
than passing. A suite that reports success without its dependency is the false
green this repository keeps finding.

What only the real server can answer, and what that suite therefore asserts:
values come back as strings and parse, a second queue over the same server sees
what the first wrote, the index holds rejection order, the worker drains, and an
abandoned record is still abandoned after a reopen.
