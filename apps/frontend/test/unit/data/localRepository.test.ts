import {
  afterEach, beforeEach, describe, expect, it
} from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';

import { entityTable, entityTableByStore } from '@/data/canaSchema';
import {
  closeCana, getCanaClient, openCana, wipeCanaDatabase
} from '@/data/db';
import {
  countLocal, resolveRelations, storeForChange, subscribeLocal
} from '@/data/localRepository';

const DB = 'jumentix-frontend-test-local-repo';

/** Local repository extras (JUM-803): counts, hasMany joins, subscriptions. */
describe('local repository extras (JUM-803)', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    await openCana(DB);
    await wipeCanaDatabase();
  });

  afterEach(async () => {
    await closeCana();
  });

  it('countLocal totals the visible rows of an entity', async () => {
    expect.hasAssertions();
    const users = getCanaClient().table('users');
    await users.put({
      id: 'u1', firstName: 'Ana', username: 'ana', updatedAt: '2026-01-01T00:00:00.000Z'
    });
    await users.put({
      id: 'u2', firstName: 'Bia', username: 'bia', updatedAt: '2026-01-02T00:00:00.000Z'
    });
    await users.put({
      id: 'u3', firstName: 'Cia', username: 'cia', updatedAt: '2026-01-03T00:00:00.000Z', deletedAt: '2026-01-04T00:00:00.000Z'
    });
    expect(await countLocal('User')).toBe(2);
  });

  it('resolves hasMany relations from the Organization members field', async () => {
    expect.hasAssertions();
    const client = getCanaClient();
    await client.table('organizations').put({ id: 'org-1', name: 'ACME' });
    await client.table('users').put({
      id: 'u1', firstName: 'Ana', username: 'ana', organization: 'org-1'
    });
    const joined = await resolveRelations('Organization', { id: 'org-1', name: 'ACME' });
    expect(Array.isArray(joined.users)).toBe(true);
  });

  it('storeForChange maps object stores back to entity tables', () => {
    expect.hasAssertions();
    expect(storeForChange('users')?.schemaName).toBe('User');
    expect(storeForChange('organizations')?.schemaName).toBe('Organization');
    expect(storeForChange('meta')).toBeUndefined();
    expect(entityTableByStore('users')?.storeName).toBe('users');
    expect(() => entityTable('NoSuchEntity')).toThrow('No Cana table for OAS entity NoSuchEntity');
  });

  it('subscribeLocal fires on writes to the entity and related stores', async () => {
    expect.hasAssertions();
    const events: string[] = [];
    const stop = subscribeLocal('User', () => {
      events.push('hit');
    });
    const client = getCanaClient();
    await client.table('users').put({ id: 'u1', firstName: 'Ana', username: 'ana' });
    await client.table('organizations').put({ id: 'org-1', name: 'ACME' });
    expect(events.length).toBeGreaterThanOrEqual(2);
    stop();
    await client.table('users').put({ id: 'u2', firstName: 'Bia', username: 'bia' });
    expect(events.length).toBe(2);
  });

  it('subscribeLocal is a no-op when Cana is closed', async () => {
    expect.hasAssertions();
    await closeCana();
    const stop = subscribeLocal('User', () => {
      throw new Error('must not fire');
    });
    expect(() => stop()).not.toThrow();
  });
});
