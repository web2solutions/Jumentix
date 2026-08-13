/**
 * localStorage fallback backend (JUM-615).
 *
 * When IndexedDB cannot open, Cana degrades explicitly to this store rather than
 * failing closed. Capacity, transactional semantics and index behaviour differ —
 * callers see `backend === 'localStorage'` and a degraded durability assessment.
 *
 * Persistence is one JSON document per database name. A transaction copies the
 * snapshot, mutates the copy, and writes it back atomically on commit. There is
 * no dual-write with IndexedDB and no auto-promote between the two.
 */

import type {
  CanaBulkWriteResult,
  CanaChangeType,
  CanaKey,
  CanaQuery,
  CanaQueryMetrics,
  CanaQueryPlan,
  CanaSchema,
  CanaStoreSchema,
  CanaTable,
  CanaTransactionMode,
  CanaTransactionResult,
  CanaTransactionScope,
  CanaWriteResult
} from '../contracts';
import { canaError } from './errors';
import type { CanaHooks } from './hooks';
import { applyBeforeWrite } from './hooks';
import { OPERATION_LEDGER_STORE, withLedgerStore } from './reconciliation';
import type { ChangeBuffer } from './transaction';
import { createChangeBuffer } from './transaction';
import { planQuery } from './query';

const STORAGE_PREFIX = 'cana.ls.v1:';

export interface LocalStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface LsSnapshot {
  version: number;
  stores: Record<string, Record<string, unknown>>;
  sequences: Record<string, number>;
}

export interface LocalStorageBackendOptions {
  readonly name: string;
  readonly schema: CanaSchema;
  readonly storage?: LocalStorageLike;
  readonly hooks?: CanaHooks;
  readonly originId: string;
  readonly nextCursor: () => number;
  readonly operationLedger?: boolean;
}

function browserLocalStorage(): LocalStorageLike | undefined {
  if (typeof localStorage === 'undefined' || !localStorage) return undefined;
  try {
    const probe = `${STORAGE_PREFIX}__probe__`;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return undefined;
  }
}

function storageKey(name: string): string {
  return `${STORAGE_PREFIX}${name}`;
}

function serializeKey(key: CanaKey): string {
  return JSON.stringify(key);
}

/**
 * Read a simple or compound keyPath out of a record.
 *
 * A string path walks dotted segments (`'meta.id'`). An array path is a compound
 * key — each entry is read independently and the parts form the key array —
 * matching IndexedDB / `extractKey` in `table.ts`. Treating `['owner', 'id']`
 * as a nested walk would silently miss every compound inbound key.
 */
function readPath(record: unknown, path: string | readonly string[]): unknown {
  const read = (segments: string): unknown => {
    let value: unknown = record;
    for (const segment of segments.split('.')) {
      if (value === null || typeof value !== 'object') return undefined;
      value = (value as Record<string, unknown>)[segment];
    }
    return value;
  };

  if (Array.isArray(path)) {
    const parts = path.map((segment) => read(segment));
    return parts.some((part) => part === undefined) ? undefined : parts;
  }
  return read(String(path));
}

function writePath(record: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split('.');
  let cursor: Record<string, unknown> = record;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i]!;
    const next = cursor[segment];
    if (next === null || typeof next !== 'object') {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, unknown>;
  }
  cursor[segments[segments.length - 1]!] = value;
}

function emptySnapshot(schema: CanaSchema): LsSnapshot {
  const stores: Record<string, Record<string, unknown>> = {};
  const sequences: Record<string, number> = {};
  for (const store of schema.stores) {
    stores[store.name] = {};
    sequences[store.name] = 0;
  }
  return { version: schema.version, stores, sequences };
}

function cloneSnapshot(snapshot: LsSnapshot): LsSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as LsSnapshot;
}

function persist(storage: LocalStorageLike, name: string, snapshot: LsSnapshot): void {
  try {
    storage.setItem(storageKey(name), JSON.stringify(snapshot));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/quota/i.test(message) || (error as { name?: string }).name === 'QuotaExceededError') {
      throw canaError(
        'QuotaExceeded',
        `localStorage quota exceeded while writing "${name}". The fallback store did not accept `
          + 'the write.',
        { cause: error }
      );
    }
    throw canaError(
      'Unavailable',
      `localStorage refused a write for "${name}": ${message}`,
      { cause: error }
    );
  }
}

function loadSnapshot(
  storage: LocalStorageLike,
  name: string,
  schema: CanaSchema
): LsSnapshot {
  let raw: string | null;
  try {
    raw = storage.getItem(storageKey(name));
  } catch (error) {
    throw canaError(
      'Unavailable',
      `localStorage refused a read for "${name}". IndexedDB was unavailable and the fallback `
        + 'store cannot be opened either.',
      { cause: error }
    );
  }
  if (!raw) return emptySnapshot(schema);
  try {
    const parsed = JSON.parse(raw) as LsSnapshot;
    if (typeof parsed.version !== 'number' || typeof parsed.stores !== 'object') {
      throw new Error('malformed');
    }
    if (parsed.version > schema.version) {
      throw canaError(
        'UpgradeFailed',
        `Refusing to downgrade localStorage database "${name}" from version ${parsed.version} `
          + `to ${schema.version}.`
      );
    }
    // Ensure every schema store exists (upgrade by adding empty stores).
    const next = cloneSnapshot(parsed);
    for (const store of schema.stores) {
      next.stores[store.name] ??= {};
      next.sequences[store.name] ??= 0;
    }
    if (parsed.version < schema.version) {
      const upgraded: LsSnapshot = { ...next, version: schema.version };
      persist(storage, name, upgraded);
      return upgraded;
    }
    return next;
  } catch (error) {
    if ((error as { canaError?: boolean }).canaError) throw error;
    throw canaError(
      'Internal',
      `localStorage database "${name}" is corrupted and cannot be opened.`,
      { cause: String(error) }
    );
  }
}

function storeSchema(schema: CanaSchema, name: string): CanaStoreSchema {
  const found = schema.stores.find((store) => store.name === name);
  if (!found) {
    throw canaError('InvalidRequest', `Unknown store "${name}".`, { store: name });
  }
  return found;
}

function compareKeys(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (Array.isArray(a) && Array.isArray(b)) {
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i += 1) {
      const part = compareKeys(a[i], b[i]);
      if (part !== 0) return part;
    }
    return a.length - b.length;
  }
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

function inRange(value: unknown, query: CanaQuery | undefined): boolean {
  if (!query) return true;
  if (query.equals !== undefined) return compareKeys(value, query.equals) === 0;
  const { range } = query;
  if (!range) return true;
  if (range.lower !== undefined) {
    const cmp = compareKeys(value, range.lower);
    if (range.lowerOpen ? cmp <= 0 : cmp < 0) return false;
  }
  if (range.upper !== undefined) {
    const cmp = compareKeys(value, range.upper);
    if (range.upperOpen ? cmp >= 0 : cmp > 0) return false;
  }
  return true;
}

function indexValue(
  schema: CanaStoreSchema,
  record: unknown,
  query: CanaQuery | undefined
): unknown {
  if (!query?.index) {
    if (schema.keyPath === undefined) return undefined;
    return readPath(record, schema.keyPath);
  }
  const index = schema.indexes?.find((entry) => entry.name === query.index);
  if (!index) {
    throw canaError(
      'InvalidRequest',
      `Store "${schema.name}" has no index "${query.index}".`,
      { store: schema.name }
    );
  }
  return readPath(record, index.keyPath);
}

function runLocalQuery<TRecord>(
  schema: CanaStoreSchema,
  bag: Record<string, unknown>,
  query: CanaQuery | undefined
): TRecord[] {
  let rows = Object.entries(bag).map(([encoded, record]) => ({
    key: JSON.parse(encoded) as CanaKey,
    record: record as TRecord,
    sortKey: indexValue(schema, record, query) ?? JSON.parse(encoded)
  }));

  rows = rows.filter((row) => inRange(row.sortKey, query));

  const direction = query?.direction ?? 'next';
  const reverse = direction === 'prev' || direction === 'prevunique';
  rows.sort((left, right) => {
    const cmp = compareKeys(left.sortKey, right.sortKey);
    return reverse ? -cmp : cmp;
  });

  if (query?.distinct) {
    const seen = new Set<string>();
    rows = rows.filter((row) => {
      const token = serializeKey(row.sortKey as CanaKey);
      if (seen.has(token)) return false;
      seen.add(token);
      return true;
    });
  }

  const offset = query?.offset ?? 0;
  const limit = query?.limit;
  rows = rows.slice(offset, limit === undefined ? undefined : offset + limit);
  return rows.map((row) => row.record);
}

interface TxState {
  snapshot: LsSnapshot;
}

/**
 * Open a localStorage-backed database, or throw `Unavailable` when the store
 * cannot be used at all.
 */
export function openLocalStorageBackend(
  options: LocalStorageBackendOptions
  // eslint-disable-next-line no-use-before-define -- class is declared immediately below
): LocalStorageBackend {
  const storage = options.storage ?? browserLocalStorage();
  if (!storage) {
    throw canaError(
      'Unavailable',
      'No usable localStorage fallback in this environment. IndexedDB was unavailable and the '
        + 'fallback store cannot be opened either.'
    );
  }
  // Match CanaClient.effectiveSchema(): when the ledger is on, its store must
  // exist in the schema or every readwrite transaction fails with Unknown store.
  const schema: CanaSchema = options.operationLedger
    ? {
      ...options.schema,
      stores: withLedgerStore(options.schema.stores) as CanaSchema['stores']
    }
    : options.schema;
  const normalized = { ...options, schema };
  const snapshot = loadSnapshot(storage, normalized.name, normalized.schema);
  // eslint-disable-next-line no-use-before-define -- class is declared immediately below
  return new LocalStorageBackend(normalized, storage, snapshot);
}

export class LocalStorageBackend {
  private snapshot: LsSnapshot;

  private queue: Promise<unknown> = Promise.resolve();

  private closed = false;

  constructor(
    private readonly options: LocalStorageBackendOptions,
    private readonly storage: LocalStorageLike,
    snapshot: LsSnapshot
  ) {
    this.snapshot = snapshot;
  }

  close(): void {
    this.closed = true;
  }

  deletePersisted(): void {
    this.storage.removeItem(storageKey(this.options.name));
  }

  private requireOpen(): void {
    if (this.closed) {
      throw canaError(
        'InvalidRequest',
        `localStorage client for "${this.options.name}" is closed.`
      );
    }
  }

  resolveWrite(
    correlationId: string,
    attemptedAt: number,
    options: { horizonMs?: number; now?: number } = {}
  ): Promise<'committed' | 'rolled-back' | 'unresolvable'> {
    this.requireOpen();
    if (!this.options.operationLedger) return Promise.resolve('unresolvable');
    const horizon = options.horizonMs ?? 24 * 60 * 60 * 1000;
    const now = options.now ?? Date.now();
    if (now - attemptedAt > horizon) return Promise.resolve('unresolvable');
    const bag = this.snapshot.stores[OPERATION_LEDGER_STORE] ?? {};
    const found = bag[serializeKey(correlationId)];
    return Promise.resolve(found ? 'committed' : 'rolled-back');
  }

  async transaction<TResult>(
    mode: CanaTransactionMode,
    stores: readonly string[],
    body: (scope: CanaTransactionScope) => Promise<TResult> | TResult,
    correlationId: string
  ): Promise<CanaTransactionResult<TResult>> {
    this.requireOpen();
    const attemptedAt = Date.now();
    const buffer = createChangeBuffer(this.options.nextCursor, this.options.originId);

    // Serialize transactions: localStorage has no isolation beyond atomic setItem.
    const run = async (): Promise<CanaTransactionResult<TResult>> => {
      const working: TxState = {
        snapshot: mode === 'readonly' ? this.snapshot : cloneSnapshot(this.snapshot)
      };

      const scopeStores = this.options.operationLedger && mode === 'readwrite'
        && !stores.includes(OPERATION_LEDGER_STORE)
        ? [...stores, OPERATION_LEDGER_STORE]
        : stores;

      for (const name of scopeStores) {
        storeSchema(this.options.schema, name);
      }

      try {
        if (this.options.operationLedger && mode === 'readwrite') {
          working.snapshot.stores[OPERATION_LEDGER_STORE] ??= {};
          working.snapshot.stores[OPERATION_LEDGER_STORE]![serializeKey(correlationId)] = {
            id: correlationId,
            at: attemptedAt,
            stores: [...stores]
          };
        }

        const result = await body({
          table: <TRecord, TKey extends CanaKey = CanaKey>(name: string) => (
            this.createTable<TRecord, TKey>(name, working, buffer, correlationId, mode)
          ),
          abort: (reason?: string) => {
            throw canaError(
              'TransactionAborted',
              reason ?? 'Transaction aborted.'
            );
          }
        });

        if (mode === 'readwrite') {
          persist(this.storage, this.options.name, working.snapshot);
          this.snapshot = working.snapshot;
        }

        const events = buffer.drain();
        return {
          outcome: 'committed',
          result,
          events,
          correlationId,
          attemptedAt
        };
      } catch (error) {
        buffer.discard();
        if ((error as { code?: string }).code === 'TransactionAborted') {
          return {
            outcome: 'rolled-back',
            events: [],
            correlationId,
            attemptedAt
          };
        }
        throw error;
      }
    };

    // Chain onto the queue without losing the previous rejection.
    let release!: (value: unknown) => void;
    const gate = new Promise((resolve) => { release = resolve; });
    const previous = this.queue;
    this.queue = previous.then(() => gate);
    await previous.catch(() => undefined);
    try {
      return await run();
    } finally {
      release(undefined);
    }
  }

  private createTable<TRecord, TKey extends CanaKey = CanaKey>(
    name: string,
    working: TxState,
    buffer: ChangeBuffer,
    correlationId: string,
    mode: CanaTransactionMode
  ): CanaTable<TRecord, TKey> {
    // Nested table methods need the outer instance; `this` inside the returned
    // object literal would be the table, not the backend.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const backend = this;
    const schema = storeSchema(this.options.schema, name);

    const bag = (): Record<string, unknown> => {
      // eslint-disable-next-line no-param-reassign -- TxState is the mutable scratch snapshot
      working.snapshot.stores[name] ??= {};
      return working.snapshot.stores[name]!;
    };

    const assertWritable = (): void => {
      if (mode === 'readonly') {
        throw canaError(
          'InvalidRequest',
          `Cannot write to "${name}" inside a readonly localStorage transaction.`,
          { store: name }
        );
      }
    };

    const record = (type: CanaChangeType, key: CanaKey | undefined, value?: unknown): void => {
      buffer.record({
        type,
        store: name,
        correlationId,
        ...(key === undefined ? {} : { key }),
        ...(value === undefined ? {} : { record: value })
      } as Parameters<ChangeBuffer['record']>[0]);
    };

    const throughHooks = (
      type: CanaChangeType,
      key: CanaKey | undefined,
      value: unknown
    ): unknown => applyBeforeWrite(
      this.options.hooks,
      {
        store: name,
        type,
        correlationId,
        // Writes always carry a record; deletes go through `record()` only.
        record: value,
        ...(key === undefined ? {} : { key })
      },
      value
    );

    const resolveInboundKey = (value: TRecord, explicit?: TKey): CanaKey => {
      if (schema.keyPath !== undefined) {
        const existing = readPath(value, schema.keyPath);
        if (existing !== undefined) return existing as CanaKey;
        if (schema.autoIncrement) {
          // Sequences are initialised for every schema store at open time.
          const generated = working.snapshot.sequences[name]! + 1;
          // eslint-disable-next-line no-param-reassign -- TxState is the mutable scratch snapshot
          working.snapshot.sequences[name] = generated;
          if (typeof schema.keyPath === 'string') {
            writePath(value as Record<string, unknown>, schema.keyPath, generated);
          }
          return generated;
        }
        throw canaError(
          'InvalidRequest',
          `add/put on "${name}" needs a key at keyPath ${String(schema.keyPath)}.`,
          { store: name }
        );
      }
      if (explicit !== undefined) return explicit;
      if (schema.autoIncrement) {
        const generated = working.snapshot.sequences[name]! + 1;
        // eslint-disable-next-line no-param-reassign -- TxState is the mutable scratch snapshot
        working.snapshot.sequences[name] = generated;
        return generated;
      }
      throw canaError(
        'InvalidRequest',
        `add/put on "${name}" needs an explicit key: the store uses outbound keys.`,
        { store: name }
      );
    };

    return {
      name,

      async get(key: TKey): Promise<TRecord | undefined> {
        return bag()[serializeKey(key)] as TRecord | undefined;
      },

      async add(value: TRecord, key?: TKey): Promise<CanaWriteResult> {
        assertWritable();
        if (schema.keyPath !== undefined && key !== undefined) {
          throw canaError(
            'InvalidRequest',
            `add on "${name}" was given an explicit key, but the store has an inbound keyPath.`,
            { store: name, key }
          );
        }
        const writing = throughHooks('created', key, value) as TRecord;
        const resolved = resolveInboundKey(writing, key);
        const encoded = serializeKey(resolved);
        if (bag()[encoded] !== undefined) {
          throw canaError(
            'ConstraintViolation',
            `Key ${String(resolved)} already exists in "${name}".`,
            { store: name, key: resolved }
          );
        }
        bag()[encoded] = writing;
        record('created', resolved, writing);
        return { outcome: 'committed', key: resolved, events: [] };
      },

      async put(value: TRecord, key?: TKey): Promise<CanaWriteResult> {
        assertWritable();
        if (schema.keyPath !== undefined && key !== undefined) {
          throw canaError(
            'InvalidRequest',
            `put on "${name}" was given an explicit key, but the store has an inbound keyPath.`,
            { store: name, key }
          );
        }
        const resolvedProbe = schema.keyPath !== undefined
          ? (readPath(value, schema.keyPath) as CanaKey | undefined)
          : key;
        const existed = resolvedProbe !== undefined
          && bag()[serializeKey(resolvedProbe)] !== undefined;
        const writing = throughHooks(existed ? 'updated' : 'created', key, value) as TRecord;
        const resolved = resolveInboundKey(writing, key);
        bag()[serializeKey(resolved)] = writing;
        record(existed ? 'updated' : 'created', resolved, writing);
        return { outcome: 'committed', key: resolved, events: [] };
      },

      async update(key: TKey, changes: Partial<TRecord>): Promise<CanaWriteResult> {
        assertWritable();
        const current = bag()[serializeKey(key)] as TRecord | undefined;
        if (current === undefined) {
          throw canaError(
            'NotFound',
            `Cannot update "${String(key)}" in "${name}": no such record.`,
            { store: name, key }
          );
        }
        const merged = throughHooks('updated', key, { ...current, ...changes }) as TRecord;
        bag()[serializeKey(key)] = merged;
        record('updated', key, merged);
        return { outcome: 'committed', key, events: [] };
      },

      async delete(key: TKey): Promise<CanaWriteResult> {
        assertWritable();
        const encoded = serializeKey(key);
        const present = bag()[encoded] !== undefined;
        delete bag()[encoded];
        if (present) record('deleted', key);
        return { outcome: 'committed', key, events: [] };
      },

      async clear(): Promise<CanaWriteResult> {
        assertWritable();
        // eslint-disable-next-line no-param-reassign -- TxState is the mutable scratch snapshot
        working.snapshot.stores[name] = {};
        record('cleared', undefined);
        return { outcome: 'committed', events: [] };
      },

      async bulkAdd(records: readonly TRecord[]): Promise<CanaBulkWriteResult> {
        const keys: CanaKey[] = [];
        const table = backend.createTable<TRecord, TKey>(
          name,
          working,
          buffer,
          correlationId,
          mode
        );
        for (const item of records) {
          // eslint-disable-next-line no-await-in-loop
          const written = await table.add(item);
          keys.push(written.key as CanaKey);
        }
        return { outcome: 'committed', keys, events: [] };
      },

      async bulkPut(records: readonly TRecord[]): Promise<CanaBulkWriteResult> {
        const keys: CanaKey[] = [];
        const table = backend.createTable<TRecord, TKey>(
          name,
          working,
          buffer,
          correlationId,
          mode
        );
        for (const item of records) {
          // eslint-disable-next-line no-await-in-loop
          const written = await table.put(item);
          keys.push(written.key as CanaKey);
        }
        return { outcome: 'committed', keys, events: [] };
      },

      async bulkDelete(keys: readonly TKey[]): Promise<CanaBulkWriteResult> {
        const written: CanaKey[] = [];
        const table = backend.createTable<TRecord, TKey>(
          name,
          working,
          buffer,
          correlationId,
          mode
        );
        for (const key of keys) {
          // eslint-disable-next-line no-await-in-loop
          await table.delete(key);
          written.push(key);
        }
        return { outcome: 'committed', keys: written, events: [] };
      },

      async count(query?: CanaQuery): Promise<number> {
        return runLocalQuery<TRecord>(schema, bag(), query).length;
      },

      async query(query?: CanaQuery): Promise<readonly TRecord[]> {
        return runLocalQuery<TRecord>(schema, bag(), query);
      },

      async explain(
        query?: CanaQuery
      ): Promise<{
        records: readonly TRecord[];
        plan: CanaQueryPlan;
        metrics: CanaQueryMetrics;
      }> {
        // localStorage has no real indexes — report the same plan shape, but
        // fullScan is always true for the fallback store.
        const plan = { ...planQuery(name, query), fullScan: true };
        const records = runLocalQuery<TRecord>(schema, bag(), query);
        // The fallback reads the whole bag and filters it in memory. Reporting
        // the returned length would claim a laziness this backend does not
        // have, so it reports what it actually touched (JUM-682).
        const examined = Object.keys(bag()).length;
        return { records, plan, metrics: { recordsExamined: examined, cursorAdvanced: false } };
      }
    };
  }

  async exportAll(): Promise<Record<string, readonly unknown[]>> {
    this.requireOpen();
    const dump: Record<string, readonly unknown[]> = {};
    for (const store of this.options.schema.stores) {
      dump[store.name] = Object.values(this.snapshot.stores[store.name] ?? {});
    }
    return dump;
  }
}
