import openApi from './openapi.json';

/**
 * List capabilities from the contract (JUM-778). A list operation may carry
 * `x-list-capabilities`; when it does, X-CRUD asks the server for pages and
 * renders sort/filter/search affordances only for the fields declared there.
 * When it does not, the kit keeps the in-memory path over the whole result
 * — the choice comes from the contract, never from component config.
 */
export type ListFilterKind = 'text' | 'enum' | 'boolean' | 'date' | 'uuid' | 'number';

export interface ListCapabilities {
  sortable: string[];
  filterable: Record<string, ListFilterKind>;
  searchable: string[];
  defaultSize: number;
  maxSize: number;
}

interface RawOperation {
  operationId?: string;
  'x-list-capabilities'?: Partial<ListCapabilities>;
}

const document = openApi as { paths?: Record<string, Record<string, RawOperation>> };

const operations = (): Record<string, RawOperation> => {
  const map: Record<string, RawOperation> = {};
  for (const pathItem of Object.values(document.paths ?? {})) {
    for (const operation of Object.values(pathItem)) {
      if (operation && typeof operation === 'object' && operation.operationId) {
        map[operation.operationId] = operation;
      }
    }
  }
  return map;
};

const byOperation = operations();

export const listCapabilities = (operationId: string): ListCapabilities | undefined => {
  const raw = byOperation[operationId]?.['x-list-capabilities'];
  if (!raw) return undefined;
  return {
    sortable: raw.sortable ?? [],
    filterable: raw.filterable ?? {},
    searchable: raw.searchable ?? [],
    defaultSize: raw.defaultSize ?? 30,
    maxSize: raw.maxSize ?? 100
  };
};

/** One page of a server-side list, as the OAS `*ArrayOf` envelope declares it. */
export interface ListPage<T> {
  result: T[];
  page: number;
  size: number;
  total: number;
}

/** Wire form of the list query the SDK sends (`filter` is base64 JSON). */
export interface ListQuery {
  page?: number;
  size?: number;
  sort?: string;
  q?: string;
  filter?: Record<string, unknown>;
}

const toBase64 = (value: string): string => {
  if (typeof btoa === 'function') {
    return btoa(unescape(encodeURIComponent(value)));
  }
  return Buffer.from(value, 'utf8').toString('base64');
};

export const toQueryParams = (query: ListQuery): Record<string, string | number> => {
  const params: Record<string, string | number> = {};
  if (query.page !== undefined) params.page = query.page;
  if (query.size !== undefined) params.size = query.size;
  if (query.sort) params.sort = query.sort;
  if (query.q) params.q = query.q;
  if (query.filter && Object.keys(query.filter).length > 0) {
    params.filter = toBase64(JSON.stringify(query.filter));
  }
  return params;
};

/**
 * Normalizes what the server returned: the envelope when the contract
 * declares one, or a bare array from an operation that predates JUM-777.
 */
export const asListPage = <T>(
  response: unknown,
  fallback: { page: number; size: number }
): ListPage<T> => {
  if (Array.isArray(response)) {
    return {
      result: response as T[],
      page: 1,
      size: response.length || fallback.size,
      total: response.length
    };
  }
  const envelope = (response ?? {}) as Partial<ListPage<T>>;
  const result = Array.isArray(envelope.result) ? envelope.result : [];
  return {
    result,
    page: envelope.page ?? fallback.page,
    size: envelope.size ?? fallback.size,
    total: envelope.total ?? result.length
  };
};
