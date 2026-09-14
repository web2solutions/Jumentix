/* Sequential IndexedDB + REST: one outbox intent at a time. */
/* eslint-disable no-await-in-loop, no-continue */
import { apiErrorStatus } from '@/contracts/errors';
import { getSharedApiClient } from '@/contracts/apiClient';
import { useAuthStore } from '@/stores/auth';
import { useNotificationStore } from '@/stores/notifications';
import { OUTBOX_STORE, entityTable } from '@/data/canaSchema';
import { getCanaClient, isCanaOpen } from '@/data/db';

export type OutboxKind = 'create' | 'update' | 'delete';
export type SyncFlag = 'pending' | 'synced';

export interface OutboxIntent {
  opId: string;
  entity: string;
  kind: OutboxKind;
  key: string;
  payload: Record<string, unknown>;
  beforeImage?: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  dependsOn?: string;
  operations: { create: string; update: string; delete: string };
}

const SYNC_FIELD = '_sync';

const stripLocal = (record: Record<string, unknown>): Record<string, unknown> => {
  const next = { ...record };
  delete next[SYNC_FIELD];
  for (const key of Object.keys(next)) {
    if (key.endsWith('Record') || key.endsWith('Label')) delete next[key];
  }
  return next;
};

const newOpId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  }
  return `op-${Date.now()}-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
};

export const listOutbox = async (): Promise<OutboxIntent[]> => {
  if (!isCanaOpen()) return [];
  const rows = await getCanaClient().table(OUTBOX_STORE).query({
    index: 'createdAt',
    direction: 'next'
  });
  return [...rows] as OutboxIntent[];
};

const pendingForKey = async (entity: string, key: string): Promise<OutboxIntent | undefined> => {
  const all = await listOutbox();
  return all.find((intent) => intent.entity === entity && intent.key === key);
};

export const enqueueMutation = async (input: {
  entity: string;
  kind: OutboxKind;
  key?: string;
  payload: Record<string, unknown>;
  operations: OutboxIntent['operations'];
}): Promise<Record<string, unknown>> => {
  const table = entityTable(input.entity);
  const { keyPath } = table;
  const payload = stripLocal(
    JSON.parse(JSON.stringify(input.payload)) as Record<string, unknown>
  );
  const key = input.key
    ?? String(payload[keyPath] ?? (payload.id = (
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `id-${Date.now()}`
    )));
  payload[keyPath] = key;
  const client = getCanaClient();
  const existing = await pendingForKey(input.entity, key);
  const beforeImage = input.kind === 'create'
    ? undefined
    : (await client.table(table.storeName).get(key) as Record<string, unknown> | undefined);

  const intent: OutboxIntent = existing && existing.kind !== 'delete'
    ? {
      ...existing,
      kind: existing.kind === 'create' ? 'create' : input.kind,
      payload: existing.kind === 'create' ? { ...existing.payload, ...payload } : payload,
      createdAt: existing.createdAt
    }
    : {
      opId: newOpId(),
      entity: input.entity,
      kind: input.kind,
      key,
      payload,
      beforeImage: beforeImage ? stripLocal(beforeImage) : undefined,
      createdAt: new Date().toISOString(),
      attempts: 0,
      dependsOn: existing?.kind === 'create' ? existing.opId : undefined,
      operations: input.operations
    };

  const localRecord = input.kind === 'delete'
    ? {
      ...JSON.parse(JSON.stringify(beforeImage ?? {})),
      [keyPath]: key,
      deletedAt: new Date().toISOString(),
      [SYNC_FIELD]: 'pending' as SyncFlag
    }
    : { ...payload, [SYNC_FIELD]: 'pending' as SyncFlag };

  const result = await client.transaction('readwrite', [table.storeName, OUTBOX_STORE], async (scope) => {
    const store = scope.table(table.storeName);
    const outbox = scope.table(OUTBOX_STORE);
    if (input.kind === 'delete') {
      await store.put(localRecord);
    } else {
      await store.put(localRecord);
    }
    await outbox.put(intent);
    return localRecord;
  });
  if (result.outcome !== 'committed' || !result.result) {
    throw new Error('Local write did not commit.');
  }
  return result.result as Record<string, unknown>;
};

const isOnline = (): boolean => (
  typeof navigator === 'undefined' || navigator.onLine !== false
);

const headers = (): { Authorization: string } => {
  const auth = useAuthStore();
  if (!auth.token) throw new Error('No authenticated session.');
  return { Authorization: auth.token };
};

const compensate = async (intent: OutboxIntent, dependents: OutboxIntent[]): Promise<void> => {
  const client = getCanaClient();
  const chain = [intent, ...dependents.filter((item) => item.dependsOn === intent.opId)];
  await client.transaction(
    'readwrite',
    [...new Set([...chain.map((item) => entityTable(item.entity).storeName), OUTBOX_STORE])],
    async (scope) => {
      for (const item of chain) {
        const store = scope.table(entityTable(item.entity).storeName);
        if (item.kind === 'create') {
          await store.delete(item.key);
        } else if (item.beforeImage) {
          await store.put({ ...item.beforeImage, [SYNC_FIELD]: 'synced' });
        }
        await scope.table(OUTBOX_STORE).delete(item.opId);
      }
    }
  );
};

let draining = false;
let drainAgain = false;

export const drainOutbox = async (): Promise<void> => {
  if (!isCanaOpen() || !isOnline()) return;
  if (draining) {
    drainAgain = true;
    return;
  }
  draining = true;
  try {
    do {
      drainAgain = false;
      const intents = await listOutbox();
      const pendingIds = new Set(intents.map((item) => item.opId));
      for (const intent of intents) {
        if (intent.dependsOn && pendingIds.has(intent.dependsOn)) continue;
        try {
          const api = getSharedApiClient();
          const auth = headers();
          let response: Record<string, unknown> | undefined;
          if (intent.kind === 'create') {
            response = await api.request<Record<string, unknown>>({
              operationId: intent.operations.create,
              body: stripLocal(intent.payload),
              headers: auth
            });
          } else if (intent.kind === 'update') {
            response = await api.request<Record<string, unknown>>({
              operationId: intent.operations.update,
              pathParams: { id: intent.key },
              body: { ...stripLocal(intent.payload), id: intent.key },
              headers: auth
            });
          } else {
            await api.request({
              operationId: intent.operations.delete,
              pathParams: { id: intent.key },
              headers: auth
            });
          }
          const table = entityTable(intent.entity);
          await getCanaClient().transaction(
            'readwrite',
            [table.storeName, OUTBOX_STORE],
            async (scope) => {
              if (intent.kind === 'delete') {
                await scope.table(table.storeName).delete(intent.key);
              } else {
                const confirmed = stripLocal(response ?? intent.payload);
                await scope.table(table.storeName).put({ ...confirmed, [SYNC_FIELD]: 'synced' });
              }
              await scope.table(OUTBOX_STORE).delete(intent.opId);
            }
          );
          pendingIds.delete(intent.opId);
        } catch (error) {
          const status = apiErrorStatus(error);
          if (status === 401) {
            return;
          }
          if (status !== undefined && status >= 400 && status < 500) {
            const rest = await listOutbox();
            await compensate(intent, rest);
            useNotificationStore().reject({
              entity: intent.entity,
              key: intent.key,
              kind: intent.kind,
              message: error instanceof Error ? error.message : String(error),
              reopen: intent.kind === 'delete' ? undefined : intent.payload
            });
            pendingIds.delete(intent.opId);
            continue;
          }
          intent.attempts += 1;
          await getCanaClient().table(OUTBOX_STORE).put(intent);
        }
      }
    } while (drainAgain);
  } finally {
    draining = false;
  }
};
