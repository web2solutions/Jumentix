/**
 * Resolving the `unknown` write outcome (JUM-559, JUM-411).
 *
 * `unknown` is honest but useless on its own. A caller told "your write may or
 * may not have landed" has two bad options: retry, and risk duplicating it; or
 * skip, and risk losing it. Reporting the ambiguity is better than lying about
 * it, but the ambiguity still has to be resolved by someone.
 *
 * This resolves it, using the one thing IndexedDB actually guarantees: a
 * transaction is atomic. So the operation id is written **into the same
 * transaction as the data**. There is no window between them — the store cannot
 * commit one and not the other.
 *
 * Afterwards the question "did my write commit?" becomes a lookup:
 *
 *   ledger contains the id  ->  it committed
 *   ledger does not         ->  it did not
 *
 * That holds across a killed worker, a closed tab, or a browser that was
 * force-quit mid-flush, because it does not depend on anything in memory
 * surviving. It is the reason `CanaWriteOutcome` has three states rather than a
 * boolean and a shrug.
 *
 * The ledger is pruned by age. An unbounded one grows forever; a pruned one can
 * only answer about recent operations, and `resolveOutcome` says
 * `'unresolvable'` past the horizon rather than inferring `'rolled-back'` from
 * an absence it cannot distinguish from a deletion.
 */

import type { CanaWriteOutcome } from '../contracts';
import { requestToPromise } from './errors';

/** The store the ledger lives in. Present in every Cana schema. */
export const OPERATION_LEDGER_STORE = '__cana_operations';

export interface OperationRecord {
  readonly id: string;
  readonly at: number;
  readonly stores: readonly string[];
}

/** How long a completed operation stays answerable. */
export const DEFAULT_LEDGER_HORIZON_MS = 24 * 60 * 60 * 1000;

/**
 * The outcome of a resolution attempt.
 *
 * `unresolvable` is separate from `rolled-back` on purpose. Both look like "the
 * id is not there", but one means the write definitely did not happen and the
 * other means the evidence has been pruned. Collapsing them would turn a
 * committed-but-forgotten write into a confident "it did not commit", which is
 * exactly the duplicate-write bug this file exists to prevent.
 */
export type ResolvedOutcome =
  | Extract<CanaWriteOutcome, 'committed' | 'rolled-back'>
  | 'unresolvable';

/** The ledger's own store declaration, in the shape a Cana schema expects. */
interface LedgerStoreSchema {
  name: string;
  keyPath: string;
  indexes: { name: string; keyPath: string }[];
}

/** Add the ledger store to a schema's store list if it is not already there. */
export function withLedgerStore<TStore extends { name: string }>(
  stores: readonly TStore[]
): readonly (TStore | LedgerStoreSchema)[] {
  if (stores.some((store) => store.name === OPERATION_LEDGER_STORE)) return stores;
  return [
    ...stores,
    {
      name: OPERATION_LEDGER_STORE,
      keyPath: 'id',
      // Indexed by time so pruning is a bounded range delete rather than a scan
      // of every operation ever recorded.
      indexes: [{ name: 'byTime', keyPath: 'at' }]
    }
  ];
}

/**
 * Record an operation id inside a transaction that is already in progress.
 *
 * Must be called with a transaction whose scope includes the ledger store, and
 * the same one the data is written in — that shared transaction is the entire
 * guarantee. Recording it separately afterwards would reintroduce the window
 * this is meant to close.
 */
export function recordOperation(
  transaction: IDBTransaction,
  operation: OperationRecord
): Promise<IDBValidKey> {
  return requestToPromise(
    transaction.objectStore(OPERATION_LEDGER_STORE).put({ ...operation }),
    { store: OPERATION_LEDGER_STORE }
  );
}

/**
 * Ask whether an operation committed.
 *
 * `attemptedAt` is required, and it is the whole reason this can answer at all.
 * A missing id means one of two very different things — the write never
 * committed, or its record was pruned — and nothing in the ledger itself can
 * tell them apart, precisely because the evidence is what is missing. Knowing
 * when the operation was attempted does distinguish them:
 *
 *   attempted inside the horizon  ->  the record would still be here if it had
 *                                     committed, so it did not: 'rolled-back'
 *   attempted before the horizon  ->  a committed record could have been pruned
 *                                     by now: 'unresolvable'
 *
 * The caller has `attemptedAt` because it is the one that issued the write and
 * had to persist the pending operation somewhere to be asking this at all.
 */
export async function resolveOutcome(
  database: IDBDatabase,
  operationId: string,
  attemptedAt: number,
  options: { horizonMs?: number; now?: number } = {}
): Promise<ResolvedOutcome> {
  const horizonMs = options.horizonMs ?? DEFAULT_LEDGER_HORIZON_MS;
  const now = options.now ?? Date.now();

  if (!database.objectStoreNames.contains(OPERATION_LEDGER_STORE)) {
    // No ledger means no evidence either way. Saying 'rolled-back' here would be
    // a guess dressed as a fact.
    return 'unresolvable';
  }

  const transaction = database.transaction(OPERATION_LEDGER_STORE, 'readonly');
  const found = await requestToPromise<OperationRecord | undefined>(
    transaction.objectStore(OPERATION_LEDGER_STORE).get(operationId) as IDBRequest<
      OperationRecord | undefined
    >,
    { store: OPERATION_LEDGER_STORE }
  );

  if (found) return 'committed';

  return now - attemptedAt > horizonMs ? 'unresolvable' : 'rolled-back';
}

/**
 * Delete ledger entries older than the horizon.
 *
 * A bounded range delete over the time index, not a scan: the ledger is written
 * on every transaction, so pruning it must not cost more than the writes do.
 */
export async function pruneLedger(
  database: IDBDatabase,
  options: { horizonMs?: number; now?: number } = {}
): Promise<number> {
  const horizonMs = options.horizonMs ?? DEFAULT_LEDGER_HORIZON_MS;
  const now = options.now ?? Date.now();
  const cutoff = now - horizonMs;

  if (!database.objectStoreNames.contains(OPERATION_LEDGER_STORE)) return 0;

  const transaction = database.transaction(OPERATION_LEDGER_STORE, 'readwrite');
  const index = transaction.objectStore(OPERATION_LEDGER_STORE).index('byTime');

  return new Promise<number>((resolve, reject) => {
    let removed = 0;
    const request = index.openCursor(IDBKeyRange.upperBound(cutoff, true));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(removed);
        return;
      }
      cursor.delete();
      removed += 1;
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}
