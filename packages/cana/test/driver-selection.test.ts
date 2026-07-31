import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { CanaSchema } from '@jumentix/cana';
import { createCanaDatabaseClient } from '@jumentix/cana';
import { buildDatabaseClientCompilers } from '@jumentix/database-client-factory';
import type { IDatabaseClientLike } from '@jumentix/database-client-factory';

/**
 * `IndexedDB` as a first-class driver (JUM-414).
 *
 * Jumentix supports applications that are 100% offline with no backend, and for
 * those IndexedDB is not an exception case — it is the database. These tests
 * pin the two properties that matter: it resolves when wired, and it fails
 * loudly rather than falling back when it is not.
 */

const schema: CanaSchema = {
  version: 1,
  stores: [{ name: 'designs', keyPath: 'id' }]
};

const inMemoryClient = {
  connect: async () => undefined,
  disconnect: async () => undefined,
  stores: {}
} as IDatabaseClientLike;

const withCana = () => buildDatabaseClientCompilers<IDatabaseClientLike>({
  inMemoryClient,
  indexedDbClient: () => createCanaDatabaseClient({
    name: 'designer', schema, factory: new IDBFactory()
  }) as unknown as IDatabaseClientLike
});

const withoutCana = () => buildDatabaseClientCompilers<IDatabaseClientLike>({ inMemoryClient });

describe('indexedDB driver selection', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('resolves a Cana client when the driver is selected', () => {
    expect.hasAssertions();
    const client = withCana().compileDatabaseClientByDriver('IndexedDB');

    expect(client).not.toBe(inMemoryClient);
    expect(Object.keys(client.stores)).toStrictEqual(['designs']);
  });

  it('accepts the aliases a developer would plausibly write', () => {
    expect.hasAssertions();
    const compilers = withCana();

    for (const alias of ['indexeddb', 'indexed-db', 'Cana', '  IndexedDB  ']) {
      expect(compilers.compileDatabaseClientByDriver(alias)).not.toBe(inMemoryClient);
    }
  });

  it('resolves from the environment variable like any other driver', () => {
    expect.hasAssertions();
    process.env.AAA_DATABASE_DRIVER = 'IndexedDB';

    expect(withCana().compileDatabaseClient()).not.toBe(inMemoryClient);
  });

  it('exposes a named compiler alongside the others', () => {
    expect.hasAssertions();
    expect(typeof withCana().compileIndexedDbClient).toBe('function');
    expect(Object.keys(withCana().compileIndexedDbClient()!.stores)).toStrictEqual(['designs']);
  });

  it('fails loudly when selected without being wired, rather than falling back', () => {
    expect.hasAssertions();
    // Falling back to in-memory would start an offline application on a store
    // that vanishes when the tab closes, reporting nothing. It would look
    // healthy and lose everything.
    expect(() => withoutCana().compileDatabaseClientByDriver('IndexedDB'))
      .toThrow(/no indexedDbClient factory was provided/);
  });

  it('says so when the runtime has no indexedDB global', () => {
    expect.hasAssertions();
    // A server-side render or a node process running an offline-capable build.
    const saved = Reflect.get(globalThis, 'indexedDB');
    Reflect.deleteProperty(globalThis as object, 'indexedDB');
    try {
      expect(() => withCana().compileDatabaseClientByDriver('IndexedDB'))
        .toThrow(/no indexedDB global/);
    } finally {
      Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: saved });
    }
  });

  it('leaves every other driver alone', () => {
    expect.hasAssertions();
    // The change must not have altered how anything else resolves.
    const compilers = withCana();

    expect(compilers.compileDatabaseClientByDriver('InMemory')).toBe(inMemoryClient);
    expect(compilers.compileDatabaseClientByDriver('not-a-real-driver')).toBe(inMemoryClient);
  });
});
