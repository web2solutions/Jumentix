import {
  afterEach, beforeEach, describe, expect, it
} from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';

import { buildCanaSchema, deriveEntityTables, entityTable } from '@/data/canaSchema';
import {
  closeCana, getCanaClient, openCana, wipeCanaDatabase
} from '@/data/db';
import { getLocal, listLocal, resolveRelations } from '@/data/localRepository';
import { drainOutbox, enqueueMutation, listOutbox } from '@/data/outbox';
import { fullLoad, isSynced, runSessionSync } from '@/data/sync';
import { resetSharedApiClient } from '@/contracts/apiClient';
import { useAuthStore } from '@/stores/auth';

const DB = 'jumentix-frontend-test-data';

const userOps = {
  create: 'create', update: 'update', delete: 'deleteOne'
};

describe('Cana schema from OAS (JUM-802)', () => {
  it('derives users and organizations stores with keyPath id and relation indexes', () => {
    expect.hasAssertions();
    const tables = deriveEntityTables();
    const users = tables.find((table) => table.storeName === 'users');
    const orgs = tables.find((table) => table.storeName === 'organizations');
    expect(users?.keyPath).toBe('id');
    expect(orgs?.keyPath).toBe('id');
    expect(users?.indexes).toContain('organization');
    expect(users?.indexes).toContain('updatedAt');
    expect(users?.indexes).toContain('deletedAt');
    expect(users?.indexes).not.toContain('roles');
    expect(orgs?.indexes).not.toContain('members');
    const schema = buildCanaSchema();
    expect(schema.version).toBeGreaterThan(0);
    expect(schema.stores.map((store) => store.name)).toEqual(
      expect.arrayContaining(['users', 'organizations', 'meta', 'outbox'])
    );
  });
});

describe('local repository (JUM-803)', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    await openCana(DB);
    await wipeCanaDatabase();
  });

  afterEach(async () => {
    await closeCana();
  });

  it('lists with runListQuery parity and uses the firstName index when sorting', async () => {
    expect.hasAssertions();
    const table = entityTable('User');
    const store = getCanaClient().table(table.storeName);
    await store.put({
      id: '1',
      firstName: 'Ana Lima',
      lastName: 'L',
      username: 'ana',
      updatedAt: '2026-01-05T10:00:00.000Z',
      organization: 'org-1'
    });
    await store.put({
      id: '2',
      firstName: 'bruno costa',
      lastName: 'B',
      username: 'bruno',
      updatedAt: '2026-03-01T10:00:00.000Z',
      organization: 'org-2'
    });
    await store.put({
      id: '3',
      firstName: 'Carla Souza',
      lastName: 'C',
      username: 'carla',
      updatedAt: '2025-12-31T23:59:59.000Z',
      organization: 'org-1'
    });
    const searched = await listLocal('User', {
      q: 'LIMA', searchFields: ['firstName'], page: 1, size: 30
    });
    expect(searched.result.map((row) => row.id)).toStrictEqual(['1']);
    const sorted = await listLocal('User', { sort: 'firstName:asc', page: 1, size: 30 });
    expect(sorted.usedIndex).toBe('firstName');
    expect(sorted.result[0].firstName).toBe('Ana Lima');
    const filtered = await listLocal('User', {
      filter: { organization: 'org-1' }, page: 1, size: 30
    });
    expect(filtered.result.map((row) => row.id).sort()).toStrictEqual(['1', '3']);
  });

  it('resolves belongsTo organization labels', async () => {
    expect.hasAssertions();
    const client = getCanaClient();
    await client.table('organizations').put({ id: 'org-1', name: 'ACME' });
    await client.table('users').put({
      id: 'u1', firstName: 'Pat', username: 'pat', organization: 'org-1'
    });
    const joined = await resolveRelations('User', {
      id: 'u1', firstName: 'Pat', organization: 'org-1'
    });
    expect(joined.organizationLabel).toBe('ACME');
    const found = await getLocal('User', 'u1');
    expect(found?.username).toBe('pat');
  });
});

describe('outbox (JUM-806/807)', () => {
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
    await drainOutbox().catch(() => undefined);
    await closeCana();
  });

  it('writes locally as pending and confirms on 2xx', async () => {
    expect.hasAssertions();
    globalThis.fetch = (async (_url: string, init?: RequestInit) => ({
      ok: true,
      status: 201,
      headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
      json: async () => ({ id: JSON.parse(String(init?.body ?? '{}')).id, firstName: 'E2E', username: 'e2e@x.dev' }),
      text: async () => ''
    })) as unknown as typeof fetch;
    const record = await enqueueMutation({
      entity: 'User',
      kind: 'create',
      payload: { firstName: 'E2E', username: 'e2e@x.dev', password: 'secret-s' },
      operations: userOps
    });
    expect(record._sync).toBe('pending');
    await drainOutbox();
    const confirmed = await getLocal('User', String(record.id));
    expect(confirmed?._sync).toBe('synced');
    expect(await listOutbox()).toHaveLength(0);
  });

  it('rolls back a 4xx create and records a notification', async () => {
    expect.hasAssertions();
    globalThis.fetch = (async () => ({
      ok: false,
      status: 400,
      headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
      json: async () => ({ message: 'duplicate username' }),
      text: async () => JSON.stringify({ message: 'duplicate username' })
    })) as unknown as typeof fetch;
    const record = await enqueueMutation({
      entity: 'User',
      kind: 'create',
      payload: { firstName: 'Dup', username: 'dup@x.dev', password: 'secret-s' },
      operations: userOps
    });
    await drainOutbox();
    expect(await getLocal('User', String(record.id))).toBeUndefined();
    const { useNotificationStore } = await import('@/stores/notifications');
    expect(useNotificationStore().items.length).toBeGreaterThan(0);
  });
});

describe('sync (JUM-805)', () => {
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
    const empty = {
      result: [], total: 0, page: 1, size: 100
    };
    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
      json: async () => empty,
      text: async () => JSON.stringify(empty)
    })) as unknown as typeof fetch;
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await closeCana();
  });

  it('fullLoad pages every OAS entity and runSessionSync records lastSyncAt', async () => {
    expect.hasAssertions();
    await fullLoad();
    await runSessionSync();
    expect(await isSynced()).toBe(true);
  });
});
