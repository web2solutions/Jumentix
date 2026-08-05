/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
import path from 'node:path';

/**
 * Unit suite for the `IDesignerStore` port and its transitional
 * `LocalStorageDesignerStore` adapter (JUM-468).
 *
 * The port is Cana-shaped: async everywhere, with explicit `empty` /
 * `unavailable` / `lost` load outcomes and `persisted` / `unknown` save
 * outcomes. The localStorage adapter is transitional (retired by JUM-484,
 * no fallback) and stretches to fit that contract. The suite runs with no
 * DOM — the store itself never touches one.
 *
 * The wire format (key names, JSON payloads) is pinned by Requirement 126
 * Contract 2 and MUST NOT change in this refactor.
 */

const repoRoot = path.resolve(__dirname, '../../../../..');
const {
  IDesignerStore
} = require(path.join(repoRoot, 'apps', 'service-management', 'src', 'store', 'IDesignerStore.js'));
const {
  LOCAL_STORAGE_BASELINE_KEY,
  LOCAL_STORAGE_STATE_KEY,
  LocalStorageDesignerStore
} = require(path.join(repoRoot, 'apps', 'service-management', 'src', 'store', 'LocalStorageDesignerStore.js'));

type FakeStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  map: Map<string, string>;
};

function createFakeStorage(initial: Record<string, string> = {}): FakeStorage {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key: string) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key: string, value: string) => { map.set(key, String(value)); },
    removeItem: (key: string) => { map.delete(key); },
    map
  };
}

/**
 * Replace the ambient `localStorage` global with a throwing getter (some
 * browsing contexts throw on mere access) and return a restore function.
 */
function swapInThrowingLocalStorage(): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new Error('blocked'); }
  });
  return () => {
    if (descriptor) {
      Object.defineProperty(globalThis, 'localStorage', descriptor);
    } else {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  };
}

describe('designer store port contract (JUM-468)', () => {
  it('fails loudly when an adapter does not override a method', async () => {
    const port = new IDesignerStore();
    await expect(port.probe()).rejects.toThrow('IDesignerStore.probe()');
    await expect(port.load()).rejects.toThrow('IDesignerStore.load()');
    await expect(port.save({})).rejects.toThrow('IDesignerStore.save()');
    await expect(port.clear()).rejects.toThrow('IDesignerStore.clear()');
    await expect(port.loadBaseline()).rejects.toThrow('IDesignerStore.loadBaseline()');
    await expect(port.saveBaseline({})).rejects.toThrow('IDesignerStore.saveBaseline()');
    await expect(port.clearBaseline()).rejects.toThrow('IDesignerStore.clearBaseline()');
  });

  it('documents the Cana-shaped semantics the port must carry', () => {
    const source = require('node:fs').readFileSync(
      path.join(repoRoot, 'apps', 'service-management', 'src', 'store', 'IDesignerStore.js'),
      'utf-8'
    );
    // The four load outcomes and the two save outcomes are contract terms.
    ['\'ok\'', '\'empty\'', '\'unavailable\'', '\'lost\'', '\'persisted\'', '\'unknown\''].forEach((term) => {
      expect(source).toContain(term);
    });
    // The no-fallback decision and the transitional retirement are stated.
    expect(source).toContain('JUM-484');
  });
});

describe('local storage designer store (transitional, JUM-468)', () => {
  it('uses the pinned Requirement 126 Contract 2 keys by default', () => {
    expect(LOCAL_STORAGE_STATE_KEY).toBe('service-management.v1');
    expect(LOCAL_STORAGE_BASELINE_KEY).toBe('service-management.schema-baseline.v1');
    const storage = createFakeStorage();
    const store = new LocalStorageDesignerStore({ storage });
    expect(store.stateKey).toBe('service-management.v1');
    expect(store.baselineKey).toBe('service-management.schema-baseline.v1');
  });

  it('reports empty when nothing is stored — distinct from lost and unavailable', async () => {
    const store = new LocalStorageDesignerStore({ storage: createFakeStorage() });
    const result = await store.load();
    expect(result.status).toBe('empty');
    expect(result.payload).toBeNull();
  });

  it('round-trips a save through load with the wire format unchanged', async () => {
    const storage = createFakeStorage();
    const store = new LocalStorageDesignerStore({ storage });
    const payload = {
      domains: [{ id: 'domain-1', name: 'Billing', entities: [] }],
      relationships: [],
      selectedDomainId: 'domain-1',
      selectedEntityId: null,
      selectedRelationshipId: null,
      idCounter: 2,
      activeTab: 'domain-designer',
      interfaces: [],
      serviceConfiguration: { serviceKind: 'rest-api' },
      runtimeEnvironment: { environment: 'dev', fileName: '.env.dev', values: {} },
      deployments: [],
      view: { zoom: 1 }
    };
    const saveResult = await store.save(payload);
    expect(saveResult.status).toBe('persisted');
    // The exact pre-refactor wire format: one JSON.stringify under the pinned key.
    expect(storage.map.get('service-management.v1')).toBe(JSON.stringify(payload));
    const loadResult = await store.load();
    expect(loadResult.status).toBe('ok');
    expect(loadResult.payload).toStrictEqual(payload);
  });

  it('performs the save synchronously, preserving fire-and-forget callers', () => {
    const storage = createFakeStorage();
    const store = new LocalStorageDesignerStore({ storage });
    store.save({ domains: [] }); // not awaited on purpose
    expect(storage.map.has('service-management.v1')).toBe(true);
  });

  it('reports unavailable when the backend throws on read', async () => {
    const storage = createFakeStorage();
    storage.getItem = () => { throw new Error('SecurityError'); };
    const store = new LocalStorageDesignerStore({ storage });
    const result = await store.load();
    expect(result.status).toBe('unavailable');
    expect(result.payload).toBeNull();
    expect(result.reason).toContain('SecurityError');
  });

  it('reports unavailable when there is no storage backend at all', async () => {
    const store = new LocalStorageDesignerStore({ storage: null });
    expect((await store.probe()).status).toBe('unavailable');
    expect((await store.load()).status).toBe('unavailable');
  });

  it('reports lost — not empty — when a stored payload is unreadable', async () => {
    const storage = createFakeStorage({ 'service-management.v1': '{corrupted json' });
    const store = new LocalStorageDesignerStore({ storage });
    const result = await store.load();
    expect(result.status).toBe('lost');
    expect(result.payload).toBeNull();
    expect(result.status).not.toBe('empty');
  });

  it('probes available on a working backend and unavailable when writes throw', async () => {
    const working = new LocalStorageDesignerStore({ storage: createFakeStorage() });
    expect((await working.probe()).status).toBe('available');

    const throwing = createFakeStorage();
    throwing.setItem = () => { throw new Error('QuotaExceededError'); };
    const blocked = new LocalStorageDesignerStore({ storage: throwing });
    const probe = await blocked.probe();
    expect(probe.status).toBe('unavailable');
    expect(probe.reason).toContain('QuotaExceededError');
  });

  it('clears the state document so a later load reports empty', async () => {
    const storage = createFakeStorage();
    const store = new LocalStorageDesignerStore({ storage });
    await store.save({ domains: [] });
    const clearResult = await store.clear();
    expect(clearResult.status).toBe('persisted');
    expect((await store.load()).status).toBe('empty');
  });

  describe('schema-baseline key handling', () => {
    it('round-trips the baseline under the pinned baseline key', async () => {
      const storage = createFakeStorage();
      const store = new LocalStorageDesignerStore({ storage });
      const snapshot = {
        domains: [{
          id: 'domain-1', name: 'Billing', color: '#fff', context: {}, entities: []
        }],
        relationships: [{
          id: 'rel-1', fromEntityId: 'a', toEntityId: 'b', fromCardinality: 'N', toCardinality: '1'
        }]
      };
      expect((await store.saveBaseline(snapshot)).status).toBe('persisted');
      expect(storage.map.get('service-management.schema-baseline.v1')).toBe(JSON.stringify(snapshot));
      const loaded = await store.loadBaseline();
      expect(loaded.status).toBe('ok');
      expect(loaded.payload).toStrictEqual(snapshot);
    });

    it('reports empty when no baseline is stored and lost when it is unreadable', async () => {
      const storage = createFakeStorage();
      const store = new LocalStorageDesignerStore({ storage });
      expect((await store.loadBaseline()).status).toBe('empty');
      storage.map.set('service-management.schema-baseline.v1', 'not-json{');
      expect((await store.loadBaseline()).status).toBe('lost');
    });

    it('clears the baseline independently of the state document', async () => {
      const storage = createFakeStorage();
      const store = new LocalStorageDesignerStore({ storage });
      await store.save({ domains: [] });
      await store.saveBaseline({ domains: [], relationships: [] });
      expect((await store.clearBaseline()).status).toBe('persisted');
      expect((await store.loadBaseline()).status).toBe('empty');
      // The state document survives a baseline clear.
      expect((await store.load()).status).toBe('ok');
    });
  });

  describe('ambient storage resolution and failure shapes', () => {
    it('resolves the ambient localStorage when none is injected', async () => {
      const store = new LocalStorageDesignerStore();
      const ambient = (globalThis as { localStorage?: unknown }).localStorage;
      expect(store.storage).toBe(ambient);
      const probe = await store.probe();
      expect(['available', 'unavailable']).toContain(probe.status);
    });

    it('treats a throwing localStorage global as unavailable', async () => {
      const restore = swapInThrowingLocalStorage();
      try {
        const store = new LocalStorageDesignerStore();
        expect(store.storage).toBeUndefined();
        expect((await store.probe()).status).toBe('unavailable');
        expect((await store.load()).status).toBe('unavailable');
      } finally {
        restore();
      }
    });

    it('reports non-Error probe failures verbatim', async () => {
      const storage = createFakeStorage();
      const quotaError = 'quota-string' as unknown as Error;
      storage.setItem = () => { throw quotaError; };
      const store = new LocalStorageDesignerStore({ storage });
      const probe = await store.probe();
      expect(probe.status).toBe('unavailable');
      expect(probe.reason).toBe('quota-string');
    });

    it('treats an undefined read as empty, not as an error', async () => {
      const storage = createFakeStorage();
      storage.getItem = () => undefined as unknown as string | null;
      const store = new LocalStorageDesignerStore({ storage });
      expect((await store.load()).status).toBe('empty');
    });

    it('propagates setItem quota errors synchronously, as before the extraction', () => {
      const storage = createFakeStorage();
      storage.setItem = () => { throw new Error('QuotaExceededError'); };
      const store = new LocalStorageDesignerStore({ storage });
      expect(() => store.save({})).toThrow('QuotaExceededError');
      expect(() => store.saveBaseline({})).toThrow('QuotaExceededError');
    });
  });
});
