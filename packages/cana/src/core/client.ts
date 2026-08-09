/**
 * The client surface (JUM-405, JUM-407, JUM-412, JUM-413).
 *
 * Assembles lifecycle, transactions, tables and change notification into the
 * `CanaClient` contract. Three things here are decisions rather than plumbing.
 *
 * **Single-operation calls get their own transaction.** `client.table('x').put(r)`
 * opens a transaction, writes, commits, and reports the outcome. It is not a
 * shortcut into a shared ambient transaction, because an ambient one would make
 * the durability of any single call depend on unrelated code elsewhere.
 *
 * **Listeners are called in registration order, and one throwing does not stop
 * the rest** (JUM-413). A subscriber that fails is a bug in that subscriber; if
 * it silently prevented later subscribers from ever seeing the event, the
 * resulting inconsistency would appear far from its cause.
 *
 * **`sinceCursor` replays.** A subscriber that was absent — a worker that
 * restarted, a tab that was backgrounded — resumes from its last cursor rather
 * than starting from now and silently missing the gap. The retained window is
 * bounded, and when a requested cursor has fallen out of it the client says so
 * instead of pretending the replay was complete.
 */

import type {
  CanaChangeEvent,
  CanaClient,
  CanaKey,
  CanaSchema,
  CanaStorageBackend,
  CanaStorageState,
  CanaTable,
  CanaTransactionMode,
  CanaTransactionResult,
  CanaTransactionScope,
  CanaWriteOutcome
} from '../contracts';
import { isCanaError, isCanaErrorCode } from '../contracts';
import { canaError } from './errors';
import type { DurabilityAssessment, DurabilityPolicy } from './durability-policy';
import { DEFAULT_DURABILITY_POLICY, assessDurability } from './durability-policy';
import type { CanaHooks } from './hooks';
import { notifyCommitted, notifyRolledBack } from './hooks';
import { openDatabase } from './database';
import {
  LocalStorageBackend,
  openLocalStorageBackend,
  type LocalStorageLike
} from './local-storage-backend';
import {
  OPERATION_LEDGER_STORE,
  recordOperation,
  resolveOutcome,
  withLedgerStore
} from './reconciliation';
import type { ResolvedOutcome } from './reconciliation';
import { StorageDurability, browserStorageEnvironment } from './storage';
import { createTable } from './table';
import { abortWithReason, createChangeBuffer, runTransaction } from './transaction';

export interface ClientOptions {
  readonly name: string;
  readonly schema: CanaSchema;
  readonly factory?: IDBFactory;
  readonly durability?: StorageDurability;
  /** How many committed events stay replayable. */
  readonly retainedEvents?: number;
  /** Identifies this client in events, so a subscriber can ignore its own writes. */
  readonly originId?: string;
  readonly hooks?: CanaHooks;
  readonly durabilityPolicy?: DurabilityPolicy;
  /**
   * Record every write transaction in the operation ledger so an interrupted
   * write can be resolved after a crash. Off by default: it costs one extra
   * request per transaction, which only pays for itself when a worker or tab
   * can actually die mid-write (JUM-559).
   */
  readonly operationLedger?: boolean;
  /**
   * When IndexedDB cannot open, degrade to a localStorage-backed store.
   *
   * Defaults to `'localStorage'`. Pass `false` to restore terminal `Unavailable`
   * when IndexedDB is missing (the pre-JUM-615 behaviour).
   */
  readonly fallback?: 'localStorage' | false;
  /** Injected for tests; defaults to the browser `localStorage` when present. */
  readonly localStorage?: LocalStorageLike;
}

/**
 * Bounded on purpose. An unbounded history is a memory leak in a long-lived tab,
 * and the alternative — dropping the oldest silently — is why `subscribe`
 * reports a cursor it can no longer honour rather than replaying a partial gap.
 */
const DEFAULT_RETAINED_EVENTS = 1000;

interface Subscription {
  readonly listener: (event: CanaChangeEvent) => void;
  active: boolean;
}

/**
 * The only thing the auto-commit table needs from a client.
 *
 * Narrowed to this rather than the concrete class so the dependency runs one
 * way: the table knows how to start a transaction and nothing else about who
 * owns it.
 */
interface TransactionRunner {
  transaction<TResult>(
    mode: CanaTransactionMode,
    stores: readonly string[],
    body: (scope: CanaTransactionScope) => Promise<TResult> | TResult
  ): Promise<CanaTransactionResult<TResult>>;
}

/**
 * A table outside any explicit transaction: each call gets its own.
 *
 * Deliberately a distinct implementation rather than the transactional table
 * with a nullable transaction, so "am I inside a transaction?" is never a
 * runtime question — the two cases are different objects with the same surface.
 */
function createAutoCommitTable<TRecord, TKey extends CanaKey = CanaKey>(
  name: string,
  client: TransactionRunner
): CanaTable<TRecord, TKey> {
  type Bound = CanaTable<TRecord, TKey>;

  const read = <TResult>(body: (table: Bound) => Promise<TResult>): Promise<TResult> => client
    .transaction('readonly', [name], (scope) => body(scope.table<TRecord, TKey>(name)))
    .then(({ result }) => result as TResult);

  const write = <TResult extends { outcome: CanaWriteOutcome }>(
    body: (table: Bound) => Promise<TResult>
  ): Promise<TResult> => client
      .transaction('readwrite', [name], (scope) => body(scope.table<TRecord, TKey>(name)))
    // The per-operation result reports `committed` optimistically; the
    // transaction's own outcome is the authoritative one, and the events only
    // exist at all if it committed.
      .then(({ outcome, result, events }) => ({ ...(result as TResult), outcome, events }));

  return {
    name,
    get: (key) => read((table) => table.get(key)),
    count: (query) => read((table) => table.count(query)),
    query: (query) => read((table) => table.query(query)),
    explain: (query) => read((table) => table.explain(query)),
    add: (record, key) => write((table) => table.add(record, key)),
    put: (record, key) => write((table) => table.put(record, key)),
    update: (key, changes) => write((table) => table.update(key, changes)),
    delete: (key) => write((table) => table.delete(key)),
    clear: () => write((table) => table.clear()),
    bulkAdd: (records) => write((table) => table.bulkAdd(records)),
    bulkPut: (records) => write((table) => table.bulkPut(records)),
    bulkDelete: (keys) => write((table) => table.bulkDelete(keys))
  };
}

export class Client implements CanaClient {
  readonly name: string;

  readonly version: number;

  /** Set after a successful `open()`. */
  backend?: CanaStorageBackend;

  private database?: IDBDatabase;

  private localBackend?: LocalStorageBackend;

  private readonly durability: StorageDurability;

  private readonly history: CanaChangeEvent[] = [];

  private readonly subscriptions: Subscription[] = [];

  private readonly originId: string;

  private readonly retainedEvents: number;

  private cursor = 0;

  private correlation = 0;

  constructor(private readonly options: ClientOptions) {
    this.name = options.name;
    this.version = options.schema.version;
    // Defaults to the real browser environment, not an empty one. An empty
    // environment writes no tombstone, so `recordExistence` always fails and
    // eviction stays 'undetectable-no-tombstone' forever — JUM-560's detection
    // was documented but, by default, switched off.
    this.durability = options.durability ?? new StorageDurability(browserStorageEnvironment());
    this.retainedEvents = options.retainedEvents ?? DEFAULT_RETAINED_EVENTS;
    // `crypto.randomUUID()`, not `Math.random()`. The origin id is what tells a
    // subscriber which tab produced a change, so a collision makes one tab's
    // writes look like its own echo and the event is dropped. `Math.random` gives
    // no collision guarantee, and eight base-36 characters make one plausible
    // across enough tabs and reloads. `crypto` is available in every browser
    // Cana targets and in Bun.
    this.originId = options.originId ?? `cana-${crypto.randomUUID()}`;
  }

  private fallbackEnabled(): boolean {
    return this.options.fallback !== false;
  }

  /**
   * The schema as it will actually be applied.
   *
   * When the ledger is enabled its store is added here rather than being left to
   * the application to declare, because forgetting it would mean the ledger
   * silently records nothing and the crash-resolution path reports
   * `unresolvable` forever without saying why.
   */
  private effectiveSchema(): CanaSchema {
    if (!this.options.operationLedger) return this.options.schema;
    return {
      ...this.options.schema,
      stores: withLedgerStore(this.options.schema.stores) as CanaSchema['stores']
    };
  }

  async open(): Promise<void> {
    if (this.backend) return;

    try {
      const opened = await openDatabase({
        name: this.options.name,
        schema: this.effectiveSchema(),
        durability: this.durability,
        ...(this.options.factory === undefined ? {} : { factory: this.options.factory })
      });
      this.database = opened.database;

      // Enabling the ledger adds its store to the schema, but IndexedDB only runs
      // an upgrade when the version increases. Turning `operationLedger` on
      // against an existing database at the same version therefore creates no
      // store — and the previous code then quietly disabled the ledger, so writes
      // recorded nothing and `resolveWrite` answered `unresolvable` forever with
      // no indication why. That is exactly the silent no-op the ledger exists to
      // rule out, so it now fails loudly and says what to do.
      if (this.options.operationLedger
        && !opened.database.objectStoreNames.contains(OPERATION_LEDGER_STORE)) {
        opened.database.close();
        this.database = undefined;
        throw canaError(
          'UpgradeFailed',
          `The operation ledger is enabled for "${this.name}" but its store does not exist. The `
            + `database is already at version ${this.version}, and IndexedDB applies schema changes `
            + 'only when the version increases. Raise the schema version so the ledger store can be '
            + 'created — leaving it as-is would record nothing and make every crash unresolvable.'
        );
      }

      this.backend = 'indexeddb';

      // Asked for only when the application opted in. A persistence prompt fired
      // by a library at an arbitrary moment is one the user denies, and some
      // browsers make that denial sticky for the origin.
      if (this.options.durabilityPolicy?.requestPersistenceOnOpen
        ?? DEFAULT_DURABILITY_POLICY.requestPersistenceOnOpen) {
        await this.durability.requestPersistence();
      }
      return;
    } catch (error) {
      if (!isCanaErrorCode(error, 'Unavailable') || !this.fallbackEnabled()) {
        throw error;
      }
    }

    this.localBackend = openLocalStorageBackend({
      name: this.options.name,
      schema: this.effectiveSchema(),
      originId: this.originId,
      nextCursor: this.nextCursor,
      ...(this.options.hooks === undefined ? {} : { hooks: this.options.hooks }),
      ...(this.options.operationLedger === undefined
        ? {}
        : { operationLedger: this.options.operationLedger }),
      ...(this.options.localStorage === undefined
        ? {}
        : { storage: this.options.localStorage })
    });
    this.backend = 'localStorage';
  }

  /**
   * What the application is allowed to tell its user about durability.
   *
   * Separate from `storageState()`, which reports raw observations: this applies
   * the policy that refuses to round 'unknown' up to 'durable' (JUM-415).
   */
  async durabilityAssessment(): Promise<DurabilityAssessment> {
    if (this.backend === 'localStorage') {
      return {
        level: 'best-effort',
        evictionDetectable: false,
        summary: 'Cana is using the localStorage fallback. Capacity and durability are '
          + 'weaker than IndexedDB; treat this session as degraded.',
        advice: [
          'Export with exportAll() and restore once IndexedDB is available.',
          'Do not assume multi-megabyte imports will succeed on localStorage.'
        ]
      };
    }
    const current = await this.durability.state();
    return assessDurability(current, this.durability.lastEvictionVerdict);
  }

  async close(): Promise<void> {
    this.database?.close();
    this.database = undefined;
    this.localBackend?.close();
    this.localBackend = undefined;
    this.backend = undefined;
  }

  private requireIndexedDb(): IDBDatabase {
    if (!this.database) {
      throw canaError(
        'InvalidRequest',
        `Client for "${this.name}" is not open on IndexedDB. Call open() before using it — the `
          + 'engine does not open implicitly, because an implicit open hides an upgrade behind '
          + 'an unrelated call.'
      );
    }
    return this.database;
  }

  private requireOpenBackend(): void {
    if (!this.backend) {
      throw canaError(
        'InvalidRequest',
        `Client for "${this.name}" is not open. Call open() before using it — the engine does not `
          + 'open implicitly, because an implicit open hides an upgrade behind an unrelated call.'
      );
    }
  }

  private nextCursor = (): number => {
    this.cursor += 1;
    return this.cursor;
  };

  /**
   * Retain for replay, then notify. That order matters: a listener that throws
   * must not cost the event its place in the replayable history.
   */
  private publish(events: readonly CanaChangeEvent[]): void {
    if (events.length === 0) return;

    this.history.push(...events);
    if (this.history.length > this.retainedEvents) {
      this.history.splice(0, this.history.length - this.retainedEvents);
    }

    for (const event of events) {
      for (const subscription of [...this.subscriptions].filter((entry) => entry.active)) {
        try {
          subscription.listener(event);
        } catch {
          // A failing subscriber is that subscriber's bug. Letting it stop
          // delivery to the others would turn one broken listener into a
          // database-wide inconsistency reported nowhere near its cause.
        }
      }
    }
  }

  table<TRecord, TKey extends CanaKey = CanaKey>(name: string): CanaTable<TRecord, TKey> {
    return createAutoCommitTable<TRecord, TKey>(name, this);
  }

  /**
   * Resolve a write whose outcome was reported as `unknown` (JUM-559).
   *
   * The answer comes from the operation ledger, which was written inside the
   * same transaction as the data — so it survives a killed worker, a closed tab
   * or a force-quit browser, none of which preserve anything in memory.
   *
   * Requires `operationLedger: true`; without it there is no evidence and the
   * answer is `unresolvable` rather than a guess.
   */
  resolveWrite(
    correlationId: string,
    attemptedAt: number,
    options: { horizonMs?: number; now?: number } = {}
  ): Promise<ResolvedOutcome> {
    this.requireOpenBackend();
    if (this.localBackend) {
      return this.localBackend.resolveWrite(correlationId, attemptedAt, options);
    }
    return resolveOutcome(this.requireIndexedDb(), correlationId, attemptedAt, options);
  }

  async transaction<TResult>(
    mode: CanaTransactionMode,
    stores: readonly string[],
    body: (scope: CanaTransactionScope) => Promise<TResult> | TResult
  ): Promise<CanaTransactionResult<TResult>> {
    this.requireOpenBackend();
    this.correlation += 1;
    const correlationId = `${this.originId}:${this.correlation}`;
    const { hooks } = this.options;

    if (this.localBackend) {
      try {
        const outcome = await this.localBackend.transaction(
          mode,
          stores,
          body,
          correlationId
        );
        if (outcome.outcome === 'committed') {
          this.publish(outcome.events);
          notifyCommitted(hooks, outcome.events);
        } else {
          notifyRolledBack(hooks, outcome.outcome);
        }
        return outcome;
      } catch (error: unknown) {
        notifyRolledBack(hooks, 'rolled-back', isCanaError(error) ? error.message : undefined);
        throw error;
      }
    }

    const database = this.requireIndexedDb();
    const buffer = createChangeBuffer(this.nextCursor, this.originId);

    // The ledger store joins the transaction's scope, so the operation id and
    // the data commit or roll back together. Recording it in a second
    // transaction would leave exactly the window this is meant to close.
    // `open()` already guaranteed the store exists whenever the ledger is on, so
    // this no longer silently degrades when it is missing.
    const ledgered = this.options.operationLedger === true && mode === 'readwrite';

    const scope = ledgered && !stores.includes(OPERATION_LEDGER_STORE)
      ? [...stores, OPERATION_LEDGER_STORE]
      : stores;

    const attemptedAt = Date.now();

    let outcome;
    try {
      outcome = await runTransaction<TResult>({
        database,
        stores: scope,
        mode,
        buffer,
        body: async (transaction) => {
          // Recorded FIRST, before the body runs.
          //
          // An earlier version recorded it last, reasoning that an abort must
          // never leave an id claiming a commit. That reasoning was redundant —
          // the shared transaction already guarantees the row rolls back with
          // the data — and it broke the one case the ledger exists for: if the
          // body writes, IndexedDB auto-commits, and the body then throws, the
          // transaction commits with no ledger row. `resolveWrite` would see a
          // missing id inside the horizon and answer 'rolled-back' for data that
          // is on disk, which is exactly the unsafe-retry it was built to
          // prevent. Recording first is safe in both directions.
          if (ledgered) {
            await recordOperation(transaction, {
              id: correlationId,
              at: attemptedAt,
              stores: [...stores]
            });
          }

          return body({
            table: <TRecord, TKey extends CanaKey = CanaKey>(
              name: string
            ) => createTable<TRecord, TKey>(
              name,
              {
                transaction,
                buffer,
                correlationId,
                ...(hooks === undefined ? {} : { hooks })
              }
            ),
            abort: (reason?: string) => abortWithReason(transaction, reason)
          });
        }
      });
    } catch (error: unknown) {
      // Every throw out of `runTransaction` means nothing was committed, so the
      // hook is told before the failure propagates. It cannot suppress it.
      // `runTransaction` always translates to a CanaError before throwing, so
      // the reason is always `.message` when present.
      notifyRolledBack(hooks, 'rolled-back', String((error as { message?: unknown }).message));
      throw error;
    }

    if (outcome.outcome !== 'committed') {
      // Reached only for `unknown` — the body failed but the transaction had
      // already auto-committed. This is the case that needs reconciliation, and
      // it is reported as itself rather than folded into a rollback.
      notifyRolledBack(hooks, 'unknown');
      // Carries the id and timestamp, because this is the outcome a caller must
      // reconcile — and reconciling means calling resolveWrite with exactly
      // these two values.
      return { ...outcome, correlationId, attemptedAt };
    }

    // Only committed transactions produce events; `runTransaction` discards the
    // buffer on every other path.
    this.publish(outcome.events);
    notifyCommitted(hooks, outcome.events);
    return { ...outcome, correlationId, attemptedAt };
  }

  storageState(): Promise<CanaStorageState> {
    if (this.backend === 'localStorage') {
      return Promise.resolve({
        persistent: 'unknown' as const,
        nearQuota: false,
        evicted: false,
        // localStorage is typically capped around 5 MiB; report that as quota so
        // callers can surface headroom without pretending IndexedDB numbers apply.
        quotaBytes: 5 * 1024 * 1024
      });
    }
    return this.durability.state();
  }

  subscribe(
    listener: (event: CanaChangeEvent) => void,
    options: { sinceCursor?: number } = {}
  ): () => void {
    const since = options.sinceCursor;

    // Validated BEFORE registering. Registering first and then throwing left an
    // inactive entry in the array with no unsubscribe function to remove it, so
    // every refused subscribe leaked one permanently — and a caller retrying in
    // a loop would grow the list without bound.
    if (since !== undefined) {
      const oldest = this.history[0]?.cursor;
      if (oldest !== undefined && since < oldest - 1) {
        // The gap is real and unrecoverable from memory. Replaying what is left
        // would look like a complete history and quietly omit the middle.
        throw canaError(
          'NotFound',
          `Cannot replay from cursor ${since}: the retained window starts at ${oldest}. `
            + `Only the last ${this.retainedEvents} events are replayable — reload from the `
            + 'database rather than resuming from an incomplete stream.'
        );
      }
    }

    const subscription: Subscription = { listener, active: true };
    this.subscriptions.push(subscription);

    if (since !== undefined) {
      for (const event of this.history.filter((entry) => entry.cursor > since)) {
        try {
          listener(event);
        } catch {
          // Same reasoning as `publish`.
        }
      }
    }

    return () => {
      subscription.active = false;
      const at = this.subscriptions.indexOf(subscription);
      if (at >= 0) this.subscriptions.splice(at, 1);
    };
  }

  async exportAll(): Promise<Record<string, readonly unknown[]>> {
    this.requireOpenBackend();
    if (this.localBackend) {
      return this.localBackend.exportAll();
    }
    const database = this.requireIndexedDb();
    const names = Array.from(database.objectStoreNames);
    const dump: Record<string, readonly unknown[]> = {};

    await this.transaction('readonly', names, async (scope) => {
      for (const name of names) {
        // eslint-disable-next-line no-await-in-loop
        dump[name] = await scope.table(name).query();
      }
    });

    return dump;
  }
}

/** Create a client. It is not open until `open()` resolves. */
export function createClient(options: ClientOptions): Client {
  return new Client(options);
}
