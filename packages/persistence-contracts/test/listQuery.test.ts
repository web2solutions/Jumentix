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

describe('the remaining filter operators', () => {
  it('ne is the exact negation of eq, including the array-membership form', () => {
    expect.hasAssertions();
    expect(applyListFilters(rows, { id: { operator: 'ne', value: '2' } }).map((r) => r.id))
      .toStrictEqual(['1', '3', '4']);
    expect(applyListFilters(rows, { roles: { operator: 'ne', value: 'admin' } }).map((r) => r.id))
      .toStrictEqual(['2', '4']);
  });

  it('gt compares strictly and never matches a null actual', () => {
    expect.hasAssertions();
    expect(applyListFilters(rows, { age: { operator: 'gt', value: 31 } }).map((r) => r.id))
      .toStrictEqual(['4']);
    // age is null for row 2: a null is not greater than anything.
    expect(applyListFilters(rows, { age: { operator: 'gt', value: -1 } }).map((r) => r.id))
      .toStrictEqual(['1', '3', '4']);
  });

  it('nin is the exact negation of in, and in accepts a scalar candidate', () => {
    expect.hasAssertions();
    expect(applyListFilters(rows, { id: { operator: 'nin', value: ['1', '4'] } }).map((r) => r.id))
      .toStrictEqual(['2', '3']);
    expect(applyListFilters(rows, { id: { operator: 'in', value: '3' as never } }).map((r) => r.id))
      .toStrictEqual(['3']);
  });

  it('like is case-sensitive where ilike and contains are not', () => {
    expect.hasAssertions();
    expect(applyListFilters(rows, { name: { operator: 'like', value: 'LIMA' } })).toStrictEqual([]);
    expect(applyListFilters(rows, { name: { operator: 'like', value: 'Lima' } }).map((r) => r.id))
      .toStrictEqual(['1']);
    expect(applyListFilters(rows, { name: { operator: 'ilike', value: 'COSTA' } }).map((r) => r.id))
      .toStrictEqual(['2']);
    // A nullish needle is the empty string, which everything contains.
    expect(applyListFilters(rows, { name: { operator: 'like', value: null as never } }))
      .toHaveLength(4);
    expect(applyListFilters(rows, { name: { operator: 'ilike', value: null as never } }))
      .toHaveLength(4);
  });

  it('regex tests the text form of the value', () => {
    expect.hasAssertions();
    expect(applyListFilters(rows, { name: { operator: 'regex', value: '^bruno' } }).map((r) => r.id))
      .toStrictEqual(['2']);
    expect(applyListFilters(rows, { id: { operator: 'regex', value: '^[24]$' } }).map((r) => r.id))
      .toStrictEqual(['2', '4']);
  });

  it('exists compares presence with the boolean of the expectation', () => {
    expect.hasAssertions();
    expect(applyListFilters(rows, { age: { operator: 'exists', value: false } }).map((r) => r.id))
      .toStrictEqual(['2']);
    expect(applyListFilters(rows, { age: { operator: 'exists', value: true } }).map((r) => r.id))
      .toStrictEqual(['1', '3', '4']);
    expect(applyListFilters(rows, { missing: { operator: 'exists', value: false } }))
      .toHaveLength(4);
  });

  it('overlaps intersects array fields with array or scalar expectations', () => {
    expect.hasAssertions();
    expect(applyListFilters(rows, { roles: { operator: 'overlaps', value: ['admin', 'auditor'] } })
      .map((r) => r.id)).toStrictEqual(['1', '3']);
    expect(applyListFilters(rows, { roles: { operator: 'overlaps', value: 'user' } }).map((r) => r.id))
      .toStrictEqual(['2', '3']);
    // A scalar field has no overlap to give.
    expect(applyListFilters(rows, { name: { operator: 'overlaps', value: ['Ana Lima'] } }))
      .toStrictEqual([]);
  });

  it('between accepts a scalar as both bounds and refuses a null actual', () => {
    expect.hasAssertions();
    expect(applyListFilters(rows, { age: { operator: 'between', value: 31 } }).map((r) => r.id))
      .toStrictEqual(['1']);
    expect(applyListFilters(rows, { age: { operator: 'between', value: [null, 100] } })
      .map((r) => r.id)).toStrictEqual(['1', '3', '4']);
    expect(applyListFilters(rows, { age: { operator: 'between', value: [1, null] } })
      .map((r) => r.id)).toStrictEqual(['1', '3', '4']);
  });

  it('skips filter entries whose value is undefined', () => {
    expect.hasAssertions();
    expect(applyListFilters(rows, { id: undefined as never })).toStrictEqual(rows);
  });

  it('compares nulls against nulls and against values under the order operators', () => {
    expect.hasAssertions();
    // compare(null, null) is a tie; compare(31, null) puts the null last —
    // either way the null actual/expectation never satisfies gt.
    expect(applyListFilters(rows, { age: { operator: 'gt', value: null } })).toStrictEqual([]);
    expect(applyListFilters(rows, { age: { operator: 'lte', value: null } }).map((r) => r.id))
      .toStrictEqual(['1', '3', '4']);
  });

  it('eq falls back to the empty string for nullish actual and expectation', () => {
    expect.hasAssertions();
    // A missing field equals a null expectation (both read as ''), and only that.
    expect(applyListFilters(rows, { missing: { operator: 'eq', value: null } })).toHaveLength(4);
    expect(applyListFilters(rows, { id: { operator: 'eq', value: null } })).toStrictEqual([]);
  });
});

describe('the comparison primitives', () => {
  it('compares dates as instants and nulls against either side', () => {
    expect.hasAssertions();
    const dated = [
      { id: 'a', at: new Date('2026-01-02T00:00:00.000Z') },
      { id: 'b', at: new Date('2026-01-01T00:00:00.000Z') }
    ];
    expect(applyListSort(dated, [{ field: 'at', direction: 'asc' }]).map((r) => r.id))
      .toStrictEqual(['b', 'a']);

    // Null on the left sinks, null on the right floats: nulls last either way.
    const withNulls = [
      { id: 'a', at: null }, { id: 'b', at: '2026-01-01' }, { id: 'c', at: null }
    ];
    expect(applyListSort(withNulls, [{ field: 'at', direction: 'asc' }]).map((r) => r.id))
      .toStrictEqual(['b', 'a', 'c']);
  });

  it('falls through to the next sort key and returns 0 for a full tie', () => {
    expect.hasAssertions();
    const tied = [
      { id: 'a', group: 'x', rank: 2 },
      { id: 'b', group: 'x', rank: 1 },
      { id: 'c', group: 'x', rank: 2 }
    ];
    expect(applyListSort(tied, [
      { field: 'group', direction: 'asc' },
      { field: 'rank', direction: 'asc' }
    ]).map((r) => r.id)).toStrictEqual(['b', 'a', 'c']);
    // Stability: a full tie keeps the input order.
    expect(applyListSort(tied, [{ field: 'group', direction: 'asc' }]).map((r) => r.id))
      .toStrictEqual(['a', 'b', 'c']);
  });

  it('searches array and object fields by their text form', () => {
    expect.hasAssertions();
    const records = [
      { id: 'a', tags: ['red', 'blue'], meta: { code: 'x1' } },
      { id: 'b', tags: [], meta: null }
    ];
    expect(applyListSearch(records, 'blue', ['tags']).map((r) => r.id)).toStrictEqual(['a']);
    expect(applyListSearch(records, '"code":"x1"', ['meta']).map((r) => r.id)).toStrictEqual(['a']);
    // A null field carries no text; and an undefined term is no search at all.
    expect(applyListSearch(records, 'x1', ['meta']).map((r) => r.id)).toStrictEqual(['a']);
    expect(applyListSearch(records, undefined, ['tags'])).toBe(records);
  });
});

describe('paginateList aliases', () => {
  it('reads currentPage/perPage when page/size are absent, and defaults to 1/10', () => {
    expect.hasAssertions();
    expect(paginateList(rows, { currentPage: 2, perPage: 2 })).toStrictEqual({
      result: [rows[2], rows[3]], total: 4, page: 2, size: 2
    });
    const eleven = Array.from({ length: 11 }, (_, index) => ({ id: String(index) }));
    expect(paginateList(eleven, {})).toStrictEqual({
      result: eleven.slice(0, 10), total: 11, page: 1, size: 10
    });
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

  it('excludes tombstones unless includeDeleted is set', () => {
    expect.hasAssertions();
    const withTomb = [...rows, {
      id: '5', name: 'gone', age: 1, roles: [], createdAt: '2026-01-01T00:00:00.000Z', deletedAt: '2026-04-01T00:00:00.000Z'
    }];
    expect(runListQuery(withTomb, {}, { page: 1, size: 10 }).total).toBe(4);
    expect(runListQuery(withTomb, {}, { page: 1, size: 10, includeDeleted: true }).total).toBe(5);
  });

  it('breaks equal sort keys with the primary key', () => {
    expect.hasAssertions();
    const tied = [
      {
        id: 'b', name: 'x', age: 1, roles: [], createdAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'a', name: 'x', age: 1, roles: [], createdAt: '2026-01-01T00:00:00.000Z'
      }
    ];
    expect(applyListSort(tied, [{ field: 'createdAt', direction: 'asc' }]).map((r) => r.id))
      .toStrictEqual(['a', 'b']);
  });
});

describe('primary key fallback for id-less records', () => {
  it('sorts ascending by _id when a record has no id field', () => {
    expect.hasAssertions();
    const mixedKeys = [
      { _id: 'b', name: 'second' },
      { id: 'a', name: 'first' },
      { _id: '0', name: 'zero' }
    ];
    const sorted = applyListSort(mixedKeys, [{ field: 'id', direction: 'asc' }]);
    expect(sorted.map((record) => record.name)).toStrictEqual(['zero', 'first', 'second']);
  });

  it('sorts descending by _id when a record has no id field', () => {
    expect.hasAssertions();
    const mixedKeys = [
      { _id: 'b', name: 'second' },
      { id: 'a', name: 'first' },
      { _id: '0', name: 'zero' }
    ];
    const sorted = applyListSort(mixedKeys, [{ field: 'id', direction: 'desc' }]);
    expect(sorted.map((record) => record.name)).toStrictEqual(['second', 'first', 'zero']);
  });
});
