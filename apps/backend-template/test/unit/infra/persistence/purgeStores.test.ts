import {
  InMemoryIdReservationLedger,
  TOMBSTONE_PURGE_TTL_DAYS,
  type IStore
} from '@jumentix/persistence-contracts';
import {
  adaptPurgeStore,
  purgeUserAndOrganizationTombstones
} from '@src/infra/persistence/purgeStores';
import { InMemoryRelationalStore } from '@src/infra/persistence/InMemoryDatabase/Stores/InMemoryRelationalStore';

type TRow = Record<string, unknown> & { id: string; name: string; deletedAt?: unknown };

const farFuture = new Date('2100-01-01T00:00:00.000Z');

describe('adaptPurgeStore', () => {
  it('lists only tombstoned rows and hard-deletes through the driver', async () => {
    expect.hasAssertions();
    const store = new InMemoryRelationalStore<TRow>({ softDelete: true });
    await store.create('live', { id: 'live', name: 'Live' });
    await store.create('gone', { id: 'gone', name: 'Gone' });
    await store.delete('gone');

    const adapter = adaptPurgeStore('User', store);
    const tombstones = await adapter.listTombstones();
    expect(tombstones.map((row) => row.id)).toStrictEqual(['gone']);

    await expect(adapter.hardDelete('gone')).resolves.toBe(true);
    await expect(adapter.listTombstones()).resolves.toStrictEqual([]);
  });

  it('treats a page without result as empty and refuses stores without hardDelete', async () => {
    expect.hasAssertions();
    const store: IStore<TRow> = {
      async delete() {
        return true;
      },
      async getOneById() {
        throw new Error('Record not found');
      },
      async create(key, value) {
        return value;
      },
      async update(key, value) {
        return value;
      },
      async getAll() {
        return { total: 0, result: null } as never;
      }
    };
    const adapter = adaptPurgeStore('User', store);
    await expect(adapter.listTombstones()).resolves.toStrictEqual([]);
    await expect(adapter.hardDelete('x'))
      .rejects.toThrow('Store User does not implement hardDelete');
  });
});

describe('purgeUserAndOrganizationTombstones', () => {
  const committedPurge = async () => {
    const ledger = new InMemoryIdReservationLedger();
    const userStore = new InMemoryRelationalStore<TRow>({ softDelete: true });
    const organizationStore = new InMemoryRelationalStore<TRow>({ softDelete: true });
    await userStore.create('u-old', { id: 'u-old', name: 'Old User' });
    await userStore.create('u-seed', { id: 'u-seed', name: 'Seed User' });
    await userStore.create('u-live', { id: 'u-live', name: 'Live User' });
    await organizationStore.create('o-old', { id: 'o-old', name: 'Old Org' });
    await userStore.delete('u-old');
    await userStore.delete('u-seed');
    await organizationStore.delete('o-old');

    const report = await purgeUserAndOrganizationTombstones({
      userStore,
      organizationStore,
      ledger,
      now: farFuture,
      olderThanDays: 0,
      commit: true,
      excludeIds: ['u-seed']
    });
    return {
      ledger, userStore, organizationStore, report
    };
  };

  it('reports the purged rows across both stores and the protected skip', async () => {
    expect.hasAssertions();
    const { report } = await committedPurge();

    expect(report.dryRun).toBe(false);
    expect(report.events.map((event) => `${event.entity}:${event.id}`).sort())
      .toStrictEqual(['Organization:o-old', 'User:u-old']);
    expect(report.skippedProtected).toBe(1);
  });

  it('reserves the purged ids on the ledger, never the protected one', async () => {
    expect.hasAssertions();
    const { ledger } = await committedPurge();

    expect(ledger.has('User', 'u-old')).toBe(true);
    expect(ledger.has('Organization', 'o-old')).toBe(true);
    expect(ledger.has('User', 'u-seed')).toBe(false);
  });

  it('drops the purged rows and keeps the protected and live ones', async () => {
    expect.hasAssertions();
    const { userStore } = await committedPurge();

    await expect(userStore.getOneById('u-old', { includeDeleted: true }))
      .rejects.toThrow('Record not found');
    await expect(userStore.getOneById('u-seed', { includeDeleted: true }))
      .resolves.toMatchObject({ id: 'u-seed' });
    await expect(userStore.getOneById('u-live')).resolves.toMatchObject({ id: 'u-live' });
  });

  it('dry-run reports without touching rows, the ledger, or the default TTL', async () => {
    expect.hasAssertions();
    const ledger = new InMemoryIdReservationLedger();
    const userStore = new InMemoryRelationalStore<TRow>({ softDelete: true });
    const organizationStore = new InMemoryRelationalStore<TRow>({ softDelete: true });
    await userStore.create('u-old', { id: 'u-old', name: 'Old User' });
    await userStore.delete('u-old');

    const report = await purgeUserAndOrganizationTombstones({
      userStore,
      organizationStore,
      ledger,
      now: farFuture,
      commit: false
    });

    expect(report.dryRun).toBe(true);
    expect(report.olderThanDays).toBe(TOMBSTONE_PURGE_TTL_DAYS);
    expect(report.events).toHaveLength(1);
    expect(ledger.list()).toHaveLength(0);
    await expect(userStore.getOneById('u-old', { includeDeleted: true }))
      .resolves.toMatchObject({ id: 'u-old' });
  });
});
