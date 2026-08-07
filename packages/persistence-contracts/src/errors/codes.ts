/**
 * The strings the application matches a store error on (JUM-601).
 *
 * Deliberately literals rather than an import from the application's
 * `config/constants` — importing that is what this change exists to stop. They
 * are pinned by a test on both sides, so a drift fails rather than silently
 * routing an error to the wrong HTTP status.
 */
export const PERSISTENCE_ERROR_NAMES = {
  notFound: 'database_not_found',
  conflict: 'database_duplicated',
  paging: 'database_paging_error'
} as const;

/** The `code` values, which the application maps to HTTP statuses. */
export const PERSISTENCE_ERROR_CODES = {
  notFound: 'GENERIC.NOT_FOUND',
  conflict: 'GENERIC.CONFLICT',
  invalidInput: 'GENERIC.INVALID_INPUT'
} as const;
