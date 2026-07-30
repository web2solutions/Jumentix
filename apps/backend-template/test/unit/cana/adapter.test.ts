import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { CanaSchema, CanaTable } from '@jumentix/cana';
import { createCanaDatabaseClient, isBrowserOnlyDriver } from '@jumentix/cana';

interface Design { id: number; name: string }

const schema: CanaSchema = {
  version: 1,
  stores: [
    { name: 'designs', keyPath: 'id' },
    { name: 'notes', keyPath: 'id' }
  ]
};

const client = () => createCanaDatabaseClient({
  name: 'designer', schema, factory: new IDBFactory()
});

describe('cana jumentix adapter', () => {
  it('exposes connect, disconnect and stores', async () => {
    expect.hasAssertions();
    // The shape the rest of Jumentix expects. If this drifts, application code
    // written against the common interface stops working with Cana.
    const database = client();

    expect(typeof database.connect).toBe('function');
    expect(typeof database.disconnect).toBe('function');
    expect(Object.keys(database.stores).sort()).toStrictEqual(['designs', 'notes']);
    await database.disconnect();
  });

  it('derives stores from the schema, so the two cannot disagree', async () => {
    expect.hasAssertions();
    // A separate store map would let one list a table the other does not, and
    // nobody notices until a write fails.
    const database = createCanaDatabaseClient({
      name: 'designer',
      factory: new IDBFactory(),
      schema: { version: 1, stores: [{ name: 'only-one', keyPath: 'id' }] }
    });

    expect(Object.keys(database.stores)).toStrictEqual(['only-one']);
    await database.disconnect();
  });

  it('reads and writes through the store map', async () => {
    expect.hasAssertions();
    const database = client();
    await database.connect();

    // `stores` is intentionally typed loosely — the shared shape is
    // `Record<string, unknown>` — so callers narrow at the point of use.
    const designs = database.stores.designs as CanaTable<Design, number>;
    await designs.add({ id: 1, name: 'through the adapter' });

    await expect(designs.get(1)).resolves.toMatchObject({ name: 'through the adapter' });
    await database.disconnect();
  });

  it('keeps the underlying client reachable for what the shape cannot express', async () => {
    expect.hasAssertions();
    // `stores` cannot express transactions or durability, and hiding the client
    // entirely would force callers to choose between the common shape and the
    // parts of Cana that matter most.
    const database = client();
    await database.connect();

    const { outcome } = await database.cana.transaction('readwrite', ['designs'], async (scope) => {
      await scope.table<Design>('designs').add({ id: 1, name: 'a' });
    });

    expect(outcome).toBe('committed');
    await database.disconnect();
  });

  it('forwards subscriptions', async () => {
    expect.hasAssertions();
    const database = client();
    await database.connect();
    const seen: string[] = [];
    database.subscribe((event) => seen.push(event.type));

    await (database.stores.designs as CanaTable<Design, number>).add({ id: 1, name: 'a' });

    expect(seen).toStrictEqual(['created']);
    await database.disconnect();
  });

  it('is safe to disconnect without ever connecting', async () => {
    expect.hasAssertions();
    const database = client();

    await expect(database.disconnect()).resolves.toBeUndefined();
  });
});

describe('browser-only driver detection', () => {
  it('recognises the aliases a developer would plausibly type', () => {
    expect.hasAssertions();
    expect(isBrowserOnlyDriver('IndexedDB')).toBe(true);
    expect(isBrowserOnlyDriver('  indexed-db  ')).toBe(true);
    expect(isBrowserOnlyDriver('cana')).toBe(true);
  });

  it('does not claim server drivers', () => {
    expect.hasAssertions();
    expect(isBrowserOnlyDriver('Mongo')).toBe(false);
    expect(isBrowserOnlyDriver('InMemory')).toBe(false);
  });
});
