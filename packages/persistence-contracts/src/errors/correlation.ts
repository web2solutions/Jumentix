/* eslint-disable jest/require-hook */
/*
 * The rule above is disabled because `plugin:jest/all` is extended for the
 * whole repository rather than scoped to test files, so a rule about test
 * hooks reaches production source. Module-level state and a registration call
 * are both legitimate here. The config scope is the real defect (JUM-619).
 */
/**
 * Where a store error gets its correlation id from (JUM-601).
 *
 * The application stamps a correlation id per request and puts it in every
 * error response (`shared/utils.ts` reads `error.correlationId`). Its own
 * `BaseError` reads that id out of an async-local `Context` at construction.
 *
 * `external-store-proxy` throws twenty-eight of these errors, so moving them
 * out of the application would have dropped the id from every database error in
 * a response — a real observability regression, and the reason a naive move is
 * wrong rather than merely different.
 *
 * A resolver inverts it. The library asks a function it was given; the
 * application registers one that reads its `Context` at startup. No application
 * infrastructure crosses the boundary, and the payload is unchanged.
 *
 * The default returns an empty string, which is what `BaseError` produces when
 * there is no store — so an unconfigured process behaves exactly as before.
 */
export type CorrelationIdResolver = () => string;

const noCorrelationId: CorrelationIdResolver = () => '';

let resolver: CorrelationIdResolver = noCorrelationId;

/**
 * Registers the source of correlation ids.
 *
 * Called once, at application startup. Returns the previous resolver so a test
 * can put it back rather than leaking a stub into the suites that follow.
 */
export function setCorrelationIdResolver(next: CorrelationIdResolver): CorrelationIdResolver {
  const previous = resolver;
  resolver = typeof next === 'function' ? next : noCorrelationId;
  return previous;
}

/** The current correlation id, or an empty string when none is configured. */
export function currentCorrelationId(): string {
  try {
    return resolver() || '';
  } catch {
    // An error being constructed must not be derailed by the thing that
    // annotates it. A missing id is a worse report; a throw here would replace
    // the real failure with this one.
    return '';
  }
}
