/**
 * Transaction boundary and write outcome (JUM-407).
 *
 * The engine owns the boundary; callers never commit. That is a deliberate
 * restriction, and it exists because of one IndexedDB behaviour that surprises
 * everybody exactly once:
 *
 *   A transaction auto-commits as soon as the event loop yields with no pending
 *   request against it.
 *
 * So `await fetch(...)` inside a transaction scope does not pause the
 * transaction — it ends it. The next store call then throws
 * `TransactionInactiveError` from a line that looks entirely innocent. Exposing
 * `commit()` would suggest the caller controls a lifetime they do not control.
 *
 * Awaiting an IndexedDB *request* is fine: its promise resolves in a microtask
 * from the success handler, and microtasks run before the task yields, so the
 * transaction stays alive. That distinction — IDB awaits are safe, foreign
 * awaits are fatal — is the entire usage rule, and `runTransaction` reports the
 * violation as `TransactionInactive` with a message that says so, rather than
 * letting a bare DOMException escape.
 *
 * ## Why events are buffered
 *
 * Change events are collected during the body and released **only** after
 * `oncomplete`. Emitting them as writes happen would announce changes that a
 * later abort rolls back, and a subscriber that has already acted on a
 * phantom event has no way to learn it never happened. Buffering means
 * `CanaChangeEvent` carries the meaning its name implies: this is on disk.
 */

import type {
  CanaChangeEvent,
  CanaTransactionMode,
  CanaWriteOutcome
} from '../contracts';
import { canaError, translateError } from './errors';

/**
 * An event as a writer supplies it. The buffer stamps the three fields a writer
 * has no business choosing: the sequence number, the origin, and the clock.
 */
export type PendingChange = Omit<CanaChangeEvent, 'cursor' | 'originId' | 'at'>;

/** Collects events during a transaction, releasing them only on commit. */
export interface ChangeBuffer {
  record(event: PendingChange): void;
  /** The buffered events. Callers release these only after a commit. */
  drain(): readonly CanaChangeEvent[];
  discard(): void;
}

export function createChangeBuffer(
  nextCursor: () => number,
  originId: string,
  now: () => number = Date.now
): ChangeBuffer {
  const pending: CanaChangeEvent[] = [];

  return {
    record(event) {
      // Built structurally rather than with a cast. An earlier version asserted
      // `as CanaChangeEvent` over a spread, which silenced the compiler while
      // the contract's required `at` was never actually set — the cast defeated
      // the only check that would have caught it.
      pending.push({
        ...event, cursor: nextCursor(), originId, at: now()
      });
    },
    drain() {
      return pending.splice(0, pending.length);
    },
    discard() {
      pending.length = 0;
    }
  };
}

export interface TransactionOutcome<TResult> {
  readonly outcome: CanaWriteOutcome;
  readonly result?: TResult;
  readonly events: readonly CanaChangeEvent[];
}

interface RunOptions<TResult> {
  readonly database: IDBDatabase;
  readonly stores: readonly string[];
  readonly mode: CanaTransactionMode;
  readonly buffer: ChangeBuffer;
  readonly body: (transaction: IDBTransaction) => Promise<TResult> | TResult;
}

/**
 * Run a body inside one transaction and report a three-state outcome.
 *
 * `unknown` is not defensive padding. A transaction can be torn down without
 * either `complete` or `abort` firing — the tab closes, the worker is killed,
 * the browser reclaims the page mid-flush. A two-state result forces that case
 * to be reported as one of the two things it is not, and a caller reconciling
 * after a crash then either loses a committed write or duplicates one. Saying
 * `unknown` is less convenient and it is the truth (JUM-559).
 */
export async function runTransaction<TResult>(
  options: RunOptions<TResult>
): Promise<TransactionOutcome<TResult>> {
  const {
    database, stores, mode, buffer, body
  } = options;

  let transaction: IDBTransaction;
  try {
    transaction = database.transaction([...stores], mode);
  } catch (error) {
    buffer.discard();
    throw translateError(error);
  }

  let settled: 'complete' | 'abort' | 'error' | undefined;

  // Attached before the body runs. Registering them afterwards would miss an
  // abort that a synchronous failure inside the body triggers immediately.
  const finished = new Promise<'complete' | 'abort' | 'error'>((resolve) => {
    transaction.oncomplete = () => { settled = 'complete'; resolve('complete'); };
    transaction.onabort = () => { settled = 'abort'; resolve('abort'); };
    transaction.onerror = () => { settled = 'error'; resolve('error'); };
  });

  let result: TResult | undefined;
  let bodyFailure: unknown;

  try {
    result = await body(transaction);
  } catch (error) {
    bodyFailure = error;
    // Abort explicitly rather than letting the transaction commit whatever
    // succeeded before the failure. A half-applied batch that reports success is
    // the worst of the available outcomes.
    if (settled === undefined) {
      try {
        transaction.abort();
      } catch {
        // Already finishing; the settled state below is what counts.
      }
    }
  }

  const ending = await finished;

  if (ending === 'complete') {
    if (bodyFailure !== undefined) {
      // The body failed but the transaction committed anyway — the auto-commit
      // window closed before the abort landed. What is on disk no longer matches
      // what the caller asked for, and neither 'committed' nor 'rolled-back'
      // describes it.
      buffer.discard();
      return { outcome: 'unknown', events: [] };
    }
    return { outcome: 'committed', result, events: buffer.drain() };
  }

  buffer.discard();

  if (bodyFailure !== undefined) throw translateError(bodyFailure);

  throw canaError(
    'TransactionAborted',
    `Transaction over [${stores.join(', ')}] ${ending === 'abort' ? 'was aborted' : 'failed'} `
        + 'before committing. Nothing was written.',
    { cause: transaction.error }
  );
}

/**
 * Wrap a caller-triggered abort so the reason survives.
 *
 * `IDBTransaction.abort()` discards any reason, so an aborted transaction
 * otherwise reports only that something went wrong somewhere.
 */
export function abortWithReason(transaction: IDBTransaction, reason?: string): never {
  try {
    transaction.abort();
  } catch {
    // Already ending.
  }
  throw canaError(
    'TransactionAborted',
    reason ?? 'Transaction aborted by the caller. Nothing was written.'
  );
}
