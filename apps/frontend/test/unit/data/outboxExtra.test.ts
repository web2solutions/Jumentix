import {
  afterEach, beforeEach, describe, expect, it
} from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';

import { resetSharedApiClient } from '@/contracts/apiClient';
import {
  getCanaClient, closeCana, openCana, wipeCanaDatabase
} from '@/data/db';
import { getLocal } from '@/data/localRepository';
import {
  drainOutbox, enqueueMutation, listOutbox, type OutboxIntent
} from '@/data/outbox';
import { useAuthStore } from '@/stores/auth';
import { useNotificationStore } from '@/stores/notifications';

const DB = 'jumentix-frontend-test-outbox-extra';

const userOps = {
  create: 'create', update: 'update', delete: 'deleteOne'
};

const jsonResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
  json: async () => body,
  text: async () => JSON.stringify(body)
});

const seedSyncedUser = async (id: string, firstName: string): Promise<void> => {
  await getCanaClient().table('users').put({
    id, firstName, username: `${id}@x.dev`, updatedAt: '2026-01-01T00:00:00.000Z', _sync: 'synced'
  });
};

/**
 * Outbox intents beyond the happy path (JUM-806/807): intent merging,
 * beforeImage compensation, update/delete replay, retries and id fallbacks.
 */
describe('outbox intents beyond the happy path (JUM-806/807)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    setActivePinia(createPinia());
    resetSharedApiClient();
    await openCana(DB);
    await wipeCanaDatabase();
    const auth = useAuthStore();
    auth.token = 'Bearer test';
    auth.username = 'eduardo@xpertminds.dev';
    auth.userId = 'user-1';
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await closeCana();
  });

  it('merges an update into the pending create of the same key', async () => {
    expect.hasAssertions();
    await enqueueMutation({
      entity: 'User',
      kind: 'create',
      key: 'u-merge',
      payload: { firstName: 'Ana', username: 'ana@x.dev', password: 'secret-1' },
      operations: userOps
    });
    await enqueueMutation({
      entity: 'User',
      kind: 'update',
      key: 'u-merge',
      payload: { firstName: 'Ana Maria' },
      operations: userOps
    });
    const intents = await listOutbox();
    expect(intents).toHaveLength(1);
    expect(intents[0].kind).toBe('create');
    expect(intents[0].payload.firstName).toBe('Ana Maria');
    expect(intents[0].payload.username).toBe('ana@x.dev');
  });

  it('marks deletes as pending with a tombstone and confirms them on 2xx', async () => {
    expect.hasAssertions();
    await seedSyncedUser('u-del', 'Della');
    const record = await enqueueMutation({
      entity: 'User',
      kind: 'delete',
      key: 'u-del',
      payload: { id: 'u-del' },
      operations: userOps
    });
    expect(record._sync).toBe('pending');
    expect(typeof record.deletedAt).toBe('string');

    globalThis.fetch = (async () => jsonResponse(204, {})) as unknown as typeof fetch;
    await drainOutbox();

    expect(await getLocal('User', 'u-del')).toBeUndefined();
    expect(await listOutbox()).toHaveLength(0);
  });

  it('replays updates with PUT and stores the server record as synced', async () => {
    expect.hasAssertions();
    await seedSyncedUser('u-upd', 'Old');
    await enqueueMutation({
      entity: 'User',
      kind: 'update',
      key: 'u-upd',
      payload: { firstName: 'New' },
      operations: userOps
    });
    globalThis.fetch = (async () => jsonResponse(200, {
      id: 'u-upd', firstName: 'New', username: 'u-upd@x.dev'
    })) as unknown as typeof fetch;

    await drainOutbox();

    const confirmed = await getLocal('User', 'u-upd');
    expect(confirmed?.firstName).toBe('New');
    expect(confirmed?._sync).toBe('synced');
    expect(await listOutbox()).toHaveLength(0);
  });

  it('restores the beforeImage when a 4xx rejects an update', async () => {
    expect.hasAssertions();
    await seedSyncedUser('u-conflict', 'Before');
    await enqueueMutation({
      entity: 'User',
      kind: 'update',
      key: 'u-conflict',
      payload: { firstName: 'After' },
      operations: userOps
    });
    globalThis.fetch = (async () => jsonResponse(400, { message: 'invalid payload' })) as unknown as typeof fetch;

    await drainOutbox();

    const restored = await getLocal('User', 'u-conflict');
    expect(restored?.firstName).toBe('Before');
    expect(restored?._sync).toBe('synced');
    expect(await listOutbox()).toHaveLength(0);
    expect(useNotificationStore().items.some((item) => item.kind === 'reject')).toBe(true);
  });

  it('keeps the intent and increments attempts on a 5xx failure', async () => {
    expect.hasAssertions();
    await enqueueMutation({
      entity: 'User',
      kind: 'create',
      key: 'u-retry',
      payload: { firstName: 'Retry', username: 'retry@x.dev', password: 'secret-1' },
      operations: userOps
    });
    globalThis.fetch = (async () => jsonResponse(500, { message: 'boom' })) as unknown as typeof fetch;

    await drainOutbox();

    const intents = await listOutbox();
    expect(intents).toHaveLength(1);
    expect(intents[0].attempts).toBe(1);
    expect((await getLocal('User', 'u-retry'))?._sync).toBe('pending');
  });

  it('stops draining on 401 so the session guard can take over', async () => {
    expect.hasAssertions();
    await enqueueMutation({
      entity: 'User',
      kind: 'create',
      key: 'u-401',
      payload: { firstName: 'Auth', username: 'auth@x.dev', password: 'secret-1' },
      operations: userOps
    });
    globalThis.fetch = (async () => jsonResponse(401, { message: 'expired' })) as unknown as typeof fetch;

    await drainOutbox();

    const intents = await listOutbox();
    expect(intents).toHaveLength(1);
    expect(intents[0].attempts).toBe(0);
  });

  it('coalesces a concurrent drain call into the in-flight pass', async () => {
    expect.hasAssertions();
    await enqueueMutation({
      entity: 'User',
      kind: 'create',
      key: 'u-conc',
      payload: { firstName: 'Conc', username: 'conc@x.dev', password: 'secret-1' },
      operations: userOps
    });
    globalThis.fetch = (async () => jsonResponse(201, {
      id: 'u-conc', firstName: 'Conc', username: 'conc@x.dev'
    })) as unknown as typeof fetch;

    const first = drainOutbox();
    const second = drainOutbox();
    await Promise.all([first, second]);

    expect(await listOutbox()).toHaveLength(0);
  });

  it('falls back to timestamped ids when crypto.randomUUID is unavailable', async () => {
    expect.hasAssertions();
    const originalRandomUUID = crypto.randomUUID;
    Object.defineProperty(globalThis.crypto, 'randomUUID', { value: undefined, configurable: true });
    try {
      const record = await enqueueMutation({
        entity: 'User',
        kind: 'create',
        payload: { firstName: 'Legacy', username: 'legacy@x.dev', password: 'secret-1' },
        operations: userOps
      });
      expect(String(record.id)).toMatch(/^id-/);
      const intents = await listOutbox();
      expect(intents[0].opId).toMatch(/^op-/);
    } finally {
      Object.defineProperty(globalThis.crypto, 'randomUUID', { value: originalRandomUUID, configurable: true });
    }
  });

  it('retries a failed create until the server accepts it', async () => {
    expect.hasAssertions();
    await enqueueMutation({
      entity: 'User',
      kind: 'create',
      key: 'u-dep',
      payload: { firstName: 'Dep', username: 'dep@x.dev', password: 'secret-1' },
      operations: userOps
    });
    globalThis.fetch = (async () => jsonResponse(500, { message: 'boom' })) as unknown as typeof fetch;
    await drainOutbox();

    const pending: OutboxIntent[] = await listOutbox();
    expect(pending).toHaveLength(1);
    expect(pending[0].attempts).toBe(1);

    globalThis.fetch = (async () => jsonResponse(201, {
      id: 'u-dep', firstName: 'Dep', username: 'dep@x.dev'
    })) as unknown as typeof fetch;
    await drainOutbox();
    expect(await listOutbox()).toHaveLength(0);
    expect((await getLocal('User', 'u-dep'))?._sync).toBe('synced');
  });
});
