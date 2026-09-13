import { parseListSort } from '@jumentix/persistence-contracts';
import type { IPagingRequest } from '@src/modules/port/IPagingRequest';
import { BaseDomainEvent } from '@src/modules/port/BaseDomainEvent';
import { setFilter } from '@src/modules/port/setFilter';
import { setPaging } from '@src/modules/port/setPaging';
import { ValidationError } from '@src/infra/exceptions';
import { Security } from '@src/infra/security';

/**
 * `x-list-capabilities` — the vendor extension a list operation carries in the
 * OpenAPI document (JUM-777). It is the single source for what a client may
 * sort, filter and search by; the frontend renders affordances from it and
 * this module rejects anything outside it, so the UI and the server cannot
 * disagree about the contract.
 */
export type TListFilterKind = 'text' | 'enum' | 'boolean' | 'date' | 'uuid' | 'number';

export interface IListCapabilities {
  sortable: string[];
  filterable: Record<string, TListFilterKind>;
  searchable: string[];
  defaultSize: number;
  maxSize: number;
}

const ALLOWED_OPERATORS = new Set([
  'eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'contains', 'ilike', 'like', 'between', 'exists'
]);

export const readListCapabilities = (
  schemaOAS: Record<string, any> | undefined
): IListCapabilities | undefined => {
  const raw = schemaOAS?.['x-list-capabilities'];
  if (!raw || typeof raw !== 'object') return undefined;
  return {
    sortable: Array.isArray(raw.sortable) ? raw.sortable : [],
    filterable: raw.filterable && typeof raw.filterable === 'object' ? raw.filterable : {},
    searchable: Array.isArray(raw.searchable) ? raw.searchable : [],
    defaultSize: Number(raw.defaultSize) || 30,
    maxSize: Number(raw.maxSize) || 100
  };
};

const list = (values: string[]): string => (values.length ? values.join(', ') : '(none)');

/**
 * Parses `page`, `size`, `filter`, `sort` and `q` from the request and
 * validates them against the operation's declared capabilities. Operations
 * without `x-list-capabilities` keep the legacy behaviour: paging plus the
 * base64 `filter`, nothing validated beyond the OAS parameter schemas.
 *
 * Every rejection names the accepted values, in the style of Requirement 126's
 * enum errors, so a client can correct itself without reading the server.
 */
export const setListQuery = (
  event: BaseDomainEvent
): { filters: Record<string, any>; paging: IPagingRequest } => {
  const capabilities = readListCapabilities(event.schemaOAS);
  const filters = setFilter(event);
  const paging = setPaging(event, capabilities?.defaultSize);
  const query = event.queryString ?? {};

  const rawSort = query.sort === undefined ? undefined : Security.xss(String(query.sort));
  const sort = parseListSort(rawSort);
  if (sort) paging.sort = sort;

  const q = query.q === undefined ? '' : Security.xss(String(query.q)).trim();
  if (q) paging.q = q;

  if (!capabilities) {
    if (q) {
      throw new ValidationError(
        'The parameter q is not supported by this operation: it declares no x-list-capabilities.searchable.'
      );
    }
    if (sort) {
      throw new ValidationError(
        'The parameter sort is not supported by this operation: it declares no x-list-capabilities.sortable.'
      );
    }
    return { filters, paging };
  }

  if (paging.size > capabilities.maxSize) {
    throw new ValidationError(
      `The parameter size must be between 1 and ${capabilities.maxSize}; received ${paging.size}.`
    );
  }

  for (const entry of sort ?? []) {
    if (!capabilities.sortable.includes(entry.field)) {
      throw new ValidationError(
        `The sort field "${entry.field}" is not sortable. Accepted: ${list(capabilities.sortable)}.`
      );
    }
  }

  for (const [field, value] of Object.entries(filters)) {
    if (!(field in capabilities.filterable)) {
      throw new ValidationError(
        `The filter field "${field}" is not filterable. Accepted: ${list(Object.keys(capabilities.filterable))}.`
      );
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const operator = String((value as { operator?: unknown }).operator ?? '');
      if (!ALLOWED_OPERATORS.has(operator)) {
        throw new ValidationError(
          `The filter operator "${operator}" on "${field}" is not accepted. Accepted: ${list([...ALLOWED_OPERATORS])}.`
        );
      }
    }
  }

  if (q) {
    if (capabilities.searchable.length === 0) {
      throw new ValidationError('The parameter q is not supported: this operation declares no searchable fields.');
    }
    paging.searchFields = capabilities.searchable;
  }

  return { filters, paging };
};
