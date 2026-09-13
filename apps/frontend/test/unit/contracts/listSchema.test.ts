import { describe, expect, it } from 'bun:test';

import {
  asListPage, listCapabilities, toQueryParams
} from '@/contracts/listSchema';

/**
 * JUM-778 — the frontend reads `x-list-capabilities` from the bundled OAS and
 * speaks the JUM-777 wire form. Drift test: the capabilities below are read
 * from `openapi.json`, so a spec change is reflected with no code change.
 */
describe('listCapabilities', () => {
  it('reads sortable/filterable/searchable and sizes for getAll and getAllOrganizations', () => {
    expect.hasAssertions();
    const users = listCapabilities('getAll')!;
    expect(users.sortable).toContain('firstName');
    expect(users.filterable.roles).toBe('enum');
    expect(users.filterable.createdAt).toBe('date');
    expect(users.searchable).toStrictEqual(['firstName', 'lastName', 'username']);
    expect(users.defaultSize).toBe(30);
    expect(users.maxSize).toBe(100);
    expect(listCapabilities('getAllOrganizations')?.searchable).toStrictEqual(['name']);
  });

  it('is undefined for operations that declare no capabilities (memory mode)', () => {
    expect.hasAssertions();
    expect(listCapabilities('getOneById')).toBeUndefined();
    expect(listCapabilities('nope')).toBeUndefined();
  });
});

describe('toQueryParams / asListPage', () => {
  it('encodes the filter as base64 JSON and omits empty parts', () => {
    expect.hasAssertions();
    const params = toQueryParams({
      page: 2, size: 10, sort: 'name:desc', q: '', filter: { name: { operator: 'contains', value: 'ac' } }
    });
    expect(params.page).toBe(2);
    expect(params.size).toBe(10);
    expect(params.sort).toBe('name:desc');
    expect(params.q).toBeUndefined();
    expect(JSON.parse(atob(String(params.filter)))).toStrictEqual({ name: { operator: 'contains', value: 'ac' } });
    expect(toQueryParams({ filter: {} }).filter).toBeUndefined();
  });

  it('normalizes envelopes and bare arrays to one page shape', () => {
    expect.hasAssertions();
    expect(asListPage({
      result: [{ id: 1 }], page: 3, size: 1, total: 9
    }, { page: 1, size: 30 }))
      .toStrictEqual({
        result: [{ id: 1 }], page: 3, size: 1, total: 9
      });
    expect(asListPage([{ id: 1 }, { id: 2 }], { page: 1, size: 30 }))
      .toStrictEqual({
        result: [{ id: 1 }, { id: 2 }], page: 1, size: 2, total: 2
      });
    expect(asListPage(undefined, { page: 1, size: 30 })).toStrictEqual({
      result: [], page: 1, size: 30, total: 0
    });
  });
});
