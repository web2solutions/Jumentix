import {
  afterEach, describe, expect, it
} from 'bun:test';

import { buildCanaSchema, SCHEMA_META_ID, META_STORE } from '@/data/canaSchema';
import {
  bootCana,
  canaBootStatus,
  closeCana,
  exposeCanaTestHooks,
  getCanaClient,
  isCanaOpen,
  openCana
} from '@/data/db';

const DB_A = 'jumentix-frontend-test-db-a';
const DB_B = 'jumentix-frontend-test-db-b';

const indexedDbBackup = (): IDBFactory | undefined => globalThis.indexedDB;

const restoreIndexedDb = (factory: IDBFactory | undefined): void => {
  if (factory === undefined) {
    delete (globalThis as { indexedDB?: IDBFactory }).indexedDB;
    return;
  }
  globalThis.indexedDB = factory;
};

/** Cana boot lifecycle (JUM-802): open, fingerprint migration, failure modes. */
describe('Cana boot lifecycle (JUM-802)', () => {
  afterEach(async () => {
    await closeCana();
  });

  it('fails loudly when the client is read before open', async () => {
    expect.hasAssertions();
    await closeCana();
    expect(() => getCanaClient()).toThrow('Cana is not open.');
  });

  it('reuses the open client for the same name and swaps it on a name change', async () => {
    expect.hasAssertions();
    const first = await openCana(DB_A);
    const again = await openCana(DB_A);
    expect(again).toBe(first);
    const second = await openCana(DB_B);
    expect(second).not.toBe(first);
    expect(isCanaOpen()).toBe(true);
  });

  it('recreates the database when the recorded schema fingerprint is stale', async () => {
    expect.hasAssertions();
    const client = await openCana(DB_A);
    await client.table('users').put({ id: 'u-stale', firstName: 'Ana', username: 'ana' });
    await client.table(META_STORE).put({ id: SCHEMA_META_ID, fingerprint: 'stale-fingerprint', version: 1 });
    await closeCana();
    const reopened = await openCana(DB_A);
    const meta = await reopened.table(META_STORE).get(SCHEMA_META_ID) as { fingerprint?: string };
    expect(meta.fingerprint).not.toBe('stale-fingerprint');
    expect(await reopened.table('users').get('u-stale')).toBeUndefined();
  });

  it('deletes and recreates the database when the stored version is newer (UpgradeFailed)', async () => {
    expect.hasAssertions();
    const newerVersion = buildCanaSchema().version + 10;
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_A, newerVersion);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('sentinel');
      };
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('open blocked'));
    });
    const client = await openCana(DB_A);
    expect(isCanaOpen()).toBe(true);
    expect(canaBootStatus()).toBe('ok');
    expect(await client.table('users').count()).toBe(0);
  });

  it('marks the boot unavailable and rethrows when IndexedDB is missing', async () => {
    expect.hasAssertions();
    const factory = indexedDbBackup();
    delete (globalThis as { indexedDB?: IDBFactory }).indexedDB;
    try {
      await expect(openCana(DB_A)).rejects.toThrow();
      expect(canaBootStatus()).toBe('unavailable');
      expect(isCanaOpen()).toBe(false);
    } finally {
      restoreIndexedDb(factory);
    }
  });

  it('marks the boot unavailable and rethrows non-Cana open failures', async () => {
    expect.hasAssertions();
    const factory = indexedDbBackup();
    (globalThis as { indexedDB?: unknown }).indexedDB = {
      open: () => {
        throw new Error('disk gone');
      }
    };
    try {
      await expect(openCana(DB_A)).rejects.toThrow();
      expect(canaBootStatus()).toBe('unavailable');
      expect(isCanaOpen()).toBe(false);
    } finally {
      restoreIndexedDb(factory);
    }
  });

  it('bootCana reports ok with IndexedDB and unavailable without it', async () => {
    expect.hasAssertions();
    await closeCana();
    expect(await bootCana()).toBe('ok');
    expect(canaBootStatus()).toBe('ok');
    await closeCana();
    const factory = indexedDbBackup();
    delete (globalThis as { indexedDB?: IDBFactory }).indexedDB;
    try {
      expect(await bootCana()).toBe('unavailable');
      expect(canaBootStatus()).toBe('unavailable');
    } finally {
      restoreIndexedDb(factory);
    }
  });

  it('exposes wipe and store-listing hooks on window for e2e tests', async () => {
    expect.hasAssertions();
    await openCana(DB_A);
    exposeCanaTestHooks();
    const hook = window as Window & {
      __jumentixWipeCana?: () => Promise<void>;
      __jumentixObjectStores?: () => string[];
    };
    expect(hook.__jumentixObjectStores?.()).toContain('users');
    await hook.__jumentixWipeCana?.();
    expect(isCanaOpen()).toBe(true);
    expect(await getCanaClient().table('users').count()).toBe(0);
  });
});
