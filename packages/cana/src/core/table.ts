/**
 * Table operations: CRUD and bulk (JUM-405).
 *
 * Everything here runs inside a transaction supplied by the caller, and every
 * write records a change event into that transaction's buffer rather than
 * emitting one. The buffer is released only if the transaction commits — see
 * `transaction.ts` for why announcing a write before it is durable is worse
 * than announcing it late.
 *
 * Two decisions in this file are worth stating, because both are places where
 * the convenient behaviour is the wrong one:
 *
 * 1. **`update` is read-modify-write inside the same transaction.** Reading in
 *    one transaction and writing in another is a lost update the moment two
 *    tabs touch the same record, and offline-first apps have two tabs open
 *    constantly. Because the read is an IndexedDB request, awaiting it does not
 *    close the auto-commit window.
 *
 * 2. **`update` on a missing key fails rather than inserting.** An upsert
 *    disguised as an update turns a stale key — a record another tab deleted —
 *    into a resurrected row that no longer has the fields the rest of the schema
 *    expects. `put` is available for callers who genuinely mean upsert.
 */

import type {
  CanaBulkWriteResult,
  CanaChangeType,
  CanaKey,
  CanaQuery,
  CanaQueryMetrics,
  CanaQueryPlan,
  CanaTable,
  CanaWriteResult
} from '../contracts';
import { canaError, requestToPromise, translateError } from './errors';
import {
  planQuery, runCount, runQuery, runQueryWithMetrics
} from './query';
import type { CanaHooks } from './hooks';
import { applyBeforeWrite } from './hooks';
import type { ChangeBuffer } from './transaction';

export interface TableContext {
  readonly transaction: IDBTransaction;
  readonly buffer: ChangeBuffer;
  readonly correlationId: string;
  readonly hooks?: CanaHooks;
}

/** Whether the store carries its key inside the record. */
function isInbound(store: IDBObjectStore): boolean {
  return store.keyPath !== null;
}

function assertKeyUsage(store: IDBObjectStore, key: CanaKey | undefined, operation: string): void {
  if (key !== undefined && isInbound(store)) {
    // IndexedDB reports this as a bare DataError, which does not say that the
    // store's own keyPath is the reason the explicit key is unacceptable.
    throw canaError(
      'InvalidRequest',
      `${operation} on "${store.name}" was given an explicit key, but the store has an inbound `
        + `keyPath (${String(store.keyPath)}). The key must live inside the record.`,
      { store: store.name, key }
    );
  }
  if (key === undefined && !isInbound(store) && !store.autoIncrement) {
    throw canaError(
      'InvalidRequest',
      `${operation} on "${store.name}" needs an explicit key: the store uses outbound keys and `
        + 'does not generate them.',
      { store: store.name }
    );
  }
}

/** Read an inbound key out of a record, following a simple or compound keyPath. */
function extractKey(store: IDBObjectStore, record: unknown): CanaKey | undefined {
  // Callers only reach this behind `isInbound()`, which already requires a
  // non-null keyPath. Outbound stores never ask.
  const path = store.keyPath as string | string[];

  const read = (segments: string): unknown => segments
    .split('.')
    .reduce<unknown>(
      (value, segment) => (value === null || typeof value !== 'object'
        ? undefined
        : (value as Record<string, unknown>)[segment]),
      record
    );

  if (Array.isArray(path)) {
    const parts = path.map((segment) => read(segment));
    return parts.some((part) => part === undefined) ? undefined : (parts as CanaKey);
  }
  return read(path) as CanaKey | undefined;
}

/**
 * A table bound to one transaction.
 *
 * A closure rather than a class: the transaction, buffer and correlation id are
 * fixed for the table's whole lifetime, so there is no mutable state and no
 * method that can be called on a half-configured instance.
 */
export function createTable<TRecord, TKey extends CanaKey = CanaKey>(
  name: string,
  context: TableContext
): CanaTable<TRecord, TKey> {
  const store = (): IDBObjectStore => {
    try {
      return context.transaction.objectStore(name);
    } catch (error) {
      // Reached when the store was not in the transaction's scope, or when the
      // transaction has already finished — the auto-commit case, which is the
      // single most common misuse and deserves to say so.
      throw translateError(error, { store: name });
    }
  };

  const record = (type: CanaChangeType, key: CanaKey | undefined, value?: unknown): void => {
    context.buffer.record({
      type,
      store: name,
      correlationId: context.correlationId,
      ...(key === undefined ? {} : { key }),
      ...(value === undefined ? {} : { record: value })
    } as Parameters<ChangeBuffer['record']>[0]);
  };

  /**
   * Run `beforeWrite` and return what should actually be written.
   *
   * Called before the IndexedDB request is issued, so a veto costs nothing and a
   * transform is what lands on disk rather than something reconciled afterwards.
   */
  const throughHooks = (
    type: CanaChangeType,
    key: CanaKey | undefined,
    value: unknown
  ): unknown => applyBeforeWrite(
    context.hooks,
    {
      store: name,
      type,
      correlationId: context.correlationId,
      // Callers only reach throughHooks for writes that carry a record. Delete
      // uses `record()` directly and never asks the hook.
      record: value,
      ...(key === undefined ? {} : { key })
    },
    value
  );

  // Generic over the request's result type because `IDBRequest<T>` is invariant:
  // `add`/`put` resolve to a key and `delete` resolves to undefined, and no
  // single non-generic signature accepts both.
  const bulk = async <TWritten extends IDBValidKey | undefined>(
    items: readonly unknown[],
    apply: (target: IDBObjectStore, item: unknown) => IDBRequest<TWritten>,
    type: CanaChangeType,
    /**
     * True for `bulkPut`, where each row may be either a create or an update.
     *
     * Without this a bulk put labelled every row `updated`, including brand-new
     * records — so a subscriber driving an incremental UI would never learn a
     * row had appeared, and `beforeWrite` hooks saw the wrong type. The single
     * `put` had always probed; the bulk path silently did not.
     */
    classifyPerItem = false
  ): Promise<CanaBulkWriteResult> => {
    const target = store();
    const keys: CanaKey[] = [];

    for (let index = 0; index < items.length; index += 1) {
      const source = items[index];

      // Probed before the write, since afterwards every row exists.
      let itemType = type;
      const probeKey = classifyPerItem && isInbound(target)
        ? extractKey(target, source)
        : undefined;
      if (probeKey !== undefined) {
        // Sequential for the same reason the write below is: the probe belongs
        // to this row and must not race ahead of it.
        // eslint-disable-next-line no-await-in-loop
        const existing = await requestToPromise(
          target.count(probeKey as IDBValidKey),
          { store: name }
        );
        itemType = existing > 0 ? 'updated' : 'created';
      } else if (classifyPerItem) {
        // Outbound or generated key: nothing to probe with, so the row can only
        // be treated as new.
        itemType = 'created';
      }

      // A delete carries no record, so there is nothing for a hook to transform.
      const item = itemType === 'deleted'
        ? source
        : throughHooks(itemType, undefined, source);
      // Sequential on purpose. Issuing every request up front and awaiting them
      // together reorders the writes relative to the input — which is precisely
      // the information a caller reconciling a partial import needs to be correct.
      // eslint-disable-next-line no-await-in-loop
      const written = await requestToPromise(apply(target, item), { store: name });
      // `delete` resolves to undefined, so the key is the input itself; for
      // add/put it is what the store assigned, which may be generated.
      const key = (written ?? item) as CanaKey;
      keys.push(key);
      record(itemType, key, itemType === 'deleted' ? undefined : item);
    }

    return {
      outcome: 'committed',
      keys,
      events: []
    };
  };

  return {
    name,

    get(key: TKey): Promise<TRecord | undefined> {
      return requestToPromise<TRecord | undefined>(
        store().get(key as IDBValidKey) as IDBRequest<TRecord | undefined>,
        { store: name, key }
      );
    },

    async add(value: TRecord, key?: TKey): Promise<CanaWriteResult> {
      const target = store();
      assertKeyUsage(target, key, 'add');

      const writing = throughHooks('created', key, value) as TRecord;
      const written = await requestToPromise(
        key === undefined ? target.add(writing) : target.add(writing, key as IDBValidKey),
        { store: name, key }
      );

      record('created', written as CanaKey, writing);
      return { outcome: 'committed', key: written as CanaKey, events: [] };
    },

    async put(value: TRecord, key?: TKey): Promise<CanaWriteResult> {
      const target = store();
      assertKeyUsage(target, key, 'put');

      // Whether this is a create or an update is only knowable by looking first,
      // and subscribers depend on the distinction. The read is an IDB request in
      // the same transaction, so it costs a request, not the transaction.
      const probeKey = key ?? (isInbound(target) ? extractKey(target, value) : undefined);
      const existed = probeKey === undefined
        ? false
        : (await requestToPromise(target.count(probeKey as IDBValidKey), { store: name })) > 0;

      const writing = throughHooks(existed ? 'updated' : 'created', key, value) as TRecord;
      const written = await requestToPromise(
        key === undefined ? target.put(writing) : target.put(writing, key as IDBValidKey),
        { store: name, key }
      );

      record(existed ? 'updated' : 'created', written as CanaKey, writing);
      return { outcome: 'committed', key: written as CanaKey, events: [] };
    },

    async update(key: TKey, changes: Partial<TRecord>): Promise<CanaWriteResult> {
      const target = store();

      const current = await requestToPromise<TRecord | undefined>(
        target.get(key as IDBValidKey) as IDBRequest<TRecord | undefined>,
        { store: name, key }
      );

      if (current === undefined) {
        throw canaError(
          'NotFound',
          `Cannot update "${String(key)}" in "${name}": no such record. `
            + 'update does not insert — use put when an upsert is intended.',
          { store: name, key }
        );
      }

      const merged = throughHooks('updated', key, { ...current, ...changes }) as TRecord;
      const written = await requestToPromise(
        isInbound(target) ? target.put(merged) : target.put(merged, key as IDBValidKey),
        { store: name, key }
      );

      record('updated', written as CanaKey, merged);
      return { outcome: 'committed', key: written as CanaKey, events: [] };
    },

    async delete(key: TKey): Promise<CanaWriteResult> {
      const target = store();

      // Deleting a key that is not there succeeds silently in IndexedDB.
      // Checking first is what keeps a change event from claiming a deletion
      // that removed nothing, which a subscriber would otherwise act on.
      const present = await requestToPromise(target.count(key as IDBValidKey), { store: name });

      await requestToPromise(target.delete(key as IDBValidKey), { store: name, key });

      if (present > 0) record('deleted', key);
      return { outcome: 'committed', key, events: [] };
    },

    async clear(): Promise<CanaWriteResult> {
      await requestToPromise(store().clear(), { store: name });
      record('cleared', undefined);
      return { outcome: 'committed', events: [] };
    },

    bulkAdd(records: readonly TRecord[]): Promise<CanaBulkWriteResult> {
      return bulk(records, (target, item) => target.add(item), 'created');
    },

    bulkPut(records: readonly TRecord[]): Promise<CanaBulkWriteResult> {
      // `classifyPerItem` so each row reports created or updated as it actually
      // is, matching what the single `put` has always done.
      return bulk(records, (target, item) => target.put(item), 'updated', true);
    },

    bulkDelete(keys: readonly TKey[]): Promise<CanaBulkWriteResult> {
      return bulk(
        keys,
        (target, item) => target.delete(item as IDBValidKey) as IDBRequest<undefined>,
        'deleted'
      );
    },

    count(query?: CanaQuery): Promise<number> {
      return runCount(store(), query);
    },

    query(query?: CanaQuery): Promise<readonly TRecord[]> {
      return runQuery<TRecord>(store(), query);
    },

    async explain(
      query?: CanaQuery
    ): Promise<{
      records: readonly TRecord[];
      plan: CanaQueryPlan;
      metrics: CanaQueryMetrics;
    }> {
      const plan = planQuery(name, query);
      const { records, recordsExamined, cursorAdvanced } = await runQueryWithMetrics<TRecord>(
        store(),
        query
      );
      return { records, plan, metrics: { recordsExamined, cursorAdvanced } };
    }
  };
}
