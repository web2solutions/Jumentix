/**
 * Error construction and DOMException translation.
 *
 * Two jobs, and the second is the one that earns this file:
 *
 * 1. Build `CanaError` values as plain data (see `contracts.ts` for why they are
 *    not `Error` subclasses).
 * 2. Translate what IndexedDB actually throws into that taxonomy.
 *
 * The translation matters because IndexedDB reports failures as `DOMException`
 * with a `name` string, and those names are the only reliable discriminator —
 * the `message` text is browser-specific and changes between versions. Anyone
 * matching on message text has written a browser-version dependency without
 * realising it.
 */

import type { CanaError, CanaErrorCode, CanaKey } from '../contracts';

interface ErrorDetails {
  readonly store?: string;
  readonly key?: CanaKey;
  readonly cause?: unknown;
}

/**
 * Failures where retrying the identical operation could plausibly succeed.
 *
 * Deliberately narrow. `QuotaExceeded` is absent: retrying a write that did not
 * fit will not make it fit, and marking it retryable invites a loop that burns
 * battery and never converges. Freeing space is a *different* operation.
 */
const RETRYABLE: ReadonlySet<CanaErrorCode> = new Set<CanaErrorCode>([
  'UpgradeBlocked',
  'TransactionAborted',
  'Backpressure'
]);

/** Flatten any thrown value to a diagnostic string. */
function describeCause(cause: unknown): string | undefined {
  if (cause === undefined || cause === null) return undefined;
  if (typeof cause === 'string') return cause;
  if (typeof cause === 'object') {
    const named = cause as { name?: unknown; message?: unknown };
    const name = typeof named.name === 'string' ? named.name : undefined;
    const message = typeof named.message === 'string' ? named.message : undefined;
    if (name && message) return `${name}: ${message}`;
    if (name) return name;
    if (message) return message;
  }
  return String(cause);
}

/** Construct a Cana failure. */
export function canaError(
  code: CanaErrorCode,
  message: string,
  details: ErrorDetails = {}
): CanaError {
  const cause = describeCause(details.cause);
  return {
    canaError: true,
    code,
    message,
    retryable: RETRYABLE.has(code),
    ...(details.store === undefined ? {} : { store: details.store }),
    ...(details.key === undefined ? {} : { key: details.key }),
    ...(cause === undefined ? {} : { cause })
  };
}

/**
 * IndexedDB `DOMException.name` values, mapped to the taxonomy.
 *
 * `QuotaExceededError` is the one this whole exercise cares about most: without
 * an explicit mapping it lands in `Internal`, and a caller has no way to
 * distinguish "your disk is full" from "something broke" — which is the
 * difference between an actionable warning and a shrug.
 */
const DOM_EXCEPTION_MAP: Readonly<Record<string, CanaErrorCode>> = {
  QuotaExceededError: 'QuotaExceeded',
  ConstraintError: 'ConstraintViolation',
  NotFoundError: 'NotFound',
  AbortError: 'TransactionAborted',
  TransactionInactiveError: 'TransactionInactive',
  VersionError: 'UpgradeFailed',
  InvalidStateError: 'TransactionInactive',
  DataError: 'InvalidRequest',
  DataCloneError: 'InvalidRequest',
  InvalidAccessError: 'InvalidRequest',
  ReadOnlyError: 'InvalidRequest',
  UnknownError: 'Internal'
};

/**
 * Translate a thrown value into a `CanaError`.
 *
 * A value that is already a `CanaError` passes through unchanged, so wrapping at
 * multiple layers does not bury the original classification under `Internal`.
 */
export function translateError(thrown: unknown, details: ErrorDetails = {}): CanaError {
  if (
    typeof thrown === 'object'
    && thrown !== null
    && (thrown as { canaError?: unknown }).canaError === true
  ) {
    return thrown as CanaError;
  }

  const name = typeof thrown === 'object' && thrown !== null
    ? (thrown as { name?: unknown }).name
    : undefined;

  const code = typeof name === 'string' && name in DOM_EXCEPTION_MAP
    ? DOM_EXCEPTION_MAP[name]
    : 'Internal';

  const message = typeof thrown === 'object'
    && thrown !== null
    && typeof (thrown as { message?: unknown }).message === 'string'
    ? (thrown as { message: string }).message
    : 'Unclassified failure';

  return canaError(code, message, { ...details, cause: thrown });
}

/**
 * Promisify an `IDBRequest`, translating rejection.
 *
 * Every IndexedDB call in the engine goes through here, which is what keeps the
 * `DOMException` surface from leaking past the boundary in the one place it is
 * easiest to forget: an unhandled `onerror`.
 */
export function requestToPromise<TResult>(
  request: IDBRequest<TResult>,
  details: ErrorDetails = {}
): Promise<TResult> {
  return new Promise<TResult>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      reject(translateError(request.error, details));
    };
  });
}
