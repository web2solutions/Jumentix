/**
 * The worker host (JUM-409, JUM-410).
 *
 * `protocol.ts` defines the messages and correlates them. This runs the engine
 * on the other side of them: it owns a real `Client`, serves requests arriving
 * on a port, and pushes committed changes back as broadcasts.
 *
 * Together with `createWorkerClient` below, this closes the gap the protocol
 * commit recorded as unproven — that the engine can actually be driven across a
 * message boundary at all.
 *
 * ## Everything on the wire is plain data
 *
 * A response never carries a `CanaTable`, an `IDBDatabase`, or a `CanaError`
 * that is secretly an `Error`. The host converts before sending. This is not
 * tidiness: `postMessage` throws `DataCloneError` on a function or a class with
 * private state, and that failure would surface as a mysterious send error
 * rather than as "this value cannot cross the boundary".
 *
 * ## Failures cross as data too
 *
 * A rejected request comes back as `{ ok: false, error }` where `error` is a
 * `CanaError` — already plain data by construction. The host never lets an
 * exception escape into the message handler, because an unhandled rejection in
 * a worker terminates nothing and answers nobody: the caller would simply wait
 * out its timeout for a failure that was already known.
 */

import type {
  CanaChangeEvent, CanaKey, CanaQuery, CanaTransactionMode
} from '../contracts';
import { isCanaError } from '../contracts';
import type { Client, ClientOptions } from './client';
import { createClient } from './client';
import { canaError, translateError } from './errors';
import type {
  CanaRequestEnvelope,
  CanaResponseEnvelope,
  MessagePort
} from './protocol';

/** What a `write` request carries. */
export interface WritePayload {
  readonly operation: 'add' | 'put' | 'update' | 'delete' | 'clear'
  | 'bulkAdd' | 'bulkPut' | 'bulkDelete';
  readonly record?: unknown;
  readonly records?: readonly unknown[];
  readonly keys?: readonly CanaKey[];
  readonly changes?: Record<string, unknown>;
}

export interface WorkerHostOptions extends ClientOptions {
  readonly port: MessagePort;
  /**
   * Broadcast committed changes to the port.
   *
   * On by default. Turning it off is for hosts whose clients poll instead —
   * rare, but a subscriber that is never read is a memory cost for nothing.
   */
  readonly broadcastChanges?: boolean;
}

export interface WorkerHost {
  readonly client: Client;
  /** Stop serving and release the change subscription. */
  dispose(): Promise<void>;
}

function requireStore(request: CanaRequestEnvelope): string {
  if (!request.store) {
    throw canaError('InvalidRequest', `${request.kind} requires a store name.`);
  }
  return request.store;
}

function requireKey(request: CanaRequestEnvelope): CanaKey {
  if (request.key === undefined) {
    throw canaError('InvalidRequest', `${request.kind} requires a key.`, {
      ...(request.store === undefined ? {} : { store: request.store })
    });
  }
  return request.key;
}

async function applyWrite(client: Client, request: CanaRequestEnvelope): Promise<unknown> {
  const store = requireStore(request);
  const payload = request.payload as WritePayload | undefined;

  if (!payload?.operation) {
    throw canaError('InvalidRequest', 'write requires an operation.', { store });
  }

  const table = client.table(store);

  switch (payload.operation) {
    case 'add':
      return table.add(payload.record, request.key);
    case 'put':
      return table.put(payload.record, request.key);
    case 'update':
      return table.update(requireKey(request), payload.changes ?? {});
    case 'delete':
      return table.delete(requireKey(request));
    case 'clear':
      return table.clear();
    case 'bulkAdd':
      return table.bulkAdd(payload.records ?? []);
    case 'bulkPut':
      return table.bulkPut(payload.records ?? []);
    case 'bulkDelete':
      return table.bulkDelete(payload.keys ?? []);
    default:
      throw canaError(
        'InvalidRequest',
        `Unsupported write operation "${String(payload.operation)}".`,
        { store }
      );
  }
}

/**
 * Execute one request against the client.
 *
 * Exported so a host embedded in someone else's message loop can reuse the
 * dispatch without taking the port handling too.
 */
export async function serve(client: Client, request: CanaRequestEnvelope): Promise<unknown> {
  switch (request.kind) {
    case 'ping':
      return 'pong';

    case 'open':
      await client.open();
      return { name: client.name, version: client.version };

    case 'close':
      await client.close();
      return null;

    case 'get':
      return client.table(requireStore(request)).get(requireKey(request));

    case 'query':
      return client.table(requireStore(request)).query(request.query);

    case 'count':
      return client.table(requireStore(request)).count(request.query);

    case 'storage-state':
      return client.storageState();

    case 'resolve-write': {
      const payload = request.payload as { correlationId?: string; attemptedAt?: number };
      if (typeof payload?.correlationId !== 'string' || typeof payload?.attemptedAt !== 'number') {
        throw canaError(
          'InvalidRequest',
          'resolve-write needs both correlationId and attemptedAt: an id alone cannot '
            + 'distinguish a rollback from a pruned record.'
        );
      }
      return client.resolveWrite(payload.correlationId, payload.attemptedAt);
    }

    case 'write':
      return applyWrite(client, request);

    case 'transaction':
      // A transaction body is a function, and functions do not survive
      // structured clone. Saying so is more useful than the DataCloneError the
      // caller would otherwise get from `postMessage` with no explanation.
      throw canaError(
        'InvalidRequest',
        'Multi-operation transactions cannot cross the worker boundary: the body is a '
          + 'function, and functions are not structured-cloneable. Run the transaction inside '
          + 'the worker, or send the operations individually.'
      );

    default:
      throw canaError('InvalidRequest', `Unsupported request kind "${String(request.kind)}".`);
  }
}

/**
 * Serve Cana requests arriving on a port.
 *
 * Call this inside the worker. The returned host owns the client's lifetime, so
 * `dispose()` is what a worker's own teardown should call.
 */
export function createWorkerHost(options: WorkerHostOptions): WorkerHost {
  const { port, broadcastChanges = true, ...clientOptions } = options;
  const client = createClient(clientOptions);

  let unsubscribe: (() => void) | undefined;
  let disposed = false;

  const reply = (response: CanaResponseEnvelope): void => {
    try {
      port.postMessage(response);
    } catch {
      // The response itself could not be cloned. Nothing useful can be sent —
      // sending a second message that also fails would only loop — so the
      // caller's timeout is what reports it. Swallowed deliberately, and only
      // here, at the outermost edge.
    }
  };

  const handler = (event: { data: unknown }): void => {
    const request = event.data as CanaRequestEnvelope;
    if (!request || typeof request !== 'object' || typeof request.requestId !== 'string') {
      // Not ours. A port may be shared, and answering a message we do not
      // understand is worse than ignoring it.
      return;
    }

    // Deliberately not awaited: the handler must return so the port stays
    // responsive to other requests while this one runs. Every outcome is
    // reported through `reply`, so nothing is lost by not awaiting.
    serve(client, request)
      .then((result) => reply({ requestId: request.requestId, ok: true, result }))
      .catch((error: unknown) => reply({
        requestId: request.requestId,
        ok: false,
        error: isCanaError(error) ? error : translateError(error)
      }));
  };

  port.addEventListener('message', handler);

  if (broadcastChanges) {
    unsubscribe = client.subscribe((change: CanaChangeEvent) => {
      try {
        port.postMessage({ kind: 'change', event: change });
      } catch {
        // A change that cannot be cloned must not take down the write that
        // produced it — the data is already committed.
      }
    });
  }

  return {
    client,
    async dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe?.();
      port.removeEventListener('message', handler);
      await client.close();
    }
  };
}

/* ------------------------------------------------------------------ *
 * The other side
 * ------------------------------------------------------------------ */

/**
 * A typed façade over a router, so calling code does not hand-build envelopes.
 *
 * Deliberately **not** shaped like `CanaClient`. It cannot honestly implement
 * `transaction()` — the body is a function — and offering a method that always
 * throws would be worse than not offering it. The surface is what genuinely
 * crosses a message boundary, and nothing more.
 */
export interface CanaWorkerClient {
  ping(): Promise<unknown>;
  open(): Promise<unknown>;
  close(): Promise<unknown>;
  get<TRecord>(store: string, key: CanaKey): Promise<TRecord | undefined>;
  query<TRecord>(store: string, query?: CanaQuery): Promise<readonly TRecord[]>;
  count(store: string, query?: CanaQuery): Promise<number>;
  add(store: string, record: unknown, key?: CanaKey): Promise<unknown>;
  put(store: string, record: unknown, key?: CanaKey): Promise<unknown>;
  update(store: string, key: CanaKey, changes: Record<string, unknown>): Promise<unknown>;
  remove(store: string, key: CanaKey): Promise<unknown>;
  clear(store: string): Promise<unknown>;
  bulkAdd(store: string, records: readonly unknown[]): Promise<unknown>;
  bulkPut(store: string, records: readonly unknown[]): Promise<unknown>;
  bulkDelete(store: string, keys: readonly CanaKey[]): Promise<unknown>;
  storageState(): Promise<unknown>;
  resolveWrite(correlationId: string, attemptedAt: number): Promise<unknown>;
}

/** The subset of `CanaRouter` this façade needs. */
export interface RequestSender {
  send(request: Omit<CanaRequestEnvelope, 'requestId'>): Promise<unknown>;
}

export function createWorkerClient(router: RequestSender): CanaWorkerClient {
  const write = (
    store: string,
    payload: WritePayload,
    key?: CanaKey,
    mode: CanaTransactionMode = 'readwrite'
  ) => router.send({
    kind: 'write',
    store,
    mode,
    payload,
    ...(key === undefined ? {} : { key })
  });

  return {
    ping: () => router.send({ kind: 'ping' }),
    open: () => router.send({ kind: 'open' }),
    close: () => router.send({ kind: 'close' }),

    get: <TRecord>(store: string, key: CanaKey) => router
      .send({ kind: 'get', store, key }) as Promise<TRecord | undefined>,

    query: <TRecord>(store: string, query?: CanaQuery) => router
      .send({ kind: 'query', store, ...(query === undefined ? {} : { query }) })
      .then((rows) => rows as readonly TRecord[]),

    count: (store: string, query?: CanaQuery) => router
      .send({ kind: 'count', store, ...(query === undefined ? {} : { query }) })
      .then((value) => value as number),

    add: (store, record, key) => write(store, { operation: 'add', record }, key),
    put: (store, record, key) => write(store, { operation: 'put', record }, key),
    update: (store, key, changes) => write(store, { operation: 'update', changes }, key),
    remove: (store, key) => write(store, { operation: 'delete' }, key),
    clear: (store) => write(store, { operation: 'clear' }),
    bulkAdd: (store, records) => write(store, { operation: 'bulkAdd', records }),
    bulkPut: (store, records) => write(store, { operation: 'bulkPut', records }),
    bulkDelete: (store, keys) => write(store, { operation: 'bulkDelete', keys }),

    storageState: () => router.send({ kind: 'storage-state' }),
    resolveWrite: (correlationId, attemptedAt) => router.send({
      kind: 'resolve-write',
      payload: { correlationId, attemptedAt }
    })
  };
}
