/* eslint-disable @typescript-eslint/no-var-requires */
import path from 'node:path';

/**
 * The sync client as the app constructs it (JUM-681/JUM-491).
 *
 * The main suite injects a scheduler, a renderer, a notifier and an origin id,
 * because that is what makes publish/push/pull/conflict deterministic. The app
 * injects none of them: it passes a designer state, a store and a transport,
 * and everything else defaults. That defaulted half is real wiring — the
 * `setTimeout` the poll loop runs on, the identity that tags every write, the
 * notifier that swallows a message when the host passed none — and it is what
 * runs in production.
 *
 * The failure this protects against is specific: a default that throws (an
 * absent `crypto`, a missing notifier) turns a working sync into a client that
 * cannot start, and no injected-scheduler test would see it.
 *
 * The transport and the Cana client are declared **doubles** of the catalog API
 * and the store (Requirement 135 §5/§7), as in the suite beside this one. The
 * sync client is real.
 */
const repoRoot = path.resolve(__dirname, '../../../../..');
const {
  createCatalogSyncClient,
  CATALOG_SYNC_POLL_INTERVAL_MS,
  CATALOG_SYNC_PUSH_DEBOUNCE_MS
} = require(path.join(repoRoot, 'apps', 'service-management', 'src', 'state', 'catalogSyncClient.js'));

type Domain = { id: string; name: string; context?: Record<string, unknown> };

const STORE_NAME = 'designerDocuments';
const STATE_KEY = 'service-management.v1';

/** The designer state, reduced to the surface the sync client reads. */
const designerStateWith = (domains: Domain[]) => ({ state: { domains } });

/** The store port: a name, a key and an optional Cana client. */
const storeWith = (client?: unknown) => ({
  storeName: STORE_NAME,
  client,
  save: async () => ({ status: 'persisted' })
});

/** The catalog API, answering with an empty catalog unless told otherwise. */
function transportDouble(overrides: Record<string, unknown> = {}) {
  return {
    listCatalogs: async () => [],
    getCatalog: async () => null,
    createCatalog: async () => ({ id: 'cat-1', version: 1 }),
    updateCatalog: async () => ({ id: 'cat-1', version: 2 }),
    deleteCatalog: async () => null,
    restoreCatalog: async () => ({ id: 'cat-1', version: 3 }),
    ...overrides
  };
}

/**
 * Make `globalThis.crypto` throw on access, and hand back the undo.
 *
 * Restoring the original descriptor rather than assigning: `crypto` is a getter
 * on the global in Node, and leaving a thrower behind would take out every
 * suite that runs after this one in the same process.
 */
function blockCrypto(): () => void {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    get() { throw new Error('crypto is blocked'); }
  });

  return () => {
    delete (globalThis as { crypto?: unknown }).crypto;
    Object.defineProperties(globalThis, original ? { crypto: original } : {});
  };
}

describe('createCatalogSyncClient with the app defaults (JUM-681)', () => {
  it('mints an origin id when the host does not supply one', () => {
    expect.hasAssertions();

    const first = createCatalogSyncClient({
      designerState: designerStateWith([]),
      store: storeWith(),
      transport: transportDouble()
    });
    const second = createCatalogSyncClient({
      designerState: designerStateWith([]),
      store: storeWith(),
      transport: transportDouble()
    });

    // Two clients in the same page must not share an identity: the origin id is
    // how a client recognises its own writes coming back and skips them.
    expect(first.originId).toMatch(/^catalog-sync-/);
    expect(second.originId).not.toBe(first.originId);
  });

  it('mints an origin id in a runtime with no crypto at all', () => {
    expect.hasAssertions();

    // Older embedded webviews expose no `crypto`, and some sandboxes throw on
    // touching it. Either way the client has to start.
    const restoreCrypto = blockCrypto();

    let originId = '';
    try {
      originId = createCatalogSyncClient({
        designerState: designerStateWith([]),
        store: storeWith(),
        transport: transportDouble()
      }).originId;
    } finally {
      restoreCrypto();
    }

    expect(originId).toMatch(/^catalog-sync-/);
  });

  it('constructs with no options at all', () => {
    expect.hasAssertions();

    // `createCatalogSyncClient()` — every parameter defaulted, including the
    // destructured options object itself. Nothing can sync, and that is fine:
    // the failure to guard here is throwing at construction, which takes the
    // whole designer down before it renders.
    expect(() => createCatalogSyncClient()).not.toThrow();
  });

  it('starts and stops on the real scheduler, with the default render and notify', async () => {
    expect.hasAssertions();

    // No `schedule`, no `cancelSchedule`, no `render`, no `notify`: the poll
    // loop is a real `setTimeout` at the declared interval, and `stop` has to
    // clear it or the timer keeps the process — and the tab — alive.
    const client = createCatalogSyncClient({
      designerState: designerStateWith([]),
      store: storeWith(),
      transport: transportDouble()
    });

    const started = await client.start();
    const again = await client.start();
    client.stop();

    expect(started).toStrictEqual({ started: true, converged: true });
    expect(again).toStrictEqual({ started: true, already: true });
    expect(client.getStatus().degraded).toBe(false);
    expect(CATALOG_SYNC_POLL_INTERVAL_MS).toBeGreaterThan(0);
  });

  it('subscribes to the store client when there is one, and unsubscribes on stop', async () => {
    expect.hasAssertions();

    let subscribed = 0;
    let unsubscribed = 0;
    const canaClient = {
      subscribe: () => {
        subscribed += 1;
        return () => { unsubscribed += 1; };
      }
    };
    const client = createCatalogSyncClient({
      designerState: designerStateWith([]),
      store: storeWith(canaClient),
      transport: transportDouble()
    });

    await client.start();
    client.stop();

    expect(subscribed).toBe(1);
    expect(unsubscribed).toBe(1);
  });

  it('reports degraded, through the default notifier, when the catalog is unreachable', async () => {
    expect.hasAssertions();

    // The default `notify` is a no-op — a host that passes none still gets a
    // client that records the degradation rather than one that throws out of
    // its own sync loop.
    const client = createCatalogSyncClient({
      designerState: designerStateWith([]),
      store: storeWith(),
      transport: transportDouble({
        listCatalogs: async () => { throw new Error('connection refused'); }
      })
    });

    const result = await client.syncNow();

    expect(result.synced).toBe(false);
    expect(client.getStatus().degraded).toBe(true);
  });

  it('debounces a local commit on the real timer and cancels it on stop', async () => {
    expect.hasAssertions();

    // `onLocalCommit` schedules the push with the default debounce. Stopping
    // before it fires must cancel it: a push after `stop` writes to a catalog
    // the app has already disconnected from.
    let pushes = 0;
    const client = createCatalogSyncClient({
      designerState: designerStateWith([]),
      store: storeWith(),
      transport: transportDouble({
        listCatalogs: async () => { pushes += 1; return []; }
      })
    });

    await client.start();
    client.onLocalCommit({ store: STORE_NAME, key: STATE_KEY, type: 'updated' });
    const beforeStop = pushes;
    client.stop();
    await new Promise((resolve) => { setTimeout(resolve, CATALOG_SYNC_PUSH_DEBOUNCE_MS + 25); });

    expect(CATALOG_SYNC_PUSH_DEBOUNCE_MS).toBeGreaterThan(0);
    expect(pushes).toBe(beforeStop);
  });

  it('ignores commits for another store, another key, and a cleared store', async () => {
    expect.hasAssertions();

    const client = createCatalogSyncClient({
      designerState: designerStateWith([]),
      store: storeWith(),
      transport: transportDouble()
    });

    // None of these may schedule anything, so `stop` has nothing to cancel and
    // the assertions below are about the client staying idle.
    client.onLocalCommit(undefined);
    client.onLocalCommit({ store: 'other', key: STATE_KEY, type: 'updated' });
    client.onLocalCommit({ store: STORE_NAME, key: 'another-key', type: 'updated' });
    client.onLocalCommit({ store: STORE_NAME, key: STATE_KEY, type: 'cleared' });

    expect(client.getStatus()).toStrictEqual({
      degraded: false,
      lastSyncAt: null,
      sharedCount: 0,
      conflictCount: 0
    });
  });

  it('refuses to publish a domain it cannot find, or one already shared', async () => {
    expect.hasAssertions();

    const shared: Domain = {
      id: 'd2',
      name: 'Shared',
      context: { catalog: { id: 'cat-1', version: 1, contentHash: 'abc' } }
    };
    const client = createCatalogSyncClient({
      designerState: designerStateWith([{ id: 'd1', name: 'Local' }, shared]),
      store: storeWith(),
      transport: transportDouble()
    });

    await expect(client.publishDomain('missing')).resolves
      .toStrictEqual({ published: false, reason: 'domain-not-found' });
    await expect(client.publishDomain('d2')).resolves
      .toStrictEqual({ published: false, reason: 'already-shared' });
  });

  it('refuses to unpublish a domain that was never shared', async () => {
    expect.hasAssertions();

    const client = createCatalogSyncClient({
      designerState: designerStateWith([{ id: 'd1', name: 'Local' }]),
      store: storeWith(),
      transport: transportDouble()
    });

    await expect(client.unpublishDomain('d1')).resolves
      .toStrictEqual({ unpublished: false, reason: 'not-shared' });
    await expect(client.unpublishDomain('missing')).resolves
      .toStrictEqual({ unpublished: false, reason: 'not-shared' });
  });

  it('ignores a marker with no id when deciding what is shared', async () => {
    expect.hasAssertions();

    // A half-written marker — the shape a failed publish leaves behind — must
    // not count as shared, or every sync tries to push a record with no id.
    const client = createCatalogSyncClient({
      designerState: designerStateWith([
        { id: 'd1', name: 'A', context: { catalog: { version: 2 } } },
        { id: 'd2', name: 'B', context: { catalog: 'not-an-object' } },
        { id: 'd3', name: 'C', context: {} }
      ]),
      store: storeWith(),
      transport: transportDouble()
    });

    expect(client.getStatus().sharedCount).toBe(0);
  });
});
