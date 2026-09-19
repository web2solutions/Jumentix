import {
  afterEach, beforeEach, describe, expect, it
} from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';

import {
  countPendingLocal, loadMetrics
} from '@/components/dashboard/loadMetrics';
import {
  closeCana, getCanaClient, openCana, wipeCanaDatabase
} from '@/data/db';

const DB = 'jumentix-frontend-test-load-metrics';

/**
 * Dashboard metrics over the offline store (JUM-811). With Cana open,
 * `loadMetrics` reads local records and aggregates them in memory; the
 * suites here drive the real Cana layer (same pattern as the data-layer
 * suites) so the offline path is exercised against real rows, not stubs.
 */
describe('dashboard loadMetrics offline path (JUM-811)', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    await openCana(DB);
    await wipeCanaDatabase();
  });

  afterEach(async () => {
    await closeCana();
  });

  const seedUsers = async () => {
    const users = getCanaClient().table('users');
    await users.put({
      id: 'u1', username: 'ana', createdAt: '2026-01-01T00:00:00.000Z'
    });
    await users.put({
      id: 'u2', username: 'bia', createdAt: '2026-03-01T00:00:00.000Z'
    });
    await users.put({
      id: 'u3', username: 'cio', createdAt: '2026-03-05T00:00:00.000Z'
    });
    await users.put({
      id: 'u4', username: 'dio', createdAt: '2026-03-09T00:00:00.000Z', deletedAt: '2026-03-10T00:00:00.000Z'
    });
  };

  it('counts every live local record when no since window is given', async () => {
    expect.hasAssertions();
    await seedUsers();

    const result = await loadMetrics({
      listOperationId: 'getAll',
      metricsOperationId: 'getUsersMetrics',
      schemaName: 'User',
      metric: 'count'
    });

    expect(result).toStrictEqual({
      metric: 'count',
      buckets: [{ key: 'total', count: 3 }]
    });
  });

  it('filters local records to the since window before aggregating', async () => {
    expect.hasAssertions();
    await seedUsers();

    const result = await loadMetrics({
      listOperationId: 'getAll',
      metricsOperationId: 'getUsersMetrics',
      schemaName: 'User',
      metric: 'count',
      since: '2026-02-15T00:00:00.000Z'
    });

    expect(result.buckets).toStrictEqual([{ key: 'total', count: 2 }]);
  });

  it('groups the live local records by a contract groupable field', async () => {
    expect.hasAssertions();
    const users = getCanaClient().table('users');
    await users.put({ id: 'u1', username: 'ana', roles: ['admin'] });
    await users.put({ id: 'u2', username: 'bia', roles: ['user'] });
    await users.put({ id: 'u3', username: 'cio', roles: ['admin', 'user'] });

    const result = await loadMetrics({
      listOperationId: 'getAll',
      metricsOperationId: 'getUsersMetrics',
      schemaName: 'User',
      metric: 'groupBy',
      field: 'roles'
    });

    expect(result.metric).toBe('groupBy');
    expect(result.field).toBe('roles');
    expect(result.buckets).toStrictEqual([
      { key: 'admin', count: 2 },
      { key: 'user', count: 2 }
    ]);
  });

  it('counts pending local rows when Cana is open and reports zero when closed', async () => {
    expect.hasAssertions();
    const users = getCanaClient().table('users');
    await users.put({ id: 'u1', username: 'ana', _sync: 'pending' });
    await users.put({ id: 'u2', username: 'bia', _sync: 'pending' });
    await users.put({ id: 'u3', username: 'cio', _sync: 'synced' });

    expect(await countPendingLocal('User')).toBe(2);

    await closeCana();
    expect(await countPendingLocal('User')).toBe(0);
  });
});
