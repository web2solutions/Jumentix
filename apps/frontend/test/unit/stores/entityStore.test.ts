import {
  afterEach, beforeEach, describe, expect, it
} from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';

import { resetSharedApiClient } from '@/contracts/apiClient';
import {
  closeCana, getCanaClient, openCana, wipeCanaDatabase
} from '@/data/db';
import { getLocal } from '@/data/localRepository';
import { listOutbox } from '@/data/outbox';
import { usersCrudConfig } from '@/features/users/usersCrudConfig';
import { useAuthStore } from '@/stores/auth';
import { createEntityStore } from '@/stores/entityStore';

const DB = 'jumentix-frontend-test-entity-store';

const jsonResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
  json: async () => body,
  text: async () => JSON.stringify(body)
});

const pollUntil = async (
  condition: () => Promise<boolean> | boolean,
  attempts = 200
): Promise<void> => {
  for (let index = 0; index < attempts; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    if (await condition()) return;
    // eslint-disable-next-line no-await-in-loop
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  }
  throw new Error('pollUntil: condition not met');
};

/** Generic entity store (JUM-804): Cana + outbox paths when the local client is open. */
describe('entity store with Cana open (JUM-804)', () => {
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
    globalThis.fetch = (async () => jsonResponse(503, { message: 'offline' })) as unknown as typeof fetch;
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await closeCana();
  });

  it('lists from the local repository instead of the server', async () => {
    expect.hasAssertions();
    const users = getCanaClient().table('users');
    await users.put({
      id: 'u1', firstName: 'Ana', username: 'ana', updatedAt: '2026-01-01T00:00:00.000Z'
    });
    await users.put({
      id: 'u2', firstName: 'Bia', username: 'bia', updatedAt: '2026-01-02T00:00:00.000Z'
    });
    const store = createEntityStore(usersCrudConfig)();
    const page = await store.list({ page: 1, size: 30 });
    expect(page.total).toBe(2);
    expect(page.result.map((row) => row.id).sort()).toStrictEqual(['u1', 'u2']);
  });

  it('creates through the outbox and confirms once the server answers', async () => {
    expect.hasAssertions();
    globalThis.fetch = (async (_url: string, init?: RequestInit) => jsonResponse(201, {
      ...JSON.parse(String(init?.body ?? '{}')),
      id: JSON.parse(String(init?.body ?? '{}')).id,
      firstName: 'Ana',
      lastName: '',
      username: 'ana@x.dev',
      roles: ['user'],
      emails: [],
      documents: [],
      phones: [],
      updatedAt: '2026-01-01T00:00:00.000Z'
    })) as unknown as typeof fetch;
    const store = createEntityStore(usersCrudConfig)();
    const record = await store.create({ firstName: 'Ana', username: 'ana@x.dev', password: 'secret-1' });
    expect((record as Record<string, unknown>)._sync).toBe('pending');
    await pollUntil(async () => (await listOutbox()).length === 0);
    expect(await listOutbox()).toHaveLength(0);
    expect((await getLocal('User', String(record.id)))?._sync).toBe('synced');
  });

  it('updates through the outbox with a pending flag until replayed', async () => {
    expect.hasAssertions();
    await getCanaClient().table('users').put({
      id: 'u1', firstName: 'Old', username: 'old@x.dev', _sync: 'synced'
    });
    const store = createEntityStore(usersCrudConfig)();
    const record = await store.update('u1', { firstName: 'New' });
    expect((record as Record<string, unknown>)._sync).toBe('pending');
    const intents = await listOutbox();
    expect(intents).toHaveLength(1);
    expect(intents[0].kind).toBe('update');
    expect(intents[0].beforeImage?.firstName).toBe('Old');
  });

  it('removes through the outbox with a pending tombstone', async () => {
    expect.hasAssertions();
    await getCanaClient().table('users').put({
      id: 'u1', firstName: 'Old', username: 'old@x.dev', _sync: 'synced'
    });
    const store = createEntityStore(usersCrudConfig)();
    await store.remove('u1');
    const local = await getLocal('User', 'u1');
    expect(local?._sync).toBe('pending');
    expect(typeof local?.deletedAt).toBe('string');
    const intents = await listOutbox();
    expect(intents).toHaveLength(1);
    expect(intents[0].kind).toBe('delete');
  });

  it('searches locally with the contract search fields', async () => {
    expect.hasAssertions();
    const users = getCanaClient().table('users');
    await users.put({
      id: 'u1', firstName: 'Ana', username: 'ana', updatedAt: '2026-01-01T00:00:00.000Z'
    });
    await users.put({
      id: 'u2', firstName: 'Bia', username: 'bia', updatedAt: '2026-01-02T00:00:00.000Z'
    });
    const store = createEntityStore(usersCrudConfig)();
    const page = await store.list({ q: 'ana', page: 1, size: 30 });
    expect(page.total).toBe(1);
    expect(page.result[0].id).toBe('u1');
  });

  it('fails closed on the server path when there is no session', async () => {
    expect.hasAssertions();
    await closeCana();
    useAuthStore().token = '';
    const store = createEntityStore(usersCrudConfig)();
    await expect(store.list()).rejects.toThrow('No authenticated session.');
    await expect(store.create({ firstName: 'X' })).rejects.toThrow('No authenticated session.');
  });
});
