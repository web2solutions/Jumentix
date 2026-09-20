import type { IPagingRequest } from '@src/modules/port/IPagingRequest';
import { BaseDomainEvent } from '@src/modules/port/BaseDomainEvent';
import { _DEFAULT_PAGE_SIZE_ } from '@src/config/constants';
import { Security } from '@src/infra/security';

const toPositiveInteger = (raw: unknown): number | undefined => {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const value = Number(Security.xss(String(raw)));
  if (!Number.isInteger(value) || value < 1) return undefined;
  return value;
};

/**
 * `page` and `size` from the query string; `defaultSize` comes from the
 * operation's `x-list-capabilities` when declared (JUM-777). Non-numeric or
 * non-positive values fall back to the defaults here — the OAS parameter
 * schema (`integer`, `minimum: 1`) rejects them earlier for validated routes.
 */
export const setPaging = (
  event: BaseDomainEvent,
  defaultSize: number = _DEFAULT_PAGE_SIZE_
): IPagingRequest => ({
  page: toPositiveInteger(event.queryString?.page) ?? 1,
  size: toPositiveInteger(event.queryString?.size) ?? defaultSize
});
