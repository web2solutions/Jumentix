import type { CanaSchema, CanaTable } from '../src';
import { createCanaDatabaseClient } from '../src';

/**
 * Requirement 112 §4 — the Jumentix adapter, in a real browser.
 *
 * What changed from the Node version of this file: the fake-implementation import
 * and the injected `IDBFactory` are gone. There is nothing to inject. The
 * client opens the browser's own `indexedDB`, which is the object every
 * consumer of this package will actually be handed.
 *
 * Each test names its own database, because real IndexedDB persists across
 * tests and across runs — a fake is rebuilt each time and hides every ordering
 * assumption a suite happens to make.
 */

interface Design { id: number; name: string }

const schema: CanaSchema = {
  version: 1,
  stores: [
    { name: 'designs', keyPath: 'id' },
    { name: 'notes', keyPath: 'id' }
  ]
};

let sequence = 0;
const uniqueName = () => {
  sequence += 1;
  return `adapter-${Date.now()}-${sequence}`;
};

const client = (name = uniqueName()) => createCanaDatabaseClient({ name, schema });

describe('cana jumentix adapter', () => {
  it('exposes connect, disconnect and stores', async () => {
    // The shape the rest of Jumentix expects. If this drifts, application code
    // written against the common interface stops working with Cana.
    const database = client();

    expect(database.connect).to.be.a('function');
    expect(database.disconnect).to.be.a('function');
    expect(Object.keys(database.stores).sort()).to.deep.equal(['designs', 'notes']);

    await database.disconnect();
  });

  it('derives stores from the schema, so the two cannot disagree', async () => {
    // A separate store map would let one list a table the other does not, and
    // nobody notices until a write fails.
    const database = createCanaDatabaseClient({
      name: uniqueName(),
      schema: { version: 1, stores: [{ name: 'only-one', keyPath: 'id' }] }
    });

    expect(Object.keys(database.stores)).to.deep.equal(['only-one']);

    await database.disconnect();
  });

  it('reads and writes through the store map', async () => {
    const database = client();
    await database.connect();

    // `stores` is intentionally typed loosely — the shared shape is
    // `Record<string, unknown>` — so callers narrow at the point of use.
    const designs = database.stores.designs as CanaTable<Design, number>;
    await designs.add({ id: 1, name: 'through the adapter' });

    expect(await designs.get(1)).to.include({ name: 'through the adapter' });

    await database.disconnect();
  });

  it('keeps the underlying client reachable for what the shape cannot express', async () => {
    // `stores` cannot express transactions or durability, and hiding the client
    // entirely would force callers to choose between the common shape and the
    // parts of Cana that matter most.
    const database = client();
    await database.connect();

    const { outcome } = await database.cana.transaction('readwrite', ['designs'], async (scope) => {
      await scope.table<Design>('designs').add({ id: 1, name: 'a' });
    });

    expect(outcome).to.equal('committed');

    await database.disconnect();
  });

  it('forwards subscriptions', async () => {
    const database = client();
    await database.connect();
    const seen: string[] = [];
    database.subscribe((event) => seen.push(event.type));

    await (database.stores.designs as CanaTable<Design, number>).add({ id: 1, name: 'a' });

    expect(seen).to.deep.equal(['created']);

    await database.disconnect();
  });

  it('is safe to disconnect without ever connecting', async () => {
    const database = client();

    expect(await database.disconnect()).to.equal(undefined);
  });
});
