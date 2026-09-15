import { InMemoryRelationalStore } from '@src/infra/persistence/InMemoryDatabase/Stores/InMemoryRelationalStore';

interface IRecord {
  id: string;
  username: string;
  organization?: string;
}

describe('in memory relational store', () => {
  it('enforces unique indexes and relation lookup', async () => {
    expect.hasAssertions();
    const store = new InMemoryRelationalStore<IRecord>({
      uniqueIndexes: ['username'],
      caseInsensitiveUniqueIndexes: ['username'],
      relationIndexes: ['organization']
    });

    await store.create('1', { id: '1', username: 'john', organization: 'org-1' });
    await expect(store.create('2', { id: '2', username: 'JOHN', organization: 'org-2' }))
      .rejects
      .toThrow('username already in use');

    await store.create('2', { id: '2', username: 'mary', organization: 'org-1' });
    const byOrg = await store.getByRelation('organization', 'org-1');
    expect(byOrg).toHaveLength(2);
  });

  it('updates records and paginates filtered result', async () => {
    expect.hasAssertions();
    const store = new InMemoryRelationalStore<IRecord>();
    await store.create('1', { id: '1', username: 'john', organization: 'org-1' });
    await store.create('2', { id: '2', username: 'mary', organization: 'org-2' });
    await store.update('2', { id: '2', username: 'mary-updated', organization: 'org-2' });

    const page = await store.getAll({ organization: 'org-2' }, { page: 1, size: 10 });
    expect(page.total).toBe(1);
    expect(page.result[0].username).toBe('mary-updated');
    await expect(store.getAll({}, { page: 0, size: 10 })).rejects.toThrow('page must be greater than 0');
    await expect(store.getAll({}, { page: 3, size: 1 })).rejects.toThrow(
      'page number must be smaller than the number of total pages'
    );
  });

  it('covers relation index moves, cleanup and not found branches', async () => {
    expect.hasAssertions();
    const store = new InMemoryRelationalStore<IRecord>({
      relationIndexes: ['organization']
    });

    await expect(store.getOneById('missing')).rejects.toThrow('Record not found');
    await expect(store.update('missing', { id: 'missing', username: 'n/a' })).rejects.toThrow('Record not found');

    await store.create('1', { id: '1', username: 'john', organization: 'org-1' });
    await store.create('2', { id: '2', username: 'mary', organization: 'org-2' });
    await expect(store.create('1', { id: '1', username: 'again' })).rejects.toThrow('The field "id" already exists.');

    await store.update('2', { id: '2', username: 'mary', organization: 'org-3' });
    await expect(store.getByRelation('organization', 'org-2')).resolves.toHaveLength(0);
    await expect(store.getByRelation('organization', 'org-3')).resolves.toHaveLength(1);
  });

  it('cleans relation indexes on delete and handles delete misses', async () => {
    expect.hasAssertions();
    const store = new InMemoryRelationalStore<IRecord>({
      relationIndexes: ['organization']
    });

    await store.create('2', { id: '2', username: 'mary', organization: 'org-3' });
    await store.delete('2');
    await expect(store.getByRelation('organization', 'org-3')).resolves.toHaveLength(0);
    await expect(store.delete('missing')).resolves.toBe(false);
  });

  it('tolerates stale relation index entries during delete cleanup', async () => {
    expect.hasAssertions();
    const store = new InMemoryRelationalStore<IRecord>({
      relationIndexes: ['organization']
    });

    await store.create('1', { id: '1', username: 'john', organization: 'org-1' });
    (store as any).relationIndexes.organization.delete('org-1');

    await expect(store.delete('1')).resolves.toBe(true);
  });

  it('soft-deletes, hides tombstones, and frees unique indexes', async () => {
    expect.hasAssertions();
    const store = new InMemoryRelationalStore<IRecord & { deletedAt?: string }>({
      uniqueIndexes: ['username'],
      caseInsensitiveUniqueIndexes: ['username'],
      relationIndexes: ['organization'],
      softDelete: true
    });

    await store.create('1', { id: '1', username: 'john', organization: 'org-1' });
    await expect(store.delete('1')).resolves.toBe(true);
    await expect(store.getOneById('1')).rejects.toThrow('Record not found');
    const tombstone = await store.getOneById('1', { includeDeleted: true });
    expect(tombstone.deletedAt).toBeTruthy();
    expect((await store.getAll({}, { page: 1, size: 10 })).total).toBe(0);
  });

  it('releases unique indexes after a tombstone and keeps the id reserved', async () => {
    expect.hasAssertions();
    const store = new InMemoryRelationalStore<IRecord & { deletedAt?: string }>({
      uniqueIndexes: ['username'],
      caseInsensitiveUniqueIndexes: ['username'],
      relationIndexes: ['organization'],
      softDelete: true
    });

    await store.create('1', { id: '1', username: 'john', organization: 'org-1' });
    await store.delete('1');
    await expect(store.getByRelation('organization', 'org-1')).resolves.toHaveLength(0);
    await expect(store.create('2', { id: '2', username: 'john', organization: 'org-1' }))
      .resolves.toMatchObject({ username: 'john' });
    await expect(store.create('1', { id: '1', username: 'other' }))
      .rejects.toThrow('The field "id" already exists.');
  });

  it('hard-deletes a tombstone and reserves the id on the ledger', async () => {
    expect.hasAssertions();
    const { InMemoryIdReservationLedger } = require('@jumentix/persistence-contracts');
    const ledger = new InMemoryIdReservationLedger();
    const store = new InMemoryRelationalStore<IRecord & { deletedAt?: string }>({
      uniqueIndexes: ['username'],
      softDelete: true,
      entity: 'User',
      ledger
    });
    await store.create('gone', { id: 'gone', username: 'tmp' });
    await store.delete('gone');
    await expect(store.hardDelete('gone')).resolves.toBe(true);
    ledger.reserve({ entity: 'User', id: 'gone', purgedAt: '2026-06-01T00:00:00.000Z' });
    await expect(store.create('gone', { id: 'gone', username: 'tmp2' }))
      .rejects.toThrow('The field "id" already exists.');
  });

  it('hard-delete reports a miss and skips empty relation refs', async () => {
    expect.hasAssertions();
    const store = new InMemoryRelationalStore<IRecord>({
      relationIndexes: ['organization']
    });

    await expect(store.hardDelete('missing')).resolves.toBe(false);

    await store.create('1', { id: '1', username: 'john' });
    await expect(store.hardDelete('1')).resolves.toBe(true);
  });

  it('hard-delete keeps a shared relation ref and drops an emptied one', async () => {
    expect.hasAssertions();
    const store = new InMemoryRelationalStore<IRecord>({
      relationIndexes: ['organization']
    });

    await store.create('2', { id: '2', username: 'mary', organization: 'org-1' });
    await store.create('3', { id: '3', username: 'anna', organization: 'org-1' });
    await store.create('4', { id: '4', username: 'solo', organization: 'org-2' });

    await expect(store.hardDelete('2')).resolves.toBe(true);
    await expect(store.getByRelation('organization', 'org-1')).resolves.toHaveLength(1);

    await expect(store.hardDelete('4')).resolves.toBe(true);
    expect((store as any).relationIndexes.organization.has('org-2')).toBe(false);
  });

  it('hard-delete tolerates stale relation index entries', async () => {
    expect.hasAssertions();
    const store = new InMemoryRelationalStore<IRecord>({
      relationIndexes: ['organization']
    });

    await store.create('3', { id: '3', username: 'anna', organization: 'org-1' });
    (store as any).relationIndexes.organization.delete('org-1');

    await expect(store.hardDelete('3')).resolves.toBe(true);
    await expect(store.getByRelation('organization', 'org-1')).resolves.toHaveLength(0);
  });

  it('drops stale and tombstoned entries from relation lookups', async () => {
    expect.hasAssertions();
    const store = new InMemoryRelationalStore<IRecord & { deletedAt?: string }>({
      relationIndexes: ['organization'],
      softDelete: true
    });

    await store.create('1', { id: '1', username: 'john', organization: 'org-1' });
    await store.delete('1');

    const relationIndex = (store as any).relationIndexes.organization as Map<string, Set<string>>;
    relationIndex.set('org-1', new Set(['1', 'ghost']));

    await expect(store.getByRelation('organization', 'org-1')).resolves.toHaveLength(0);
  });
});
