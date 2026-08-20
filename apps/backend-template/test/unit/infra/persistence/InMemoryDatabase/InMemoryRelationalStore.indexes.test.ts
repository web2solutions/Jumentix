import { InMemoryRelationalStore } from '@src/infra/persistence/InMemoryDatabase/Stores/InMemoryRelationalStore';

/**
 * The store's indexes as records move between values (JUM-681).
 *
 * The suite beside this one covers create, read, update and delete against the
 * happy path. What it does not move is an indexed value: a unique field edited
 * to something else, a relation repointed at another parent, the last member of
 * a relation removed. Each of those has to maintain the index on both sides —
 * release the old key, claim the new one — and an index that only ever grows
 * looks identical until the day a value is reused.
 *
 * The failures this guards are quiet ones. A stale unique key rejects a value
 * nobody holds any more ("username already taken" for a username that was
 * renamed); a stale relation key returns a record that has moved away, which is
 * a document appearing under an organization it no longer belongs to.
 *
 * The store is real. There is nothing to double: it is the double.
 */
type Row = {
  id: string;
  username: string;
  organization: string;
  label?: string;
};

const makeStore = () => new InMemoryRelationalStore<Row>({
  uniqueIndexes: ['username'],
  caseInsensitiveUniqueIndexes: ['username'],
  relationIndexes: ['organization']
} as never);

describe('in-memory relational store indexes (JUM-681)', () => {
  it('releases the old unique value when a record is renamed', async () => {
    expect.hasAssertions();

    const store = makeStore();
    await store.create('r1', { id: 'r1', username: 'alice', organization: 'org-1' });

    await store.update('r1', { id: 'r1', username: 'alice2', organization: 'org-1' });

    // The freed name has to be claimable, or a rename permanently burns it.
    await expect(store.create('r2', { id: 'r2', username: 'alice', organization: 'org-1' }))
      .resolves.toBeDefined();
  });

  it('holds the unique value against a different record, case-insensitively', async () => {
    expect.hasAssertions();

    const store = makeStore();
    await store.create('r1', { id: 'r1', username: 'alice', organization: 'org-1' });

    await expect(store.create('r2', { id: 'r2', username: 'ALICE', organization: 'org-1' }))
      .rejects.toThrow('username');
  });

  it('lets a record keep its own unique value across an unrelated edit', async () => {
    expect.hasAssertions();

    // The check has to exclude the record being written, or no record can ever
    // be updated twice.
    const store = makeStore();
    await store.create('r1', { id: 'r1', username: 'alice', organization: 'org-1' });

    await store.update('r1', {
      id: 'r1', username: 'alice', organization: 'org-1', label: 'edited'
    });

    expect((await store.getOneById('r1'))?.label).toBe('edited');
  });

  it('moves a record between relations, leaving neither index stale', async () => {
    expect.hasAssertions();

    const store = makeStore();
    await store.create('r1', { id: 'r1', username: 'alice', organization: 'org-1' });

    await store.update('r1', { id: 'r1', username: 'alice', organization: 'org-2' });

    await expect(store.getByRelation('organization', 'org-1')).resolves.toStrictEqual([]);
    expect((await store.getByRelation('organization', 'org-2')).map((row) => row.id))
      .toStrictEqual(['r1']);
  });

  it('drops the relation key once its last member is deleted', async () => {
    expect.hasAssertions();

    const store = makeStore();
    await store.create('r1', { id: 'r1', username: 'alice', organization: 'org-1' });
    await store.create('r2', { id: 'r2', username: 'bob', organization: 'org-1' });

    await store.delete('r1');
    const afterFirst = await store.getByRelation('organization', 'org-1');
    await store.delete('r2');

    expect(afterFirst.map((row) => row.id)).toStrictEqual(['r2']);
    await expect(store.getByRelation('organization', 'org-1')).resolves.toStrictEqual([]);
  });

  it('answers an unknown relation and an unknown field with nothing', async () => {
    expect.hasAssertions();

    const store = makeStore();
    await store.create('r1', { id: 'r1', username: 'alice', organization: 'org-1' });

    // Neither is an error: a listing for an organization with no records and a
    // listing on a field nobody indexed are both empty, not a crash.
    await expect(store.getByRelation('organization', 'org-404')).resolves.toStrictEqual([]);
    await expect(store.getByRelation('username' as keyof Row, 'alice')).resolves.toStrictEqual([]);
  });

  it('indexes a record whose relation value is empty without claiming a key', async () => {
    expect.hasAssertions();

    // An empty reference is "no parent", not a parent named "".
    const store = makeStore();
    await store.create('r1', { id: 'r1', username: 'alice', organization: '' });

    await store.delete('r1');

    await expect(store.getByRelation('organization', '')).resolves.toStrictEqual([]);
  });
});
