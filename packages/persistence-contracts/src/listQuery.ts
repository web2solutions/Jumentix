import type {
  IPagingRequest,
  IPagingResponse,
  IStoreFilterExpression,
  TFilterOperator
} from './IStore';
import { DatabasePagingError } from './errors';

/**
 * List query helpers shared by every `IStore.getAll` implementation (JUM-777).
 *
 * The REST list contract (`page`, `size`, `filter`, `sort`, `q`) used to stop
 * at the controller: stores received a flat `Record<string, string | number>`
 * and compared it with `===`, and neither sorting nor free-text search existed
 * anywhere, so every consumer sorted and searched in memory over the whole
 * collection. These helpers give the in-memory store and the external-store
 * proxy one implementation of the contract, so a driver cannot drift from
 * what the OpenAPI document promises.
 *
 * Drivers that can push the work to the database (SQL `WHERE`/`ORDER BY`,
 * Mongo `find().sort()`) may do so and still call `paginate` on the result;
 * the observable behaviour must equal these functions, which is what the
 * store contract tests assert.
 */

export type TListFilterScalar = string | number | boolean | null;

/** A filter value as it arrives from the wire: a scalar (equality) or an expression. */
export type TListFilterValue = TListFilterScalar | TListFilterScalar[] | IStoreFilterExpression;

export type TListFilters = Record<string, TListFilterValue>;

export interface IListSort {
  field: string;
  direction: 'asc' | 'desc';
}

const isExpression = (value: unknown): value is IStoreFilterExpression => (
  typeof value === 'object' && value !== null && !Array.isArray(value) && 'operator' in value
);

const comparable = (value: unknown): number | string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'boolean') return Number(value);
  if (value instanceof Date) return value.getTime();
  const text = String(value);
  // ISO-8601 timestamps compare as instants so date-range filters and sorts
  // do not depend on lexical ordering of the string.
  if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(text)) {
    const time = Date.parse(text);
    if (!Number.isNaN(time)) return time;
  }
  const number = Number(text);
  if (text.trim() !== '' && !Number.isNaN(number)) return number;
  return text;
};

const compare = (a: unknown, b: unknown): number => {
  const left = comparable(a);
  const right = comparable(b);
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right), undefined, { sensitivity: 'base' });
};

const textOf = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(textOf).join(' ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const matchesOperator = (
  actual: unknown,
  operator: TFilterOperator,
  expected: unknown
): boolean => {
  switch (operator) {
    case 'eq':
      return Array.isArray(actual)
        ? actual.some((entry) => String(entry) === String(expected))
        : String(actual ?? '') === String(expected ?? '') || actual === expected;
    case 'ne':
      return !matchesOperator(actual, 'eq', expected);
    case 'gt':
      return compare(actual, expected) > 0 && actual !== null && actual !== undefined;
    case 'gte':
      return compare(actual, expected) >= 0 && actual !== null && actual !== undefined;
    case 'lt':
      return compare(actual, expected) < 0 && actual !== null && actual !== undefined;
    case 'lte':
      return compare(actual, expected) <= 0 && actual !== null && actual !== undefined;
    case 'in':
      return (Array.isArray(expected) ? expected : [expected])
        .some((candidate) => matchesOperator(actual, 'eq', candidate));
    case 'nin':
      return !matchesOperator(actual, 'in', expected);
    case 'like':
      return textOf(actual).includes(String(expected ?? ''));
    case 'ilike':
    case 'contains':
      return textOf(actual).toLowerCase().includes(String(expected ?? '').toLowerCase());
    case 'regex':
      return new RegExp(String(expected)).test(textOf(actual));
    case 'exists':
      return (actual !== undefined && actual !== null) === Boolean(expected);
    case 'overlaps':
      return Array.isArray(actual) && (Array.isArray(expected) ? expected : [expected])
        .some((candidate) => actual.some((entry) => String(entry) === String(candidate)));
    case 'between': {
      const [from, to] = Array.isArray(expected) ? expected : [expected, expected];
      if (actual === null || actual === undefined) return false;
      const fromOk = from === null || from === undefined || from === '' || compare(actual, from) >= 0;
      const toOk = to === null || to === undefined || to === '' || compare(actual, to) <= 0;
      return fromOk && toOk;
    }
    default:
      return false;
  }
};

/** True when the record satisfies every filter (AND semantics, per field). */
export const matchesListFilters = (
  record: Record<string, unknown>,
  filters: TListFilters | Record<string, string | number> | undefined
): boolean => Object.entries(filters ?? {}).every(([field, value]) => {
  if (value === undefined) return true;
  const actual = record[field];
  if (isExpression(value)) {
    return matchesOperator(actual, value.operator, value.value);
  }
  if (Array.isArray(value)) {
    return matchesOperator(actual, 'in', value);
  }
  return matchesOperator(actual, 'eq', value);
});

export const applyListFilters = <T extends Record<string, unknown>>(
  records: T[],
  filters: TListFilters | Record<string, string | number> | undefined
): T[] => {
  if (!filters || Object.keys(filters).length === 0) return records;
  return records.filter((record) => matchesListFilters(record, filters));
};

/** Case-insensitive substring search over the declared fields (OR across fields). */
export const applyListSearch = <T extends Record<string, unknown>>(
  records: T[],
  q: string | undefined,
  fields: string[] | undefined
): T[] => {
  const needle = (q ?? '').trim().toLowerCase();
  if (!needle || !fields || fields.length === 0) return records;
  return records.filter((record) => fields.some(
    (field) => textOf(record[field]).toLowerCase().includes(needle)
  ));
};

/** Stable multi-field sort; nulls last regardless of direction. */
export const applyListSort = <T extends Record<string, unknown>>(
  records: T[],
  sort: IListSort[] | undefined
): T[] => {
  if (!sort || sort.length === 0) return records;
  return [...records].sort((a, b) => {
    for (const { field, direction } of sort) {
      const aNull = a[field] === null || a[field] === undefined;
      const bNull = b[field] === null || b[field] === undefined;
      if (!(aNull && bNull)) {
        if (aNull) return 1;
        if (bNull) return -1;
        const result = compare(a[field], b[field]);
        if (result !== 0) return direction === 'desc' ? -result : result;
      }
    }
    return 0;
  });
};

/**
 * Slices one page out of an already filtered/sorted collection.
 *
 * Page zero and a page past the last one are malformed requests, not empty
 * results: a client paging with a stale total would otherwise render an empty
 * grid and report it as "no records".
 */
export const paginateList = <T>(
  records: T[],
  paging: IPagingRequest
): IPagingResponse<T[]> => {
  const page = paging.page ?? paging.currentPage ?? 1;
  const size = paging.size ?? paging.perPage ?? 10;
  if (!Number.isInteger(page) || page < 1) {
    throw new DatabasePagingError('page must be greater than 0');
  }
  if (!Number.isInteger(size) || size < 1) {
    throw new DatabasePagingError('size must be greater than 0');
  }
  const total = records.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  if (page > totalPages && total > 0) {
    throw new DatabasePagingError('page number must be smaller than the number of total pages');
  }
  const startAt = (page * size) - size;
  return {
    result: records.slice(startAt, startAt + size),
    total,
    page,
    size
  };
};

/**
 * The whole list contract in one call: filters → search → sort → page.
 * `IPagingRequest.sort`, `q` and `searchFields` are read from the paging
 * request so `IStore.getAll(filters, paging)` keeps its two-argument shape.
 */
export const runListQuery = <T extends Record<string, unknown>>(
  records: T[],
  filters: TListFilters | Record<string, string | number> | undefined,
  paging: IPagingRequest
): IPagingResponse<T[]> => {
  const filtered = applyListFilters(records, filters);
  const searched = applyListSearch(filtered, paging.q, paging.searchFields);
  const sorted = applyListSort(searched, paging.sort);
  return paginateList(sorted, paging);
};

/**
 * Parses the wire form of `sort` (`field:asc,other:desc`; direction defaults
 * to `asc`). Returns `undefined` for an empty value so callers can pass the
 * query string through untouched.
 */
export const parseListSort = (raw: string | undefined | null): IListSort[] | undefined => {
  const text = (raw ?? '').trim();
  if (!text) return undefined;
  return text.split(',').map((part): IListSort => {
    const [field, direction] = part.trim().split(':');
    return {
      field: field.trim(),
      direction: direction?.trim().toLowerCase() === 'desc' ? 'desc' : 'asc'
    };
  }).filter((entry) => entry.field.length > 0);
};
