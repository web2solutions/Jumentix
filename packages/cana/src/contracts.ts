/**
 * Cana public contracts (JUM-400).
 *
 * The property this file exists to enforce: **no IndexedDB type crosses this
 * boundary.** Not `IDBDatabase`, not `IDBTransaction`, not `IDBValidKey`, not a
 * `DOMException`. A consumer that can name an IndexedDB type can also depend on
 * one, and then swapping the driver stops being a configuration change — which is
 * the entire point of the hexagonal boundary (Reqs 015/016).
 *
 * Two consequences shape everything below:
 *
 * 1. **Keys are our own type, not `IDBValidKey`.** IndexedDB accepts a specific
 *    set of key types with its own comparison rules; we restate that set so the
 *    contract is readable without the spec open, and so a future non-IndexedDB
 *    backend is not forced to satisfy a DOM interface.
 *
 * 2. **Errors are plain data with a discriminant, never `Error` subclasses.**
 *    Cana runs its engine in a worker, and `postMessage` uses structured clone,
 *    which **strips prototypes**. An `instanceof CanaQuotaError` check that works
 *    in tests silently becomes `false` in production the moment the engine moves
 *    off the main thread. So the taxonomy is a tagged union carried as data, and
 *    `isCanaError`/`isQuotaExceeded` are the supported way to branch on it.
 */

/* ------------------------------------------------------------------ *
 * Keys
 * ------------------------------------------------------------------ */

/**
 * A value usable as a primary key or index key.
 *
 * Mirrors the IndexedDB valid-key set deliberately rather than importing
 * `IDBValidKey`: the contract must be legible on its own, and a backend that is
 * not IndexedDB must be able to satisfy it.
 */
// CanaKey and CanaKeyArray are mutually recursive by definition: an array of keys
// is itself a key. No declaration order satisfies no-use-before-define, so it is
// disabled at this one site rather than by relaxing the rule repo-wide.
// eslint-disable-next-line no-use-before-define
export interface CanaKeyArray extends Array<CanaKey> {}

export type CanaKey = number | string | Date | ArrayBufferView | ArrayBuffer | CanaKeyArray;

/** A compound key path, e.g. `['tenantId', 'email']`. */
export type CanaKeyPath = string | readonly string[];

/* ------------------------------------------------------------------ *
 * Errors — data, not classes
 * ------------------------------------------------------------------ */

/**
 * Every failure Cana can report.
 *
 * Kept flat and exhaustive so a `switch` over it is checkable, and so a consumer
 * can handle the cases that matter to a user (`QuotaExceeded`, `Evicted`,
 * `Unavailable`) without pattern-matching on message strings.
 */
export type CanaErrorCode =
  /**
   * No usable store: IndexedDB failed and the configured fallback (when any)
   * could not open either. Terminal for this open attempt.
   */
  | 'Unavailable'
  /** The origin's storage budget is exhausted. The write did not happen. */
  | 'QuotaExceeded'
  /**
   * A database that previously existed is gone or at an unexpected version.
   *
   * This is the single most important code in the taxonomy. An evicted database
   * and a brand-new one are indistinguishable by inspection — both open empty —
   * and reporting the first as the second presents lost work as a welcome screen.
   */
  | 'Evicted'
  /** A schema upgrade did not complete; the database may be at an indeterminate version. */
  | 'UpgradeFailed'
  /** Another connection is blocking a version change, or the upgrade timed out waiting. */
  | 'UpgradeBlocked'
  /** A uniqueness constraint rejected the write. */
  | 'ConstraintViolation'
  /** The requested key or record does not exist. */
  | 'NotFound'
  /** The transaction was aborted, by the caller or by the engine. */
  | 'TransactionAborted'
  /**
   * The transaction's auto-commit window closed before the operation ran.
   *
   * Distinct from `TransactionAborted` on purpose: this one is almost always a
   * caller mistake (awaiting something outside the transaction), and conflating
   * the two sends people looking in the wrong place.
   */
  | 'TransactionInactive'
  /** The operation was cancelled by the caller. */
  | 'Cancelled'
  /** A bounded queue rejected the request rather than growing without limit. */
  | 'Backpressure'
  /**
   * The worker died or the connection dropped and the outcome cannot be
   * determined. Not a failure and not a success — see `CanaWriteOutcome`.
   */
  | 'UnknownOutcome'
  /** The engine rejected the request as malformed before touching storage. */
  | 'InvalidRequest'
  /** Anything the engine could not classify. Carries `cause` for diagnosis. */
  | 'Internal';

/**
 * A Cana failure, as plain data.
 *
 * `readonly` throughout and prototype-free by construction, so it survives
 * `structuredClone` across the worker boundary unchanged.
 */
export interface CanaError {
  readonly canaError: true;
  readonly code: CanaErrorCode;
  readonly message: string;
  /** Store involved, when the failure is store-scoped. */
  readonly store?: string;
  /** Key involved, when the failure is key-scoped. */
  readonly key?: CanaKey;
  /**
   * Whether retrying the identical operation could plausibly succeed.
   *
   * Recorded by the engine rather than inferred by the caller: only the engine
   * knows whether a failure was transient contention or a permanent constraint.
   */
  readonly retryable: boolean;
  /**
   * Original error text, flattened to a string.
   *
   * A string rather than the error object because structured clone would strip a
   * `DOMException` down to something unrecognisable anyway; flattening here keeps
   * the diagnosis and drops the false promise of a live object.
   */
  readonly cause?: string;
}

/** Narrow an unknown rejection to a Cana failure. */
export function isCanaError(value: unknown): value is CanaError {
  return typeof value === 'object'
    && value !== null
    && (value as { canaError?: unknown }).canaError === true;
}

/** Narrow to a specific code. Preferred over comparing `message` strings. */
export function isCanaErrorCode<TCode extends CanaErrorCode>(
  value: unknown,
  code: TCode
): value is CanaError & { code: TCode } {
  return isCanaError(value) && value.code === code;
}

/* ------------------------------------------------------------------ *
 * Write outcomes — three states, not two
 * ------------------------------------------------------------------ */

/**
 * The result of a mutation.
 *
 * Three states rather than two, and the third is the reason this type exists: if
 * a worker dies mid-transaction, the client holds a promise that will never
 * settle. Resolving it as failure risks a duplicate write on retry; resolving it
 * as success risks reporting data that was never committed. `unknown` forces the
 * caller to reconcile instead of guessing (JUM-411).
 */
export type CanaWriteOutcome = 'committed' | 'rolled-back' | 'unknown';

/* ------------------------------------------------------------------ *
 * Change events
 * ------------------------------------------------------------------ */

export type CanaChangeType = 'created' | 'updated' | 'deleted' | 'cleared';

/**
 * A committed change, as published to the Message Mediator (JUM-412).
 *
 * Published **only** for committed writes. A rolled-back transaction that emitted
 * events would leave every listener holding state the database does not have.
 */
export interface CanaChangeEvent<TRecord = unknown> {
  readonly type: CanaChangeType;
  readonly store: string;
  readonly key?: CanaKey;
  /** Absent for `deleted` and `cleared`. */
  readonly record?: TRecord;
  /**
   * Monotonic per-database sequence number.
   *
   * The ordering guarantee listeners rely on, and what makes resubscription
   * possible: a client that was closed resumes from its last cursor rather than
   * replaying everything or silently missing the gap (JUM-413).
   */
  readonly cursor: number;
  /** Correlates the event with the originating request across tabs and workers. */
  readonly correlationId: string;
  /** Epoch milliseconds, engine clock. */
  readonly at: number;
  /**
   * Identifies the writer, so a tab can recognise its own echo.
   *
   * Without it, applying every event unconditionally makes a tab re-apply the
   * change it just made, which is how cursor jitter and lost focus happen.
   */
  readonly originId: string;
}

/* ------------------------------------------------------------------ *
 * Storage state — quota, persistence, eviction (JUM-560)
 * ------------------------------------------------------------------ */

/**
 * What Cana knows about the durability of the copy it holds.
 *
 * Exposed rather than internal because, under the no-fallback requirement, an
 * application that cannot see this state cannot warn a user before their work is
 * gone.
 */
export interface CanaStorageState {
  /**
   * Whether the origin obtained persistent storage.
   *
   * `false` means the browser may reclaim the data under pressure. `unknown`
   * means the API is unavailable and durability cannot be claimed either way —
   * which is not the same as `false` and must not be flattened into it.
   */
  readonly persistent: boolean | 'unknown';
  /** Bytes in use, when the environment reports it. */
  readonly usageBytes?: number;
  /** Bytes available, when the environment reports it. */
  readonly quotaBytes?: number;
  /**
   * True once usage crosses the configured headroom threshold.
   *
   * Deliberately raised *before* hard failure so a consumer still has room to
   * offer an export or switch recovery strategy before writes start failing.
   */
  readonly nearQuota: boolean;
  /**
   * Set when the engine detected that a previously-existing database is gone.
   *
   * The flag exists so `Evicted` is reportable as a *state* and not only as an
   * error on the next write.
   */
  readonly evicted: boolean;
}

/* ------------------------------------------------------------------ *
 * Schema
 * ------------------------------------------------------------------ */

export interface CanaIndexSchema {
  readonly name: string;
  readonly keyPath: CanaKeyPath;
  readonly unique?: boolean;
  /**
   * Index each element of an array-valued key path separately.
   *
   * Mutually exclusive with a compound `keyPath` in IndexedDB; the schema
   * validator rejects the combination rather than letting the browser throw a
   * `DOMException` from somewhere less obvious.
   */
  readonly multiEntry?: boolean;
}

export interface CanaStoreSchema {
  readonly name: string;
  /**
   * Inbound key: the key lives inside the record at this path.
   *
   * Mutually exclusive with `autoIncrement` without a keyPath (outbound keys).
   * Getting this wrong is the most common source of silent divergence between
   * IndexedDB implementations, so the validator is explicit about it (JUM-404).
   */
  readonly keyPath?: CanaKeyPath;
  readonly autoIncrement?: boolean;
  readonly indexes?: readonly CanaIndexSchema[];
}

export interface CanaSchema {
  /** Integer, monotonically increasing. Downgrades are rejected, not attempted. */
  readonly version: number;
  readonly stores: readonly CanaStoreSchema[];
}

/* ------------------------------------------------------------------ *
 * Queries
 * ------------------------------------------------------------------ */

export interface CanaRange {
  readonly lower?: CanaKey;
  readonly upper?: CanaKey;
  readonly lowerOpen?: boolean;
  readonly upperOpen?: boolean;
}

export type CanaDirection = 'next' | 'prev' | 'nextunique' | 'prevunique';

/**
 * A query plan.
 *
 * `index` is the load-bearing field. A query that names no index and no key range
 * is a full scan, and the engine reports that in `CanaQueryPlan` so a caller can
 * tell an indexed lookup from a scan that merely happens to be fast on ten rows.
 */
export interface CanaQuery {
  readonly index?: string;
  readonly equals?: CanaKey;
  readonly range?: CanaRange;
  readonly direction?: CanaDirection;
  readonly offset?: number;
  readonly limit?: number;
  readonly distinct?: boolean;
}

/**
 * How the engine intends to satisfy a query.
 *
 * Exposed because the acceptance criterion for JUM-406 is that indexed queries
 * *use their index*: an implementation backed by in-memory array methods passes
 * every functional test and then fails at scale. This makes the distinction
 * assertable in a test rather than a matter of trust.
 */
export interface CanaQueryPlan {
  readonly store: string;
  readonly usedIndex?: string;
  readonly fullScan: boolean;
  readonly boundedByRange: boolean;
  /** Applied by the cursor, not after materialising the result set. */
  readonly appliedOffsetInCursor: boolean;
}

/* ------------------------------------------------------------------ *
 * Client surface
 * ------------------------------------------------------------------ */

export interface CanaWriteResult {
  readonly outcome: CanaWriteOutcome;
  readonly key?: CanaKey;
  /** Emitted only when `outcome === 'committed'`. */
  readonly events: readonly CanaChangeEvent[];
}

export interface CanaBulkWriteResult {
  readonly outcome: CanaWriteOutcome;
  readonly keys: readonly CanaKey[];
  /**
   * Indices within the input batch that failed, when the engine applied a
   * partial bulk.
   *
   * Present rather than collapsed into a single error because a caller
   * reconciling a 1000-row import needs to know *which* rows, and re-running the
   * whole batch is not always safe.
   */
  readonly failedAt?: readonly number[];
  readonly events: readonly CanaChangeEvent[];
}

export interface CanaTable<TRecord, TKey extends CanaKey = CanaKey> {
  readonly name: string;
  get(key: TKey): Promise<TRecord | undefined>;
  add(record: TRecord, key?: TKey): Promise<CanaWriteResult>;
  put(record: TRecord, key?: TKey): Promise<CanaWriteResult>;
  update(key: TKey, changes: Partial<TRecord>): Promise<CanaWriteResult>;
  delete(key: TKey): Promise<CanaWriteResult>;
  clear(): Promise<CanaWriteResult>;
  bulkAdd(records: readonly TRecord[]): Promise<CanaBulkWriteResult>;
  bulkPut(records: readonly TRecord[]): Promise<CanaBulkWriteResult>;
  bulkDelete(keys: readonly TKey[]): Promise<CanaBulkWriteResult>;
  count(query?: CanaQuery): Promise<number>;
  query(query?: CanaQuery): Promise<readonly TRecord[]>;
  /** Same as `query`, plus the plan the engine used. */
  explain(query?: CanaQuery): Promise<{ records: readonly TRecord[]; plan: CanaQueryPlan }>;
}

/**
 * Transaction scope.
 *
 * Deliberately does **not** expose commit or abort as separate awaits: the
 * IndexedDB auto-commit window closes as soon as the event loop yields with no
 * pending request, so a caller who awaits anything unrelated inside the scope
 * loses the transaction. The engine owns the boundary and reports
 * `TransactionInactive` when that happens, which is the honest failure rather
 * than a mysterious one (JUM-407).
 */
export interface CanaTransactionScope {
  table<TRecord, TKey extends CanaKey = CanaKey>(name: string): CanaTable<TRecord, TKey>;
  abort(reason?: string): void;
}

export type CanaTransactionMode = 'readonly' | 'readwrite';

/**
 * What a transaction reports back.
 *
 * `correlationId` and `attemptedAt` are present on **every** outcome, including
 * `unknown`. That is the point: `unknown` is the one result a caller must act
 * on, and acting on it means calling `resolveWrite(correlationId, attemptedAt)`.
 * An earlier shape omitted them, so the only outcome that needed reconciling was
 * the one that could not be reconciled.
 */
export interface CanaTransactionResult<TResult> {
  readonly outcome: CanaWriteOutcome;
  readonly result?: TResult;
  /** Empty unless `outcome === 'committed'`. */
  readonly events: readonly CanaChangeEvent[];
  /** Identifies this transaction in the operation ledger. */
  readonly correlationId: string;
  /** Epoch milliseconds the transaction was started. */
  readonly attemptedAt: number;
}

/**
 * Which physical store a client is using after a successful `open()`.
 *
 * `localStorage` is an explicit degraded mode: smaller quota, no real indexes,
 * and different transactional semantics than IndexedDB.
 */
export type CanaStorageBackend = 'indexeddb' | 'localStorage';

export interface CanaClient {
  readonly name: string;
  readonly version: number;
  /**
   * Set after `open()` resolves. `undefined` until then.
   *
   * Prefer IndexedDB; `localStorage` means the fallback path is active.
   */
  readonly backend?: CanaStorageBackend;

  open(): Promise<void>;
  close(): Promise<void>;

  table<TRecord, TKey extends CanaKey = CanaKey>(name: string): CanaTable<TRecord, TKey>;

  transaction<TResult>(
    mode: CanaTransactionMode,
    stores: readonly string[],
    body: (scope: CanaTransactionScope) => Promise<TResult> | TResult,
  ): Promise<CanaTransactionResult<TResult>>;

  /** Current durability state. See `CanaStorageState`. */
  storageState(): Promise<CanaStorageState>;

  /**
   * Subscribe to committed changes.
   *
   * `sinceCursor` is what makes recovery possible: a client that was closed
   * resumes from its last cursor instead of replaying from zero or silently
   * skipping the gap.
   */
  subscribe(
    listener: (event: CanaChangeEvent) => void,
    options?: { sinceCursor?: number },
  ): () => void;

  /**
   * Export the whole database as plain data.
   *
   * Part of the contract, not a utility: it is the recovery path when promoting
   * off a degraded localStorage session or when IndexedDB is about to be wiped.
   * It must work against either backend.
   */
  exportAll(): Promise<Record<string, readonly unknown[]>>;
}
