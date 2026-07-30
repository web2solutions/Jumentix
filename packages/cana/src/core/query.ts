/**
 * Query planning and cursor execution (JUM-406).
 *
 * The point of this file is a distinction that functional tests cannot see.
 *
 * An implementation that reads every record into an array and then filters it
 * passes every correctness test a query suite can write. It returns the right
 * rows in the right order for every input. It is also unusable at 100k records,
 * and the failure only appears on a user's machine with a real dataset, long
 * after the tests went green.
 *
 * So planning is separated from execution and the plan is returned to the
 * caller. `explain()` makes "this query used its index" and "the offset was
 * applied by the cursor rather than by slicing a materialised array" into things
 * a test can assert, instead of properties someone has to take on trust.
 *
 * The cursor path also does the work incrementally: `advance()` for the offset,
 * an early `return` at the limit. A query with `limit: 10` over a million rows
 * touches ten records, which is the behaviour the plan claims.
 */

import type { CanaQuery, CanaQueryPlan } from '../contracts';
import { translateError } from './errors';

/** Build the IndexedDB key range for a query, or null when unbounded. */
export function toKeyRange(query: CanaQuery | undefined): IDBKeyRange | null {
  if (!query) return null;

  if (query.equals !== undefined) {
    return IDBKeyRange.only(query.equals as IDBValidKey);
  }

  const { range } = query;
  if (!range) return null;

  const {
    lower, upper, lowerOpen = false, upperOpen = false
  } = range;

  if (lower !== undefined && upper !== undefined) {
    return IDBKeyRange.bound(lower as IDBValidKey, upper as IDBValidKey, lowerOpen, upperOpen);
  }
  if (lower !== undefined) return IDBKeyRange.lowerBound(lower as IDBValidKey, lowerOpen);
  if (upper !== undefined) return IDBKeyRange.upperBound(upper as IDBValidKey, upperOpen);

  return null;
}

/**
 * Decide how a query will be satisfied, before running it.
 *
 * `fullScan` is true only when nothing narrows the read: no index and no bound.
 * That is the case worth flagging, because it is the one that degrades with
 * data volume rather than with query complexity.
 */
export function planQuery(store: string, query: CanaQuery | undefined): CanaQueryPlan {
  const boundedByRange = toKeyRange(query) !== null;
  const usedIndex = query?.index;

  return {
    store,
    ...(usedIndex === undefined ? {} : { usedIndex }),
    fullScan: usedIndex === undefined && !boundedByRange,
    boundedByRange,
    // The offset is honoured by advancing the cursor, never by discarding the
    // front of a fully materialised result set.
    appliedOffsetInCursor: (query?.offset ?? 0) > 0
  };
}

function directionOf(query: CanaQuery | undefined): IDBCursorDirection {
  if (query?.direction) return query.direction;
  return query?.distinct ? 'nextunique' : 'next';
}

/** The source a query reads from: an index when one is named, else the store. */
function sourceFor(store: IDBObjectStore, query: CanaQuery | undefined): IDBObjectStore | IDBIndex {
  if (!query?.index) return store;
  try {
    return store.index(query.index);
  } catch (error) {
    // A named index that does not exist is a caller mistake, and the raw
    // NotFoundError does not say which index or which store.
    throw translateError(error, { store: store.name });
  }
}

/**
 * Execute a query with a cursor, applying offset and limit as it goes.
 *
 * Written against the cursor rather than `getAll` because `getAll` cannot skip
 * and cannot stop: it materialises the whole matching set before any limit is
 * applied, which defeats the plan this module publishes.
 */
export function runQuery<TRecord>(
  store: IDBObjectStore,
  query: CanaQuery | undefined
): Promise<readonly TRecord[]> {
  const source = sourceFor(store, query);
  const range = toKeyRange(query);
  const offset = query?.offset ?? 0;
  const limit = query?.limit;

  return new Promise<readonly TRecord[]>((resolve, reject) => {
    const records: TRecord[] = [];
    let skipped = false;

    let request: IDBRequest<IDBCursorWithValue | null>;
    try {
      request = source.openCursor(range, directionOf(query));
    } catch (error) {
      reject(translateError(error, { store: store.name }));
      return;
    }

    request.onerror = () => reject(translateError(request.error, { store: store.name }));

    request.onsuccess = () => {
      const cursor = request.result;

      if (!cursor) {
        resolve(records);
        return;
      }

      // `advance` is what makes `appliedOffsetInCursor` true rather than
      // aspirational: the skipped records are never read.
      if (offset > 0 && !skipped) {
        skipped = true;
        cursor.advance(offset);
        return;
      }

      records.push(cursor.value as TRecord);

      if (limit !== undefined && records.length >= limit) {
        // Stop here. Continuing would read the rest of the range to discard it.
        resolve(records);
        return;
      }

      cursor.continue();
    };
  });
}

/**
 * Count matching records without materialising them.
 *
 * `count()` on the store or index is a single request; counting by reading rows
 * would be the same mistake this module exists to avoid. `offset` and `limit`
 * are not expressible in a native count, so a query carrying them falls back to
 * the cursor — stated here rather than silently ignoring them, which would make
 * `count` disagree with `query` on the same input.
 */
export function runCount(
  store: IDBObjectStore,
  query: CanaQuery | undefined
): Promise<number> {
  if ((query?.offset ?? 0) > 0 || query?.limit !== undefined) {
    return runQuery(store, query).then((records) => records.length);
  }

  const source = sourceFor(store, query);
  const range = toKeyRange(query);

  return new Promise<number>((resolve, reject) => {
    let request: IDBRequest<number>;
    try {
      request = range === null ? source.count() : source.count(range);
    } catch (error) {
      reject(translateError(error, { store: store.name }));
      return;
    }
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(translateError(request.error, { store: store.name }));
  });
}
