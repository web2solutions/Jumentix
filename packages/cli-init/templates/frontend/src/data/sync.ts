/* Sequential IndexedDB + REST: one page / one outbox intent at a time. */
/* eslint-disable no-await-in-loop, no-continue */
import { reactive } from 'vue';

import { getSharedApiClient } from '@/contracts/apiClient';
import { apiErrorStatus } from '@/contracts/errors';
import { asListPage, listCapabilities, toQueryParams } from '@/contracts/listSchema';
import { fieldDescriptors } from '@/contracts/formSchema';
import { useAuthStore } from '@/stores/auth';
import {
  META_STORE, SESSION_META_ID, deriveEntityTables, entityTable
} from '@/data/canaSchema';
import {
  bootCana, getCanaClient, isCanaOpen, wipeCanaDatabase
} from '@/data/db';
import { drainOutbox } from '@/data/outbox';

export interface SyncProgress {
  running: boolean;
  phase: 'idle' | 'full' | 'delta';
  entity: string;
  done: number;
  expected: number;
}

export const syncProgress = reactive<SyncProgress>({
  running: false,
  phase: 'idle',
  entity: '',
  done: 0,
  expected: 0
});

const LAST_SYNC_PREFIX = 'lastSync:';
const MAX_PAGES = 50;

/** One sync at a time — a leftover fullLoad plus a new login deadlocks IndexedDB. */
let syncGate: Promise<void> = Promise.resolve();

const withSyncGate = async <T>(work: () => Promise<T>): Promise<T> => {
  const previous = syncGate;
  let release: () => void = () => undefined;
  syncGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await work();
  } finally {
    release();
  }
};

const toStorable = (record: Record<string, unknown>): Record<string, unknown> => (
  JSON.parse(JSON.stringify(record, (_key, value) => (
    value instanceof Date ? value.toISOString() : value
  ))) as Record<string, unknown>
);

const authHeaders = (): { Authorization: string } => {
  const auth = useAuthStore();
  if (!auth.token) throw new Error('No authenticated session.');
  return { Authorization: auth.token };
};

const readMeta = async (id: string): Promise<Record<string, unknown> | undefined> => (
  getCanaClient().table(META_STORE).get(id) as Promise<Record<string, unknown> | undefined>
);

export const isSynced = async (): Promise<boolean> => {
  if (!isCanaOpen()) return false;
  const session = await readMeta(SESSION_META_ID);
  return Boolean(session?.lastSyncAt);
};

const putLastSync = async (storeName: string, iso: string): Promise<void> => {
  await getCanaClient().table(META_STORE).put({
    id: `${LAST_SYNC_PREFIX}${storeName}`,
    lastSync: iso
  });
};

const getLastSync = async (storeName: string): Promise<string | undefined> => {
  const row = await readMeta(`${LAST_SYNC_PREFIX}${storeName}`);
  return typeof row?.lastSync === 'string' ? row.lastSync : undefined;
};

const applyPage = async (
  schemaName: string,
  records: Record<string, unknown>[],
  includeDeleted: boolean
): Promise<string | undefined> => {
  const table = entityTable(schemaName);
  const store = getCanaClient().table(table.storeName);
  let newest: string | undefined;
  for (const record of records) {
    const updatedAt = typeof record.updatedAt === 'string' ? record.updatedAt : undefined;
    if (updatedAt && (!newest || updatedAt > newest)) newest = updatedAt;
    if (includeDeleted && record.deletedAt) {
      await store.delete(String(record[table.keyPath] ?? record.id));
    } else {
      await store.put({ ...toStorable(record), _sync: 'synced' });
    }
  }
  return newest;
};

const needsDetailRow = (schemaName: string, record: Record<string, unknown>): boolean => (
  fieldDescriptors(schemaName)
    .filter((descriptor) => descriptor.type === 'array')
    .some((descriptor) => !Array.isArray(record[descriptor.name]))
);

const hydrateDetails = async (schemaName: string): Promise<void> => {
  const table = entityTable(schemaName);
  if (!table.getOperationId) return;
  const api = getSharedApiClient();
  const headers = authHeaders();
  const store = getCanaClient().table(table.storeName);
  const rows = [...await store.query()] as Record<string, unknown>[];
  for (const row of rows) {
    if (row.deletedAt || !needsDetailRow(schemaName, row)) continue;
    const key = String(row[table.keyPath] ?? row.id ?? '');
    if (!key) continue;
    try {
      const detail = await api.request<Record<string, unknown>>({
        operationId: table.getOperationId,
        pathParams: { id: key },
        headers
      });
      await store.put({ ...toStorable(detail), _sync: 'synced' });
    } catch (error) {
      if (apiErrorStatus(error) === 403) continue;
      throw error;
    }
  }
};

const loadEntityPages = async (
  schemaName: string,
  options: { deltaFrom?: string; onPage: () => void }
): Promise<string | undefined> => {
  const table = entityTable(schemaName);
  const capabilities = listCapabilities(table.listOperationId);
  const size = capabilities?.maxSize ?? 100;
  const api = getSharedApiClient();
  const headers = authHeaders();
  let page = 1;
  let newest: string | undefined;
  let total = 1;
  while (page <= total && page <= MAX_PAGES) {
    const filter = options.deltaFrom
      ? { updatedAt: { operator: 'gt', value: options.deltaFrom } }
      : undefined;
    const response = await api.request<unknown>({
      operationId: table.listOperationId,
      query: toQueryParams({
        page,
        size,
        sort: 'updatedAt:asc,id:asc',
        filter,
        includeDeleted: Boolean(options.deltaFrom)
      }),
      headers
    });
    const envelope = asListPage<Record<string, unknown>>(response, { page, size });
    total = Math.max(1, Math.ceil(envelope.total / size));
    const cursor = await applyPage(schemaName, envelope.result, Boolean(options.deltaFrom));
    if (cursor && (!newest || cursor > newest)) newest = cursor;
    options.onPage();
    if (envelope.result.length === 0) break;
    page += 1;
  }
  await hydrateDetails(schemaName);
  return newest;
};

export const fullLoad = async (): Promise<void> => {
  const tables = deriveEntityTables();
  syncProgress.running = true;
  syncProgress.phase = 'full';
  syncProgress.done = 0;
  syncProgress.expected = tables.length;
  try {
    for (const table of tables) {
      syncProgress.entity = table.schemaName;
      try {
        const newest = await loadEntityPages(table.schemaName, {
          onPage: () => undefined
        });
        if (newest) await putLastSync(table.storeName, newest);
      } catch (error) {
        if (apiErrorStatus(error) === 403) {
          syncProgress.done += 1;
          continue;
        }
        throw error;
      }
      syncProgress.done += 1;
    }
  } finally {
    syncProgress.running = false;
    syncProgress.phase = 'idle';
    syncProgress.entity = '';
  }
};

export const deltaSync = async (): Promise<void> => {
  const tables = deriveEntityTables();
  syncProgress.running = true;
  syncProgress.phase = 'delta';
  syncProgress.done = 0;
  syncProgress.expected = tables.length;
  try {
    for (const table of tables) {
      syncProgress.entity = table.schemaName;
      try {
        const from = await getLastSync(table.storeName);
        const newest = await loadEntityPages(table.schemaName, {
          deltaFrom: from,
          onPage: () => undefined
        });
        if (newest) await putLastSync(table.storeName, newest);
      } catch (error) {
        if (apiErrorStatus(error) === 403) {
          syncProgress.done += 1;
          continue;
        }
        throw error;
      }
      syncProgress.done += 1;
    }
  } finally {
    syncProgress.running = false;
    syncProgress.phase = 'idle';
    syncProgress.entity = '';
  }
};

export const runSessionSync = async (): Promise<void> => withSyncGate(async () => {
  if (!isCanaOpen()) {
    await bootCana();
  }
  if (!isCanaOpen()) {
    throw new Error('IndexedDB is not available.');
  }
  const auth = useAuthStore();
  const session = await readMeta(SESSION_META_ID);
  const previousUser = typeof session?.username === 'string' ? session.username : '';
  if (previousUser && previousUser !== auth.username) {
    await wipeCanaDatabase();
    await fullLoad();
  } else if (!session?.lastSyncAt) {
    await fullLoad();
  } else {
    await deltaSync();
  }
  await getCanaClient().table(META_STORE).put({
    id: SESSION_META_ID,
    username: auth.username,
    userId: auth.userId,
    lastSyncAt: new Date().toISOString()
  });
  await drainOutbox();
});

/**
 * Bind a one-shot online → session-sync listener. Returns an unbind so unit
 * suites under coverage can remove the listener before restoring `fetch`
 * (otherwise a late `online` event hits the real network and Bun exits 1 on
 * ECONNREFUSED with zero failing assertions — JUM-889 release PR flake).
 */
export const bindOnlineReplay = (): (() => void) => {
  if (typeof window === 'undefined') return () => undefined;
  const onOnline = (): void => {
    runSessionSync().catch(() => undefined);
  };
  window.addEventListener('online', onOnline);
  return () => window.removeEventListener('online', onOnline);
};
