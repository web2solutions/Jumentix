import {
  afterEach, beforeEach, describe, expect, it, mock
} from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';

import { useXCrud } from '@/components/x-crud/useXCrud';
import type { XCrudEntityConfig } from '@/components/x-crud/xCrudTypes';
import { usersCrudConfig } from '@/features/users/usersCrudConfig';
import { setLocale } from '@/i18n';
import { useAuthStore } from '@/stores/auth';
import { useProfileStore } from '@/stores/profile';

interface FixtureUser extends Record<string, unknown> {
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

const recorded: Array<{ url: string; method: string; body?: unknown }> = [];

/** Lets a triggered `load()` (fetch mock + awaits) settle. */
const flush = () => new Promise<void>((resolve) => {
  setTimeout(resolve, 0);
});

/** Bounded poll on a condition — never a fixed wait (Requirement 134 §2). */
const pollUntil = async (condition: () => boolean, attempts = 200): Promise<void> => {
  for (let index = 0; index < attempts; index += 1) {
    if (condition()) return;
    // eslint-disable-next-line no-await-in-loop
    await flush();
  }
  throw new Error('pollUntil: condition not met');
};

/** The wire query of the last list request, decoded (filter is base64 JSON). */
const lastListQuery = (): Record<string, unknown> => {
  const call = [...recorded].reverse().find((entry) => entry.method === 'GET' && entry.url.includes('/users'));
  const url = new URL(call?.url ?? 'http://x/');
  const query: Record<string, unknown> = Object.fromEntries(url.searchParams.entries());
  if (typeof query.filter === 'string') query.filter = JSON.parse(atob(query.filter));
  return query;
};

/**
 * A tiny stand-in for the JUM-777 backend: applies `q`, `sort`, `page` and
 * `size` from the query string and answers the `{ result, page, size, total }`
 * envelope. Filters are recorded, not applied — the frontend's job is to send
 * them; the backend's suite proves they work.
 */
const serverAnswer = (url: string): unknown => {
  const params = new URL(url).searchParams;
  let rows = [...fixtureRows];
  const q = params.get('q');
  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter((row) => ['firstName', 'lastName', 'username']
      .some((field) => String(row[field] ?? '').toLowerCase().includes(needle)));
  }
  const sort = params.get('sort');
  if (sort) {
    const [field, direction] = sort.split(':');
    rows.sort((a, b) => String(a[field]).localeCompare(String(b[field])) * (direction === 'desc' ? -1 : 1));
  }
  const page = Number(params.get('page') ?? 1);
  const size = Number(params.get('size') ?? 30);
  return {
    result: rows.slice((page - 1) * size, page * size), page, size, total: rows.length
  };
};

/** JUM-772/778: useXCrud — server-side query, sort, filters, search, pagination, aggregates. */
describe('useXCrud over the Users X-CRUD config', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    recorded.length = 0;
    setLocale('en');
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
      const payload = init.method === 'GET' ? serverAnswer(String(url)) : {};
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(payload),
        text: () => Promise.resolve('')
      } as unknown as Response);
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('derives grid columns from the User schema and drops password', async () => {
    expect.assertions(3);
    const crud = useXCrud({ ...usersCrudConfig, debounceMs: 0 });
    const names = crud.columns.map((d) => d.name);
    expect(names).toContain('firstName');
    expect(names).toContain('roles');
    expect(names).not.toContain('password');
    await crud.load();
  });

  it('runs in server mode because getAll declares x-list-capabilities', async () => {
    expect.assertions(4);
    const crud = useXCrud({ ...usersCrudConfig, debounceMs: 0 });
    expect(crud.serverMode).toBe(true);
    await crud.load();
    expect(lastListQuery()).toStrictEqual({ page: '1', size: '30' });
    expect(crud.total.value).toBe(3);
    expect(crud.canSort('password')).toBe(false);
  });

  it('sorts by column asc/desc/none through the sort query param', async () => {
    expect.assertions(4);
    const crud = useXCrud({ ...usersCrudConfig, debounceMs: 0 });
    await crud.load();
    crud.toggleSort('firstName');
    await flush();
    expect(lastListQuery().sort).toBe('firstName:asc');
    expect(crud.visibleRows.value.map((r) => r.firstName)).toStrictEqual(['Abraham', 'Mike', 'Zoe']);
    crud.toggleSort('firstName');
    await flush();
    expect(lastListQuery().sort).toBe('firstName:desc');
    crud.toggleSort('firstName');
    await flush();
    expect(lastListQuery().sort).toBeUndefined();
  });

  it('searches with q, and only when the contract declares searchable fields', async () => {
    expect.assertions(3);
    const crud = useXCrud({ ...usersCrudConfig, debounceMs: 0 });
    await crud.load();
    crud.setSearch('mike@x.dev');
    await flush();
    expect(lastListQuery().q).toBe('mike@x.dev');
    expect(crud.visibleRows.value.map((r) => r.id)).toStrictEqual(['u3']);
    expect(crud.canSearch.value).toBe(true);
  });

  it('debounces typed search so a word is one request, not one per keystroke (JUM-781)', async () => {
    expect.assertions(2);
    const crud = useXCrud({ ...usersCrudConfig, debounceMs: 20 });
    await crud.load();
    const before = recorded.filter((c) => c.method === 'GET').length;
    crud.setSearch('o');
    crud.setSearch('ob');
    crud.setSearch('oba');
    // Poll for the debounced request instead of sleeping past the timer (Req 134 §2).
    await pollUntil(() => recorded.filter((c) => c.method === 'GET').length > before);
    expect(recorded.filter((c) => c.method === 'GET').length).toBe(before + 1);
    expect(lastListQuery().q).toBe('oba');
  });

  it('sends text filters as contains, date ranges as between, and drops undeclared fields', async () => {
    expect.assertions(4);
    const crud = useXCrud({ ...usersCrudConfig, debounceMs: 0 });
    await crud.load();
    crud.setFilter('firstName', 'zo');
    await flush();
    expect(lastListQuery().filter).toStrictEqual({ firstName: { operator: 'contains', value: 'zo' } });
    crud.setFilter('createdAt', ['2026-01-01', '2026-01-02']);
    await flush();
    expect((lastListQuery().filter as Record<string, unknown>).createdAt).toStrictEqual({
      operator: 'between', value: ['2026-01-01', '2026-01-02T23:59:59.999Z']
    });
    crud.setFilter('emails', 'x'); // not filterable per the OAS → never on the wire
    await flush();
    expect((lastListQuery().filter as Record<string, unknown>).emails).toBeUndefined();
    crud.setFilter('firstName', '');
    await flush();
    const remaining = lastListQuery().filter as Record<string, unknown> | undefined;
    expect(remaining?.firstName).toBeUndefined();
  });

  it('paginates through the server and resets the page on new filters', async () => {
    expect.assertions(5);
    const crud = useXCrud({ ...usersCrudConfig, pageSize: 2, debounceMs: 0 });
    await crud.load();
    expect(crud.visibleRows.value.map((r) => r.id)).toStrictEqual(['u1', 'u2']);
    expect(crud.pageCount.value).toBe(2);
    crud.nextPage();
    await flush();
    expect(lastListQuery().page).toBe('2');
    expect(crud.visibleRows.value.map((r) => r.id)).toStrictEqual(['u3']);
    crud.setFilter('firstName', 'a');
    expect(crud.page.value).toBe(1);
  });

  it('scroll mode appends pages instead of replacing them', async () => {
    expect.assertions(2);
    const crud = useXCrud({
      ...usersCrudConfig, pagination: 'scroll', pageSize: 2, debounceMs: 0
    });
    await crud.load();
    expect(crud.visibleRows.value).toHaveLength(2);
    crud.nextPage();
    await flush();
    expect(crud.visibleRows.value).toHaveLength(3);
  });

  it('steps back one page when the server answers 400 for a page past the last', async () => {
    expect.assertions(3);
    const crud = useXCrud({ ...usersCrudConfig, pageSize: 2, debounceMs: 0 });
    await crud.load();
    crud.nextPage();
    await flush();
    expect(crud.page.value).toBe(2);
    globalThis.fetch = mock((url: string, init: { method: string }) => {
      const params = new URL(String(url)).searchParams;
      const beyond = params.get('page') === '2';
      recorded.push({ url: String(url), method: init.method });
      return Promise.resolve({
        ok: !beyond,
        status: beyond ? 400 : 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(serverAnswer(String(url))),
        text: () => Promise.resolve('{"message":"page number must be smaller than the number of total pages"}')
      } as unknown as Response);
    });
    await crud.load();
    expect(crud.page.value).toBe(1);
    expect(crud.notice.value).toBe('That page no longer exists — showing the last one.');
  });

  it('computes aggregates: server total for count, page-scoped breakdown otherwise', async () => {
    expect.assertions(4);
    const crud = useXCrud({ ...usersCrudConfig, pageSize: 2, debounceMs: 0 });
    await crud.load();
    const [total, perOrg] = usersCrudConfig.aggregates!;
    expect(crud.aggregateValue(total)).toBe(3);
    expect(crud.aggregateIsPartial(total)).toBe(false);
    expect(crud.aggregateIsPartial(perOrg)).toBe(true);
    expect(crud.aggregateBreakdown(perOrg).map((b) => b.value)).toStrictEqual([2]);
  });

  it('create maps primaryEmail into emails[0] via beforeSubmit', async () => {
    expect.assertions(2);
    const crud = useXCrud({ ...usersCrudConfig, debounceMs: 0 });
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
    const crud = useXCrud({ ...usersCrudConfig, debounceMs: 0 });
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
    expect.assertions(5);
    const crud = useXCrud({ ...usersCrudConfig, debounceMs: 0 });
    await crud.load();
    crud.toggleSelect('u1');
    expect([...crud.selected.value]).toStrictEqual(['u1']);
    crud.toggleSelectAllVisible();
    expect(crud.selected.value.size).toBe(3);
    await crud.submitBulkDelete();
    const deletes = recorded.filter((call) => call.method === 'DELETE');
    expect(deletes).toHaveLength(3);
    expect(crud.selected.value.size).toBe(0);
    expect(crud.notice.value).toBe('User: 3 record(s) removed.');
  });

  it('column visibility toggles hide/show and pageSize is bounded by maxSize', async () => {
    expect.assertions(5);
    const crud = useXCrud({ ...usersCrudConfig, debounceMs: 0 });
    await crud.load();
    const total = crud.visibleColumns.value.length;
    crud.toggleColumn('username');
    expect(crud.visibleColumns.value.length).toBe(total - 1);
    crud.toggleColumn('username');
    expect(crud.visibleColumns.value.length).toBe(total);
    crud.setPageSize(50);
    expect(crud.pageSize.value).toBe(50);
    expect(crud.page.value).toBe(1);
    crud.setPageSize(500);
    expect(crud.pageSize.value).toBe(100);
  });

  it('resolves x-references labels, including arrays of ids, for grid and charts', async () => {
    expect.assertions(2);
    const crud = useXCrud({ ...usersCrudConfig, debounceMs: 0 });
    globalThis.fetch = mock((url: string, init: { method: string }) => {
      recorded.push({ url: String(url), method: init.method });
      const payload = String(url).includes('/organizations')
        ? {
          result: [{ id: 'org-1', name: 'ACME' }], page: 1, size: 100, total: 1
        }
        : serverAnswer(String(url));
      return Promise.resolve({
        ok: true, status: 200, headers: { get: () => 'application/json' }, json: () => Promise.resolve(payload), text: () => Promise.resolve('')
      } as unknown as Response);
    });
    await crud.loadReferences();
    expect(crud.referenceLabel('organization', 'org-1')).toBe('ACME');
    expect(crud.referenceLabel('organization', 'unknown')).toBe('unknown');
  });
});

/**
 * Drift guard (JUM-778): an operation without `x-list-capabilities` keeps the
 * in-memory path. The config below points the list at an operation the OAS
 * declares without capabilities; the whole array comes back and search,
 * sort and paging run locally.
 */
describe('useXCrud over an operation without x-list-capabilities', () => {
  const originalFetch = globalThis.fetch;
  const memoryConfig: XCrudEntityConfig = {
    ...usersCrudConfig,
    operations: { ...usersCrudConfig.operations, list: 'getOneById' }
  };

  beforeEach(() => {
    recorded.length = 0;
    setLocale('en');
    setActivePinia(createPinia());
    useAuthStore().token = 'Bearer session-token';
    globalThis.fetch = mock((url: string, init: { method: string }) => {
      recorded.push({ url: String(url), method: init.method });
      return Promise.resolve({
        ok: true, status: 200, headers: { get: () => 'application/json' }, json: () => Promise.resolve(fixtureRows), text: () => Promise.resolve('')
      } as unknown as Response);
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('loads everything once and sorts, searches, filters and pages in memory', async () => {
    expect.assertions(7);
    const crud = useXCrud({ ...memoryConfig, pageSize: 2 });
    expect(crud.serverMode).toBe(false);
    await crud.load();
    expect(recorded.filter((c) => c.method === 'GET')).toHaveLength(1);
    expect(recorded[0].url.includes('?')).toBe(false);
    crud.toggleSort('firstName');
    expect(crud.visibleRows.value.map((r) => r.firstName)).toStrictEqual(['Abraham', 'Mike']);
    crud.setSearch('mike@x.dev');
    expect(crud.filteredRows.value.map((r) => r.id)).toStrictEqual(['u3']);
    crud.setSearch('');
    crud.setFilter('roles', 'user');
    expect(crud.filteredRows.value.map((r) => r.id)).toStrictEqual(['u2', 'u3']);
    expect(recorded.filter((c) => c.method === 'GET')).toHaveLength(1);
  });
});

/** JUM-777/781 follow-ups: wire pass-through, paging controls, exports, aggregates. */
describe('useXCrud wire controls and actions', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    recorded.length = 0;
    setLocale('en');
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.token = 'Bearer session-token';
    auth.userId = 'u1';
    globalThis.fetch = mock((url: string, init: { method: string; body?: string }) => {
      recorded.push({
        url: String(url),
        method: init.method,
        body: init.body ? JSON.parse(init.body) : undefined
      });
      const payload = init.method === 'GET' ? serverAnswer(String(url)) : {};
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(payload),
        text: () => Promise.resolve('')
      } as unknown as Response);
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('passes enum/uuid filters through unchanged on the wire', async () => {
    expect.assertions(2);
    const crud = useXCrud({ ...usersCrudConfig, debounceMs: 0 });
    await crud.load();
    crud.setFilter('organization', 'org-9');
    await flush();
    expect(lastListQuery().filter).toStrictEqual({ organization: 'org-9' });
    crud.setFilter('organization', undefined);
    await flush();
    expect(lastListQuery().filter).toBeUndefined();
  });

  it('walks back and forth with prevPage and jumps with goToPage', async () => {
    expect.assertions(6);
    const crud = useXCrud({ ...usersCrudConfig, pageSize: 2, debounceMs: 0 });
    await crud.load();
    crud.nextPage();
    await flush();
    expect(crud.page.value).toBe(2);
    crud.prevPage();
    await flush();
    expect(crud.page.value).toBe(1);
    expect(lastListQuery().page).toBe('1');
    crud.prevPage();
    expect(crud.page.value).toBe(1);
    crud.goToPage(2);
    await flush();
    expect(crud.page.value).toBe(2);
    crud.goToPage(99);
    crud.goToPage(0);
    expect(crud.page.value).toBe(2);
  });

  it('deletes one row through submitDelete and reloads', async () => {
    expect.assertions(3);
    const crud = useXCrud({ ...usersCrudConfig, debounceMs: 0 });
    await crud.load();
    await crud.submitDelete('u1');
    const deletes = recorded.filter((call) => call.method === 'DELETE');
    expect(deletes).toHaveLength(1);
    expect(deletes[0].url).toContain('/users/u1');
    expect(crud.notice.value).toBe('User: record removed.');
  });

  it('surfaces a failed action as errorMessage instead of a notice', async () => {
    expect.assertions(2);
    globalThis.fetch = mock(() => Promise.resolve({
      ok: false,
      status: 400,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ message: 'username can not be empty' }),
      text: () => Promise.resolve('{"message":"username can not be empty"}')
    } as unknown as Response));
    const crud = useXCrud({ ...usersCrudConfig, pageSize: 2, debounceMs: 0 });
    await crud.load();
    await crud.submitCreate({ firstName: 'Bad' });
    expect(crud.errorMessage.value).toBe('username can not be empty');
    expect(crud.notice.value).toBe('');
  });

  it('surfaces a failed load as errorMessage', async () => {
    expect.assertions(2);
    const crud = useXCrud({ ...usersCrudConfig, debounceMs: 0 });
    globalThis.fetch = mock(() => Promise.resolve({
      ok: false,
      status: 500,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ message: '' }),
      text: () => Promise.resolve('{}')
    } as unknown as Response));
    await crud.load();
    expect(crud.errorMessage.value).toBe('Internal server error — try again shortly.');
    expect(crud.loading.value).toBe(false);
  });

  it('exports the current rows as a JSON download', async () => {
    expect.assertions(4);
    const crud = useXCrud({ ...usersCrudConfig, debounceMs: 0 });
    await crud.load();
    const blobs: Blob[] = [];
    const revoked: string[] = [];
    const clicked: string[] = [];
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const anchorPrototype = Object.getPrototypeOf(document.createElement('a')) as HTMLAnchorElement;
    const originalClick = anchorPrototype.click;
    URL.createObjectURL = ((blob: Blob) => {
      blobs.push(blob);
      return 'blob:xcrud-export';
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = ((url: string) => {
      revoked.push(url);
    }) as typeof URL.revokeObjectURL;
    anchorPrototype.click = function click(this: HTMLAnchorElement): void {
      clicked.push(this.download);
    };
    try {
      crud.exportJson();
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
      anchorPrototype.click = originalClick;
    }
    expect(blobs).toHaveLength(1);
    expect(await blobs[0].text()).toContain('zoe@x.dev');
    expect(clicked).toStrictEqual(['user.json']);
    expect(revoked).toStrictEqual(['blob:xcrud-export']);
  });

  it('computes avg/min/max aggregates over the loaded rows', async () => {
    expect.assertions(4);
    const crud = useXCrud({ ...usersCrudConfig, debounceMs: 0 });
    await crud.load();
    const ages = { field: 'emails', op: 'avg' } as const;
    expect(crud.aggregateValue({ field: 'emails', op: 'sum' })).toBe(3);
    expect(crud.aggregateValue(ages)).toBe(1);
    expect(crud.aggregateValue({ field: 'emails', op: 'min' })).toBe(0);
    expect(crud.aggregateValue({ field: 'emails', op: 'max' })).toBe(2);
  });

  it('marks the aggregate scope as page in server mode without Cana', async () => {
    expect.assertions(2);
    const crud = useXCrud({ ...usersCrudConfig, pageSize: 2, debounceMs: 0 });
    await crud.load();
    expect(crud.aggregateScope.value).toBe('page');
    expect(crud.aggregateIsPartial({ field: 'emails', op: 'sum' })).toBe(true);
  });

  it('falls back to empty reference labels when the target list fails', async () => {
    expect.assertions(2);
    globalThis.fetch = mock((url: string, init: { method: string }) => {
      recorded.push({ url: String(url), method: init.method });
      const organizations = String(url).includes('/organizations');
      return Promise.resolve({
        ok: !organizations,
        status: organizations ? 500 : 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(organizations ? {} : serverAnswer(String(url))),
        text: () => Promise.resolve('')
      } as unknown as Response);
    });
    const crud = useXCrud({ ...usersCrudConfig, debounceMs: 0 });
    await crud.loadReferences();
    expect({ ...crud.referenceLabels.organization }).toStrictEqual({});
    expect(crud.referenceLabel('organization', 'org-1')).toBe('org-1');
  });
});

/** JUM-772 memory mode: in-memory date ranges, booleans and text contains. */
describe('useXCrud memory-mode filter operators', () => {
  const originalFetch = globalThis.fetch;
  const memoryConfig: XCrudEntityConfig = {
    ...usersCrudConfig,
    operations: { ...usersCrudConfig.operations, list: 'getOneById' }
  };

  beforeEach(() => {
    recorded.length = 0;
    setLocale('en');
    setActivePinia(createPinia());
    useAuthStore().token = 'Bearer session-token';
    globalThis.fetch = mock((url: string, init: { method: string }) => {
      recorded.push({ url: String(url), method: init.method });
      return Promise.resolve({
        ok: true, status: 200, headers: { get: () => 'application/json' }, json: () => Promise.resolve(fixtureRows), text: () => Promise.resolve('')
      } as unknown as Response);
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('filters date ranges inclusively and drops rows with unparsable dates', async () => {
    expect.assertions(4);
    const crud = useXCrud({ ...memoryConfig });
    await crud.load();
    crud.setFilter('createdAt', ['2026-01-01', '2026-01-02']);
    expect(crud.filteredRows.value.map((r) => r.id)).toStrictEqual(['u1', 'u2']);
    crud.setFilter('createdAt', ['2026-01-02', undefined]);
    expect(crud.filteredRows.value.map((r) => r.id)).toStrictEqual(['u1', 'u3']);
    crud.setFilter('createdAt', [undefined, '2026-01-01']);
    expect(crud.filteredRows.value.map((r) => r.id)).toStrictEqual(['u2']);
    crud.rows.value = [...crud.rows.value, {
      id: 'u9', firstName: 'Nodate', username: 'nodate@x.dev', roles: ['user'], emails: [], createdAt: 'not-a-date'
    }];
    crud.setFilter('createdAt', ['2020-01-01', '2030-01-01']);
    expect(crud.filteredRows.value.map((r) => r.id)).toStrictEqual(['u1', 'u2', 'u3']);
  });

  it('matches scalar text filters with case-insensitive contains', async () => {
    expect.assertions(2);
    const crud = useXCrud({ ...memoryConfig });
    await crud.load();
    crud.setFilter('username', 'ZOE@X');
    expect(crud.filteredRows.value.map((r) => r.id)).toStrictEqual(['u1']);
    crud.setFilter('username', 'missing');
    expect(crud.filteredRows.value).toStrictEqual([]);
  });

  it('matches boolean filters with tri-state semantics', async () => {
    expect.assertions(2);
    const crud = useXCrud({ ...memoryConfig });
    await crud.load();
    crud.rows.value = crud.rows.value.map((row, index) => ({ ...row, active: index === 0 }));
    crud.setFilter('active', true);
    expect(crud.filteredRows.value.map((r) => r.id)).toStrictEqual(['u1']);
    crud.setFilter('active', false);
    expect(crud.filteredRows.value.map((r) => r.id)).toStrictEqual(['u2', 'u3']);
  });
});
