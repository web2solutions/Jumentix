/**
 * Jumentix database-client adapter (JUM-414).
 *
 * Presents a Cana client through the same shape the rest of Jumentix uses for
 * database clients — `connect()`, `disconnect()`, `stores` — so application code
 * written against that shape does not need a special case for offline storage.
 *
 * ## Why this is not registered in `@jumentix/database-client-factory`
 *
 * That factory is server-side. Its drivers are Mongo, PostgreSQL, DynamoDB,
 * Cassandra and friends, and it builds them from environment variables inside a
 * Bun/Node process. Cana is browser-only: it needs `indexedDB`, which does not
 * exist there.
 *
 * Adding `'IndexedDB'` to its `DriverName` union would make it *constructible*
 * on the server and then fail at first use, with a message about a missing
 * global rather than about a driver that was never applicable. Worse, the
 * factory's own composition — environment variable to connection string to
 * connector — has no meaning for a store that has no host, no port and no
 * credentials.
 *
 * So the boundary runs the other way: Cana conforms to the interface, and the
 * application chooses it directly in browser code. That keeps the hexagonal
 * separation intact (Requirements 015/016) — the port is the shape, not the
 * factory.
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

/**
 * Names the shared factory must not accept, and why.
 *
 * Exported so the server-side factory can reject them with an explanation
 * instead of silently falling through to its `InMemory` default — which is what
 * an unrecognised `DB_DRIVER` currently does. A developer who sets
 * `DB_DRIVER=IndexedDB` on the server today gets a working in-memory database
 * and no indication that their configuration was ignored.
 */
export const BROWSER_ONLY_DRIVER_ALIASES: readonly string[] = [
  'indexeddb',
  'indexed-db',
  'cana'
];

/** True when a driver name refers to a browser-only store. */
export function isBrowserOnlyDriver(value: string): boolean {
  return BROWSER_ONLY_DRIVER_ALIASES.includes(value.trim().toLowerCase());
}
