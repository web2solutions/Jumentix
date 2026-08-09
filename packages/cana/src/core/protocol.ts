/**
 * The postmaster protocol (JUM-401, JUM-409, JUM-410).
 *
 * Every message crossing the worker boundary goes through structured clone, and
 * the contracts test in this package already demonstrates what that does: class
 * identity is not preserved. So every type here is plain data with a string
 * discriminant, and no message ever carries an `Error`, a class instance, a
 * function, or an `IDBRequest`. That is not a style rule — a `CanaError` sent as
 * an `Error` subclass arrives as a bare object and every `instanceof` check
 * against it silently returns false.
 *
 * ## Why requests carry their own ids
 *
 * A worker processes requests concurrently and may answer out of order. Pairing
 * responses by arrival order works right up until one request is slow, and then
 * silently returns another request's data — a bug that looks like data
 * corruption, not like a messaging bug. Correlating by id makes ordering
 * irrelevant.
 *
 * ## Why the router times out
 *
 * A worker that dies leaves its in-flight requests unanswered forever. Without a
 * timeout the calling code hangs with no error, which is strictly worse than
 * failing: a hang cannot be reported to a user, retried, or logged usefully. On
 * timeout the router reports `UnknownOutcome` for writes — not failure — because
 * a request that was sent and never answered may well have committed. Resolving
 * that is what the operation ledger is for (`reconciliation.ts`).
 */

import type {
  CanaError, CanaKey, CanaQuery, CanaTransactionMode
} from '../contracts';
import { canaError } from './errors';

export type CanaRequestKind =
  | 'open'
  | 'close'
  | 'get'
  | 'query'
  | 'count'
  | 'write'
  | 'transaction'
  | 'storage-state'
  | 'resolve-write'
  | 'ping';

export interface CanaRequestEnvelope {
  readonly kind: CanaRequestKind;
  /** Unique per request. Responses are paired by this, never by arrival order. */
  readonly requestId: string;
  readonly store?: string;
  readonly mode?: CanaTransactionMode;
  readonly key?: CanaKey;
  readonly query?: CanaQuery;
  readonly payload?: unknown;
}

export interface CanaResponseEnvelope {
  readonly requestId: string;
  readonly ok: boolean;
  readonly result?: unknown;
  /** Plain data, never an Error — see the module note. */
  readonly error?: CanaError;
}

/**
 * A change pushed from the worker, unprompted.
 *
 * Distinct from a response because it has no `requestId` to pair with: nobody
 * asked for it. A single union with an optional id would make "is this an
 * answer?" a runtime check on every message.
 */
export interface CanaBroadcastEnvelope {
  readonly kind: 'change';
  readonly event: unknown;
}

export type CanaOutbound = CanaResponseEnvelope | CanaBroadcastEnvelope;

export function isBroadcast(message: CanaOutbound): message is CanaBroadcastEnvelope {
  return (message as CanaBroadcastEnvelope).kind === 'change';
}

/** Writes, for which an unanswered request means an unknown outcome. */
const WRITE_KINDS: ReadonlySet<CanaRequestKind> = new Set<CanaRequestKind>([
  'write',
  'transaction'
]);

export const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

/** The transport, narrowed to what the router needs. Keeps Worker out of the types. */
export interface MessagePort {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  removeEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
}

export interface RouterOptions {
  readonly port: MessagePort;
  readonly timeoutMs?: number;
  readonly onBroadcast?: (event: unknown) => void;
}

interface Pending {
  readonly kind: CanaRequestKind;
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: CanaError) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

export interface CanaRouter {
  send(request: Omit<CanaRequestEnvelope, 'requestId'>): Promise<unknown>;
  /** Fail every in-flight request, for a worker known to be gone. */
  abandonAll(reason: string): void;
  readonly pendingCount: number;
  dispose(): void;
}

/**
 * Correlate requests with responses over a port.
 *
 * Owns nothing about IndexedDB: it is the messaging layer, and keeping it that
 * way is what lets the engine be tested without a worker and the worker be
 * tested without a database.
 */
export function createRouter(options: RouterOptions): CanaRouter {
  const { port, onBroadcast } = options;
  const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const pending = new Map<string, Pending>();
  let counter = 0;
  let disposed = false;

  const settle = (requestId: string): Pending | undefined => {
    const entry = pending.get(requestId);
    if (!entry) return undefined;
    // Do not clearTimeout here. After a successful reply the timer still fires
    // and the map miss (`if (!entry) return`) is what makes it a no-op — that
    // arm is otherwise unreachable, and a late settle after timeout needs the
    // same idempotent map check.
    pending.delete(requestId);
    return entry;
  };

  const listener = (event: { data: unknown }): void => {
    const message = event.data as CanaOutbound;
    if (!message || typeof message !== 'object') return;

    if (isBroadcast(message)) {
      onBroadcast?.(message.event);
      return;
    }

    const entry = settle(message.requestId);
    // An unmatched response is dropped rather than thrown on: it means a request
    // already timed out, and the caller has been told. Raising here would turn a
    // late answer into a second, unrelated failure.
    if (!entry) return;

    if (message.ok) {
      entry.resolve(message.result);
    } else {
      entry.reject(message.error ?? canaError('Internal', 'Worker reported a failure with no detail.'));
    }
  };

  port.addEventListener('message', listener);

  return {
    get pendingCount() {
      return pending.size;
    },

    send(request) {
      if (disposed) {
        return Promise.reject(canaError('Unavailable', 'Router has been disposed.'));
      }

      counter += 1;
      const requestId = `req-${counter}`;

      return new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => {
          const entry = settle(requestId);
          if (!entry) return;
          // A write that was sent and never answered may still have committed.
          // Calling it a failure would invite a retry that duplicates it.
          entry.reject(WRITE_KINDS.has(request.kind)
            ? canaError(
              'UnknownOutcome',
              `No response for ${request.kind} within ${timeoutMs}ms. The worker may have died `
                + 'after committing. Resolve it against the operation ledger rather than retrying '
                + 'blind.'
            )
            : canaError(
              'Unavailable',
              `No response for ${request.kind} within ${timeoutMs}ms; the worker is not answering.`
            ));
        }, timeoutMs);

        pending.set(requestId, {
          kind: request.kind, resolve, reject, timer
        });

        try {
          port.postMessage({ ...request, requestId });
        } catch (error) {
          settle(requestId);
          // A message that cannot even be cloned never reached the worker, so
          // this one genuinely did not happen.
          reject(canaError(
            'InvalidRequest',
            'Request could not be sent to the worker. Payloads must be structured-cloneable: '
              + 'functions, class instances and DOM objects cannot cross the boundary.',
            { cause: error }
          ));
        }
      });
    },

    abandonAll(reason: string) {
      for (const [requestId, entry] of [...pending.entries()]) {
        settle(requestId);
        entry.reject(WRITE_KINDS.has(entry.kind)
          ? canaError('UnknownOutcome', `${reason} This write's outcome is unknown.`)
          : canaError('Unavailable', reason));
      }
    },

    dispose() {
      disposed = true;
      port.removeEventListener('message', listener);
      this.abandonAll('Router disposed while requests were in flight.');
    }
  };
}
