import {
  afterEach, beforeEach, describe, expect, it, mock
} from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';

import { useXCrud } from '@/components/x-crud/useXCrud';
import { usersCrudConfig } from '@/features/users/usersCrudConfig';
import { useAuthStore } from '@/stores/auth';
import { useProfileStore } from '@/stores/profile';

interface FixtureUser {
  id: string;
  firstName: string;
  username: string;
  organization?: string;
  roles: string[];
  emails: unknown[];
  createdAt: string;
}

const fixtureRows: FixtureUser[] = [
  {
    id: 'u1', firstName: 'Zoe', username: 'zoe@x.dev', roles: ['admin'], emails: [{}], createdAt: '2026-01-02T00:00:00Z'
  },
  {
    id: 'u2', firstName: 'Abraham', username: 'abe@x.dev', roles: ['user'], emails: [{}, {}], createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'u3', firstName: 'Mike', username: 'mike@x.dev', roles: ['user'], emails: [], createdAt: '2026-01-03T00:00:00Z'
  }
];

let listResponse: unknown = { result: fixtureRows };
const recorded: Array<{ url: string; method: string; body?: unknown }> = [];

/** JUM-772: useXCrud behaviors — sort, filters, search, pagination, aggregates. */
describe('useXCrud over the Users X-CRUD config', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    recorded.length = 0;
    listResponse = { result: fixtureRows };
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.token = 'Bearer session-token';
    auth.userId = 'u1';
    const profile = useProfileStore();
    profile.record = {
      id: 'u1',
      firstName: 'Zoe',
      username: 'zoe@x.dev',
      roles: ['admin'],
      emails: [],
      documents: [],
      phones: []
    };
    globalThis.fetch = mock((url: string, init: { method: string; body?: string }) => {
      recorded.push({
        url: String(url),
        method: init.method,
        body: init.body ? JSON.parse(init.body) : undefined
      });
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(listResponse),
        text: () => Promise.resolve('')
      } as unknown as Response);
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('derives grid columns from the User schema and drops password', async () => {
    expect.assertions(3);
    const crud = useXCrud(usersCrudConfig);
    const names = crud.columns.map((d) => d.name);
    expect(names).toContain('firstName');
    expect(names).toContain('roles');
    expect(names).not.toContain('password');
    await crud.load();
  });

  it('sorts by column asc/desc/none, typed (string, date)', async () => {
    expect.assertions(3);
    const crud = useXCrud(usersCrudConfig);
    await crud.load();
    crud.toggleSort('firstName');
    expect(crud.visibleRows.value.map((r) => r.firstName)).toStrictEqual(['Abraham', 'Mike', 'Zoe']);
    crud.toggleSort('firstName');
    expect(crud.visibleRows.value.map((r) => r.firstName)).toStrictEqual(['Zoe', 'Mike', 'Abraham']);
    crud.toggleSort('createdAt'); // third click on another field starts asc
    expect(crud.visibleRows.value.map((r) => r.id)).toStrictEqual(['u2', 'u1', 'u3']);
  });

  it('searches across the configured searchFields only', async () => {
    expect.assertions(2);
    const crud = useXCrud(usersCrudConfig);
    await crud.load();
    crud.setSearch('mike@x.dev');
    expect(crud.filteredRows.value.map((r) => r.id)).toStrictEqual(['u3']);
    crud.setSearch('admin'); // roles is not a search field
    expect(crud.filteredRows.value).toStrictEqual([]);
  });

  it('filters per field with AND semantics and clears individually', async () => {
    expect.assertions(3);
    const crud = useXCrud(usersCrudConfig);
    await crud.load();
    crud.setFilter('firstName', 'zo');
    expect(crud.filteredRows.value.map((r) => r.id)).toStrictEqual(['u1']);
    crud.setFilter('username', 'nobody');
    expect(crud.filteredRows.value).toStrictEqual([]);
    crud.setFilter('username', '');
    expect(crud.filteredRows.value.map((r) => r.id)).toStrictEqual(['u1']);
  });

  it('paginates with the pager and resets the page on new filters', async () => {
    expect.assertions(3);
    const crud = useXCrud({ ...usersCrudConfig, pageSize: 2 });
    await crud.load();
    expect(crud.visibleRows.value.map((r) => r.id)).toStrictEqual(['u1', 'u2']);
    crud.nextPage();
    expect(crud.visibleRows.value.map((r) => r.id)).toStrictEqual(['u3']);
    crud.setFilter('firstName', '');
    expect(crud.page.value).toBe(1);
  });

  it('scroll mode grows the visible window instead of paging', async () => {
    expect.assertions(2);
    const crud = useXCrud({ ...usersCrudConfig, pagination: 'scroll', pageSize: 2 });
    await crud.load();
    expect(crud.visibleRows.value).toHaveLength(2);
    crud.nextPage();
    expect(crud.visibleRows.value).toHaveLength(3);
  });

  it('computes aggregates: total count and breakdown per organization', async () => {
    expect.assertions(3);
    const crud = useXCrud(usersCrudConfig);
    await crud.load();
    const [total, perOrg] = usersCrudConfig.aggregates!;
    expect(crud.aggregateValue(total)).toBe(3);
    // one distinct org bucket (rows without org collapse)
    expect(crud.aggregateValue(perOrg)).toBe(1);
    expect(crud.aggregateBreakdown(perOrg).map((b) => b.value)).toStrictEqual([3]);
  });

  it('create maps primaryEmail into emails[0] via beforeSubmit', async () => {
    expect.assertions(2);
    const crud = useXCrud(usersCrudConfig);
    await crud.load();
    await crud.submitCreate({
      firstName: 'New',
      username: 'new@x.dev',
      password: 'x'.repeat(8),
      primaryEmail: 'new@x.dev',
      roles: ['user']
    });
    const createCall = recorded.find((call) => call.method === 'POST');
    expect((createCall?.body as Record<string, unknown>).emails).toStrictEqual([{
      email: 'new@x.dev', type: 'work', isPrimary: true
    }]);
    expect((createCall?.body as Record<string, unknown>).primaryEmail).toBeUndefined();
  });

  it('inline commit merges the edited scalar into the full row', async () => {
    expect.assertions(2);
    const crud = useXCrud(usersCrudConfig);
    await crud.load();
    await crud.submitInline('u2', 'firstName', 'Updated');
    const putCall = recorded.find((call) => call.method === 'PUT');
    expect((putCall?.body as Record<string, unknown>).firstName).toBe('Updated');
    expect((putCall?.body as Record<string, unknown>).username).toBe('abe@x.dev');
  });

  it('roles options come from the OAS x-rbac matrix keys', () => {
    expect.assertions(1);
    expect(usersCrudConfig.arrayOptions?.roles).toStrictEqual(['superadmin', 'admin', 'user']);
  });

  it('row selection supports single, all-visible and bulk delete', async () => {
    expect.assertions(4);
    const crud = useXCrud(usersCrudConfig);
    await crud.load();
    crud.toggleSelect('u1');
    expect([...crud.selected.value]).toStrictEqual(['u1']);
    crud.toggleSelectAllVisible();
    expect(crud.selected.value.size).toBe(3);
    await crud.submitBulkDelete();
    const deletes = recorded.filter((call) => call.method === 'DELETE');
    expect(deletes).toHaveLength(3);
    expect(crud.selected.value.size).toBe(0);
  });

  it('column visibility toggles hide/show and pageSize is switchable', async () => {
    expect.assertions(4);
    const crud = useXCrud(usersCrudConfig);
    await crud.load();
    const total = crud.visibleColumns.value.length;
    crud.toggleColumn('username');
    expect(crud.visibleColumns.value.length).toBe(total - 1);
    crud.toggleColumn('username');
    expect(crud.visibleColumns.value.length).toBe(total);
    crud.setPageSize(50);
    expect(crud.pageSize.value).toBe(50);
    expect(crud.page.value).toBe(1);
  });
});
