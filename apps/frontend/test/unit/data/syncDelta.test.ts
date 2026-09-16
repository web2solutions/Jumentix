import {
  afterEach, beforeEach, describe, expect, it
} from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';

import { resetSharedApiClient } from '@/contracts/apiClient';
import { META_STORE, SESSION_META_ID } from '@/data/canaSchema';
import {
  closeCana, getCanaClient, isCanaOpen, openCana, wipeCanaDatabase
} from '@/data/db';
import { getLocal } from '@/data/localRepository';
import {
  bindOnlineReplay, deltaSync, fullLoad, isSynced, runSessionSync
} from '@/data/sync';
import { useAuthStore } from '@/stores/auth';

const DB = 'jumentix-frontend-test-sync';

const emptyPage = {
  result: [], total: 0, page: 1, size: 100
};

const jsonResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
  json: async () => body,
  text: async () => JSON.stringify(body)
});

/** Bounded poll on a condition — never a fixed wait (Requirement 134 §2). */
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

/**
 * Delta sync and session orchestration (JUM-805): incremental pages, tombstone
 * deletes, per-user wipe and the online-event replay.
 */
describe('delta sync and session orchestration (JUM-805)', () => {
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

  it('deltaSync applies updates and deletes tombstoned rows', async () => {
    expect.hasAssertions();
    const users = getCanaClient().table('users');
    await users.put({
      id: 'user-old', firstName: 'Old', username: 'old@x.dev', updatedAt: '2026-01-01T00:00:00.000Z', _sync: 'synced'
    });
    await getCanaClient().table(META_STORE).put({
      id: 'lastSync:users', lastSync: '2026-01-15T00:00:00.000Z'
    });
    const created = {
      id: 'user-new',
      firstName: 'New',
      lastName: '',
      username: 'new@x.dev',
      updatedAt: '2026-02-01T00:00:00.000Z',
      roles: ['user'],
      emails: [],
      documents: [],
      phones: []
    };
    const tombstone = {
      id: 'user-old',
      username: 'old@x.dev',
      updatedAt: '2026-02-02T00:00:00.000Z',
      deletedAt: '2026-02-02T00:00:00.000Z'
    };
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const href = String(input);
      if (href.includes('/users') && !href.includes('/users/user-')) {
        return jsonResponse(200, {
          result: [created, tombstone], total: 2, page: 1, size: 100
        });
      }
      return jsonResponse(200, emptyPage);
    }) as unknown as typeof fetch;

    await deltaSync();

    expect(await getLocal('User', 'user-old')).toBeUndefined();
    const synced = await getLocal('User', 'user-new');
    expect(synced?.firstName).toBe('New');
    expect(synced?._sync).toBe('synced');
  });

  it('fullLoad skips entities the role cannot list (403)', async () => {
    expect.hasAssertions();
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const href = String(input);
      if (href.includes('/organizations')) return jsonResponse(403, { message: 'forbidden' });
      if (href.includes('/users/user-1')) {
        return jsonResponse(200, {
          id: 'user-1', firstName: 'Abraham', username: 'me@x.dev', emails: [{ id: 'e1', type: 'work', email: 'me@x.dev' }]
        });
      }
      if (href.includes('/users')) {
        return jsonResponse(200, {
          result: [{
            id: 'user-1', firstName: 'Abraham', username: 'me@x.dev', updatedAt: '2026-01-01T00:00:00.000Z'
          }],
          total: 1,
          page: 1,
          size: 100
        });
      }
      return jsonResponse(200, emptyPage);
    }) as unknown as typeof fetch;

    await fullLoad();

    const local = await getLocal('User', 'user-1');
    expect(local?.username).toBe('me@x.dev');
    expect(await getCanaClient().table('organizations').count()).toBe(0);
  });

  it('hydrateDetails keeps the list row when GET-by-id answers 403', async () => {
    expect.hasAssertions();
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const href = String(input);
      if (href.includes('/users/user-1')) return jsonResponse(403, { message: 'forbidden' });
      if (href.includes('/users')) {
        return jsonResponse(200, {
          result: [{
            id: 'user-1', firstName: 'Abraham', username: 'me@x.dev', updatedAt: '2026-01-01T00:00:00.000Z'
          }],
          total: 1,
          page: 1,
          size: 100
        });
      }
      return jsonResponse(200, emptyPage);
    }) as unknown as typeof fetch;

    await fullLoad();

    const local = await getLocal('User', 'user-1');
    expect(local?.firstName).toBe('Abraham');
    expect(local?.emails).toBeUndefined();
  });

  it('hydrateDetails aborts the load when GET-by-id fails with a server error', async () => {
    expect.hasAssertions();
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const href = String(input);
      if (href.includes('/users/user-1')) return jsonResponse(500, { message: 'boom' });
      if (href.includes('/users')) {
        return jsonResponse(200, {
          result: [{
            id: 'user-1', firstName: 'Abraham', username: 'me@x.dev', updatedAt: '2026-01-01T00:00:00.000Z'
          }],
          total: 1,
          page: 1,
          size: 100
        });
      }
      return jsonResponse(200, emptyPage);
    }) as unknown as typeof fetch;

    await expect(fullLoad()).rejects.toThrow();
  });

  it('runSessionSync wipes the local data when the signed-in user changed', async () => {
    expect.hasAssertions();
    const users = getCanaClient().table('users');
    await users.put({
      id: 'stale', firstName: 'Stale', username: 'stale@x.dev', _sync: 'synced'
    });
    await getCanaClient().table(META_STORE).put({
      id: SESSION_META_ID,
      username: 'other@x.dev',
      userId: 'other',
      lastSyncAt: '2026-01-01T00:00:00.000Z'
    });
    globalThis.fetch = (async () => jsonResponse(200, emptyPage)) as unknown as typeof fetch;

    await runSessionSync();

    const session = await getCanaClient()
      .table(META_STORE)
      .get(SESSION_META_ID) as { username?: string };
    expect(session.username).toBe('eduardo@xpertminds.dev');
    expect(await getLocal('User', 'stale')).toBeUndefined();
    expect(await isSynced()).toBe(true);
  });

  it('runSessionSync takes the delta path when the session is already synced', async () => {
    expect.hasAssertions();
    await getCanaClient().table(META_STORE).put({
      id: SESSION_META_ID,
      username: 'eduardo@xpertminds.dev',
      userId: 'user-1',
      lastSyncAt: '2026-01-01T00:00:00.000Z'
    });
    await getCanaClient().table(META_STORE).put({
      id: 'lastSync:users', lastSync: '2026-01-01T00:00:00.000Z'
    });
    const urls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return jsonResponse(200, emptyPage);
    }) as unknown as typeof fetch;

    await runSessionSync();

    expect(urls.some((href) => href.includes('/users'))).toBe(true);
    expect(await isSynced()).toBe(true);
  });

  it('runSessionSync boots Cana when the client is closed', async () => {
    expect.hasAssertions();
    await closeCana();
    expect(isCanaOpen()).toBe(false);
    globalThis.fetch = (async () => jsonResponse(200, emptyPage)) as unknown as typeof fetch;

    await runSessionSync();

    expect(isCanaOpen()).toBe(true);
    expect(await isSynced()).toBe(true);
  });

  it('runSessionSync fails closed when IndexedDB is unavailable', async () => {
    expect.hasAssertions();
    await closeCana();
    const factory = globalThis.indexedDB;
    delete (globalThis as { indexedDB?: IDBFactory }).indexedDB;
    try {
      await expect(runSessionSync()).rejects.toThrow('IndexedDB is not available.');
    } finally {
      globalThis.indexedDB = factory;
    }
  });

  it('bindOnlineReplay runs a session sync when the browser comes back online', async () => {
    expect.hasAssertions();
    globalThis.fetch = (async () => jsonResponse(200, emptyPage)) as unknown as typeof fetch;
    bindOnlineReplay();
    window.dispatchEvent(new Event('online'));
    await pollUntil(() => isSynced());
    expect(await isSynced()).toBe(true);
  });
});
