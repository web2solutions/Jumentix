/**
 * Jumentix database-client adapter (JUM-414).
 *
 * Presents a Cana client through the same shape the rest of Jumentix uses for
 * database clients — `connect()`, `disconnect()`, `stores` — so application code
 * written against that shape does not need a special case for offline storage.
 *
 * ## How it plugs into `@jumentix/database-client-factory`
 *
 * Jumentix supports applications that are 100% offline with no backend at all,
 * and for those IndexedDB is not an exception case — it is the database. So
 * `'IndexedDB'` is a first-class `DriverName` there, selectable exactly like
 * Mongo or PostgreSQL.
 *
 * It is supplied by *injection* rather than imported, following the same pattern
 * the factory already uses for its in-memory client:
 *
 * ```ts
 * buildDatabaseClientCompilers({
 *   inMemoryClient,
 *   indexedDbClient: () => createCanaDatabaseClient({ name: 'app', schema })
 * });
 * ```
 *
 * The direction matters. If the factory imported Cana directly, every
 * server-side process that builds a Mongo client would pull a browser-only
 * package into its dependency graph. Injection keeps the port as the shape and
 * lets each host supply what it can actually run (Requirements 015/016).
 *
 * Selecting `IndexedDB` without a usable IndexedDB global opens Cana's
 * localStorage fallback by default (JUM-615). Pass `fallback: false` on the
 * Cana options when the host must fail closed instead of degrading.
 */

import type {
  CanaChangeEvent, CanaKey, CanaSchema, CanaTable
} from './contracts';
import type { ClientOptions } from './core/client';
import { Client, createClient } from './core/client';

/**
 * The client shape Jumentix application code expects.
 *
 * Declared here rather than imported from `@jumentix/database-client-factory`
 * on purpose: importing it would make this browser package depend on a
 * server-side one, which is the coupling this file exists to avoid. The shape is
 * small and stable, and a mismatch is caught by the adapter test.
 */
export interface JumentixDatabaseClientLike {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  stores: Record<string, unknown>;
}

export interface CanaDatabaseClient extends JumentixDatabaseClientLike {
  readonly stores: Record<string, CanaTable<unknown, CanaKey>>;
  /** The underlying client, for the parts of Cana the common shape cannot express. */
  readonly cana: Client;
  subscribe(listener: (event: CanaChangeEvent) => void): () => void;
}

function buildStores(
  cana: Client,
  schema: CanaSchema
): Record<string, CanaTable<unknown, CanaKey>> {
  const stores: Record<string, CanaTable<unknown, CanaKey>> = {};
  for (const store of schema.stores) {
    stores[store.name] = cana.table<unknown, CanaKey>(store.name);
  }
  return stores;
}

/**
 * Build a Jumentix-shaped database client backed by Cana.
 *
 * `stores` is keyed by the schema's store names, so `client.stores.designs` is
 * the same `CanaTable` that `client.cana.table('designs')` returns. Derived from
 * the schema rather than accepting a separate map, because a store present in
 * one and absent from the other is a mismatch nobody notices until a write
 * fails.
 */
export function createCanaDatabaseClient(options: ClientOptions): CanaDatabaseClient {
  const cana = createClient(options);
  const stores = buildStores(cana, options.schema);

  return {
    cana,
    stores,
    connect: () => cana.open(),
    // `disconnect` rather than `close` because that is the name the shared shape
    // uses; the underlying call is the same.
    disconnect: () => cana.close(),
    subscribe: (listener) => cana.subscribe(listener)
  };
}
