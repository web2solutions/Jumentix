/* eslint-disable jest/require-hook */
/*
 * The rule above is disabled because `plugin:jest/all` is extended for the
 * whole repository rather than scoped to test files, so a rule about test
 * hooks reaches production source. Module-level state and a registration call
 * are both legitimate here. The config scope is the real defect (JUM-619).
 */
import { setCorrelationIdResolver } from '@jumentix/persistence-contracts';
import { Context } from '@src/infra/context/Context';

/**
 * Gives the store errors this application's correlation id (JUM-601).
 *
 * `ConflictError`, `DataBaseNotFoundError` and `DatabasePagingError` moved to
 * `@jumentix/persistence-contracts` so `external-store-proxy` would stop
 * importing this application's source. They are thrown twenty-eight times
 * inside that library, and `shared/utils.ts` puts `error.correlationId` into
 * every error response — so without this the id would silently vanish from
 * every database error.
 *
 * The dependency points the right way now: the library asks a function, and
 * this file is the only place that knows the function reads an async-local
 * `Context`.
 *
 * Imported for its side effect by the exceptions barrel, so anything that can
 * throw one of these errors has already registered the resolver.
 */
setCorrelationIdResolver(() => {
  const store: Map<unknown, unknown> = Context.getStore() as Map<unknown, unknown>;
  return store ? String(store.get('correlationId') ?? '') : '';
});
