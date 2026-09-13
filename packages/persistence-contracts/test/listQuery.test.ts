import {
  DatabasePagingError,
  applyListFilters,
  applyListSearch,
  applyListSort,
  matchesListFilters,
  paginateList,
  parseListSort,
  runListQuery
} from '../src';

/**
 * JUM-777 — the REST list contract (`filter`, `q`, `sort`, `page`, `size`) has
 * one implementation for every store. These tests pin the observable rules the
 * OpenAPI document promises: equality and operator filters, case-insensitive
 * search over declared fields, stable typed sort with nulls last, and paging
 * that refuses pages which cannot exist.
 */

interface Row extends Record<string, unknown> {
  id: string;
  name: string;
  age: number | null;
  roles: string[];
  createdAt: string;
}

const rows: Row[] = [
  {
    id: '1', name: 'Ana Lima', age: 31, roles: ['admin'], createdAt: '2026-01-05T10:00:00.000Z'
  },
  {
    id: '2', name: 'bruno costa', age: null, roles: ['user'], createdAt: '2026-03-01T10:00:00.000Z'
  },
  {
    id: '3', name: 'Carla Souza', age: 28, roles: ['admin', 'user'], createdAt: '2025-12-31T23:59:59.000Z'
  },
  {
    id: '4', name: 'Dario Alves', age: 45, roles: [], createdAt: '2026-02-10T08:00:00.000Z'
  }
];

describe('matchesListFilters / applyListFilters', () => {
  it('treats a scalar as equality and an array as membership', () => {
    expect.hasAssertions();
    expect(applyListFilters(rows, { id: '2' }).map((r) => r.id)).toStrictEqual(['2']);
    expect(applyListFilters(rows, { id: ['1', '4'] }).map((r) => r.id)).toStrictEqual(['1', '4']);
  });

  it('matches equality inside array fields (roles=admin)', () => {
    expect.hasAssertions();
    expect(applyListFilters(rows, { roles: 'admin' }).map((r) => r.id)).toStrictEqual(['1', '3']);
  });

  it('applies contains case-insensitively and between over ISO dates', () => {
    expect.hasAssertions();
    expect(applyListFilters(rows, { name: { operator: 'contains', value: 'LIMA' } }).map((r) => r.id))
      .toStrictEqual(['1']);
    expect(applyListFilters(rows, {
      createdAt: { operator: 'between', value: ['2026-01-01', '2026-02-28'] }
    }).map((r) => r.id)).toStrictEqual(['1', '4']);
    expect(applyListFilters(rows, {
      createdAt: { operator: 'between', value: ['', '2026-01-01'] }
    }).map((r) => r.id)).toStrictEqual(['3']);
  });

  it('compares numbers numerically for gt/gte/lt/lte and never matches null', () => {
    expect.hasAssertions();
    expect(applyListFilters(rows, { age: { operator: 'gte', value: 31 } }).map((r) => r.id))
      .toStrictEqual(['1', '4']);
    expect(applyListFilters(rows, { age: { operator: 'lt', value: '30' } }).map((r) => r.id))
      .toStrictEqual(['3']);
  });

  it('ands fields together and returns the input untouched for empty filters', () => {
    expect.hasAssertions();
    expect(applyListFilters(rows, { roles: 'admin', age: { operator: 'lte', value: 30 } })
      .map((r) => r.id)).toStrictEqual(['3']);
    expect(applyListFilters(rows, {})).toBe(rows);
    expect(matchesListFilters(rows[0], undefined)).toBe(true);
  });

  it('rejects unknown operators instead of matching everything', () => {
    expect.hasAssertions();
    expect(applyListFilters(rows, { name: { operator: 'nope' as never, value: 'x' } })).toStrictEqual([]);
  });
});

describe('applyListSearch', () => {
  it('is case-insensitive and ORs across the declared fields', () => {
    expect.hasAssertions();
    expect(applyListSearch(rows, 'COSTA', ['name']).map((r) => r.id)).toStrictEqual(['2']);
    expect(applyListSearch(rows, 'admin', ['name', 'roles']).map((r) => r.id)).toStrictEqual(['1', '3']);
  });

  it('does nothing without a term or without fields', () => {
    expect.hasAssertions();
    expect(applyListSearch(rows, '   ', ['name'])).toBe(rows);
    expect(applyListSearch(rows, 'ana', [])).toBe(rows);
  });
});

describe('applyListSort', () => {
  it('sorts text case-insensitively, dates as instants and puts nulls last', () => {
    expect.hasAssertions();
    expect(applyListSort(rows, [{ field: 'name', direction: 'asc' }]).map((r) => r.id))
      .toStrictEqual(['1', '2', '3', '4']);
    expect(applyListSort(rows, [{ field: 'createdAt', direction: 'desc' }]).map((r) => r.id))
      .toStrictEqual(['2', '4', '1', '3']);
    expect(applyListSort(rows, [{ field: 'age', direction: 'asc' }]).map((r) => r.id))
      .toStrictEqual(['3', '1', '4', '2']);
    expect(applyListSort(rows, [{ field: 'age', direction: 'desc' }]).map((r) => r.id))
      .toStrictEqual(['4', '1', '3', '2']);
  });

  it('is stable and does not mutate the input', () => {
    expect.hasAssertions();
    const copy = [...rows];
    const sorted = applyListSort(rows, [{ field: 'roles', direction: 'asc' }]);
    expect(rows).toStrictEqual(copy);
    expect(sorted).not.toBe(rows);
    expect(applyListSort(rows, [])).toBe(rows);
  });
});

describe('paginateList', () => {
  it('slices the page and reports the total across pages', () => {
    expect.hasAssertions();
    expect(paginateList(rows, { page: 2, size: 3 })).toStrictEqual({
      result: [rows[3]], total: 4, page: 2, size: 3
    });
    expect(paginateList([], { page: 1, size: 10 })).toStrictEqual({
      result: [], total: 0, page: 1, size: 10
    });
  });

  it('refuses page 0, size 0 and pages past the last one', () => {
    expect.hasAssertions();
    expect(() => paginateList(rows, { page: 0, size: 2 })).toThrow(DatabasePagingError);
    expect(() => paginateList(rows, { page: 1, size: 0 })).toThrow(DatabasePagingError);
    expect(() => paginateList(rows, { page: 3, size: 2 })).toThrow(
      'page number must be smaller than the number of total pages'
    );
  });
});

describe('parseListSort and runListQuery', () => {
  it('parses the wire form with asc as the default direction', () => {
    expect.hasAssertions();
    expect(parseListSort('name:desc, age ,createdAt:ASC')).toStrictEqual([
      { field: 'name', direction: 'desc' },
      { field: 'age', direction: 'asc' },
      { field: 'createdAt', direction: 'asc' }
    ]);
    expect(parseListSort('')).toBeUndefined();
    expect(parseListSort(undefined)).toBeUndefined();
  });

  it('runs filters, search, sort and paging in that order', () => {
    expect.hasAssertions();
    const page = runListQuery(rows, { roles: 'admin' }, {
      page: 1, size: 1, q: 'a', searchFields: ['name'], sort: [{ field: 'name', direction: 'desc' }]
    });
    expect(page).toStrictEqual({
      result: [rows[2]], total: 2, page: 1, size: 1
    });
  });
});
