import {
  InMemoryIdReservationLedger,
  TOMBSTONE_PURGE_TTL_DAYS,
  assertSeedIdNotPurged,
  purgeTombstones,
  type IPurgeRecord,
  type IPurgeStore
} from '../src';

const oldTombstone = '2026-01-01T00:00:00.000Z';
const now = new Date('2026-06-01T00:00:00.000Z');

const makeStore = (
  entity: string,
  rows: IPurgeRecord[]
): IPurgeStore & { rows: IPurgeRecord[] } => {
  const store = {
    entity,
    rows: [...rows],
    async listTombstones() {
      return store.rows.filter((row) => row.deletedAt);
    },
    async hardDelete(id: string) {
      const before = store.rows.length;
      store.rows = store.rows.filter((row) => row.id !== id);
      return store.rows.length < before;
    }
  };
  return store;
};

describe('purgeTombstones', () => {
  it('dry-run lists eligible tombstones and writes nothing', async () => {
    expect.hasAssertions();
    const ledger = new InMemoryIdReservationLedger();
    const users = makeStore('User', [
      { id: 'live', deletedAt: null },
      { id: 'old', deletedAt: oldTombstone },
      { id: 'young', deletedAt: '2026-05-20T00:00:00.000Z' }
    ]);
    const report = await purgeTombstones({
      stores: [users],
      ledger,
      now,
      olderThanDays: TOMBSTONE_PURGE_TTL_DAYS,
      commit: false
    });
    expect(report).toMatchObject({
      dryRun: true,
      skippedTooYoung: 1,
      events: [{ entity: 'User', id: 'old', dryRun: true }]
    });
    expect(users.rows.some((row) => row.id === 'old')).toBe(true);
    expect(ledger.has('User', 'old')).toBe(false);
  });

  it('commit removes PII row and reserves the id', async () => {
    expect.hasAssertions();
    const ledger = new InMemoryIdReservationLedger();
    const users = makeStore('User', [{ id: 'old', deletedAt: oldTombstone }]);
    const report = await purgeTombstones({
      stores: [users],
      ledger,
      now,
      commit: true
    });
    expect(report.dryRun).toBe(false);
    expect(users.rows).toHaveLength(0);
    expect(ledger.has('User', 'old')).toBe(true);
    expect(ledger.get('User', 'old')?.purgedAt).toBe('2026-06-01T00:00:00.000Z');
  });

  it('protects seed ids and refuse recreate after purge', async () => {
    expect.hasAssertions();
    const ledger = new InMemoryIdReservationLedger();
    const users = makeStore('User', [
      { id: 'seed-1', deletedAt: oldTombstone },
      { id: 'other', deletedAt: oldTombstone }
    ]);
    const dry = await purgeTombstones({
      stores: [users],
      ledger,
      now,
      commit: true,
      excludeIds: ['seed-1']
    });
    expect(dry.skippedProtected).toBe(1);
    expect(users.rows.map((row) => row.id)).toStrictEqual(['seed-1']);
    expect(ledger.has('User', 'other')).toBe(true);
    expect(() => assertSeedIdNotPurged(ledger, 'User', 'other')).toThrow(
      'Seed id other (User) was purged; cannot recreate'
    );
    expect(() => assertSeedIdNotPurged(ledger, 'User', 'seed-1')).not.toThrow();
  });
});
