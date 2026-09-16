/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
import path from 'node:path';

/**
 * Unit suite for the `CanaDesignerStore` adapter (JUM-483) and the store
 * factory that makes it the SOLE designer store (JUM-484).
 *
 * What is real here and what is a double, and why (Requirements 109/115):
 *
 * - The ADAPTER under test is the real `CanaDesignerStore`; nothing about the
 *   IDesignerStore port is faked.
 * - The Cana client is a Jumentix-owned contract (packages/cana), so a
 *   declared in-memory double of it is the allowed test double. Every failure
 *   it raises is built with the REAL `canaError` constructor and the REAL
 *   taxonomy from `@jumentix/cana`, so the adapter's mapping is exercised
 *   against genuine Cana error shapes, not lookalikes.
 * - One suite drives the default provider against the REAL Cana module: in
 *   Node there is no `indexedDB` global, so the real engine's own terminal
 *   `'Unavailable'` rejection flows through the real adapter — an assertion
 *   no substitute engine can satisfy (Requirement 109).
 *
 * The wire format (record keys, JSON payloads) is pinned by Requirement 126
 * Contract 2 and MUST NOT change here.
 */

const repoRoot = path.resolve(__dirname, '../../../..');
const {
  IDesignerStore
} = require('@jumentix/designer-core/store/IDesignerStore.js');

const {
  CANA_BASELINE_KEY,
  CANA_DESIGNER_CLIENT_OPTIONS,
  CANA_STATE_KEY,
  CanaDesignerStore
} = require(path.join(repoRoot, 'apps', 'service-management', 'src', 'store', 'CanaDesignerStore.js'));
const {
  CANA_MODULE_SPECIFIER,
  createDesignerStore
} = require(path.join(repoRoot, 'apps', 'service-management', 'src', 'store', 'designerStoreFactory.js'));
const {
  canaError,
  createCanaDatabaseClient
  // The REAL Cana module (jest maps `@jumentix/cana` to packages/cana/src).
  // eslint-disable-next-line import/no-unresolved
} = require('@jumentix/cana');

type StorageStateScript = {
  persistent?: boolean | 'unknown';
  usageBytes?: number;
  quotaBytes?: number;
  nearQuota?: boolean;
  evicted?: boolean;
};

/**
 * Declared in-memory double of the Cana client contract the adapter consumes
 * (`open`, `table().get`, `transaction`, `storageState`). Scriptable failure
 * hooks raise only real `CanaError` values.
 */
function createCanaClientDouble(initial: Record<string, string> = {}) {
  const records = new Map<string, string>(Object.entries(initial));
  const script: {
    openError?: unknown;
    readError?: unknown;
    writeError?: unknown;
    transactionOutcome?: 'committed' | 'unknown';
    storageState?: StorageStateScript;
    opened: boolean;
    openAttempts: number;
  } = {
    storageState: { persistent: true, nearQuota: false, evicted: false },
    opened: false,
    openAttempts: 0
  };

  const client = {
    async open() {
      script.openAttempts += 1;
      if (script.openError !== undefined) throw script.openError;
      script.opened = true;
    },
    async close() {
      script.opened = false;
    },
    table(name: string) {
      return {
        name,
        async get(key: string) {
          if (script.readError !== undefined) throw script.readError;
          return records.has(key) ? records.get(key) : undefined;
        }
      };
    },
    async transaction(
      _mode: string,
      _stores: readonly string[],
      body: (scope: unknown) => Promise<unknown>
    ) {
      const scope = {
        table: () => ({
          async put(value: string, key: string) {
            if (script.writeError !== undefined) throw script.writeError;
            records.set(key, value);
            return { outcome: 'committed', events: [] };
          },
          async delete(key: string) {
            if (script.writeError !== undefined) throw script.writeError;
            records.delete(key);
            return { outcome: 'committed', events: [] };
          }
        }),
        abort: () => undefined
      };
      const result = await body(scope);
      return {
        outcome: script.transactionOutcome ?? 'committed',
        result,
        events: [],
        correlationId: 'cana-test-origin:1',
        attemptedAt: 1722000000000
      };
    },
    async storageState() {
      return {
        persistent: true, nearQuota: false, evicted: false, ...script.storageState
      };
    }
  };

  return { client, records, script };
}

const PINNED_PAYLOAD = {
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

describe('cana designer store — port identity (JUM-483)', () => {
  it('is an IDesignerStore that overrides all seven port methods', async () => {
    expect.hasAssertions();
    const { client } = createCanaClientDouble();
    const store = new CanaDesignerStore({ client });
    expect(store).toBeInstanceOf(IDesignerStore);
    await expect(store.probe()).resolves.toBeDefined();
    await expect(store.load()).resolves.toBeDefined();
    await expect(store.save({})).resolves.toBeDefined();
    await expect(store.clear()).resolves.toBeDefined();
    await expect(store.loadBaseline()).resolves.toBeDefined();
    await expect(store.saveBaseline({})).resolves.toBeDefined();
    await expect(store.clearBaseline()).resolves.toBeDefined();
  });

  it('pins the Requirement 126 Contract 2 record keys and database shape', () => {
    expect.hasAssertions();
    expect(CANA_STATE_KEY).toBe('service-management.v1');
    expect(CANA_BASELINE_KEY).toBe('service-management.schema-baseline.v1');
    expect(CANA_DESIGNER_CLIENT_OPTIONS.name).toBe('service-management');
    expect(CANA_DESIGNER_CLIENT_OPTIONS.schema.version).toBe(1);
    expect(CANA_DESIGNER_CLIENT_OPTIONS.schema.stores).toHaveLength(1);
  });
});

describe('cana designer store — happy path and wire format', () => {
  it('reports empty — not lost, not unavailable — on a first run', async () => {
    expect.hasAssertions();
    const { client } = createCanaClientDouble();
    const store = new CanaDesignerStore({ client });
    const result = await store.load();
    expect(result.status).toBe('empty');
    expect(result.payload).toBeNull();
    expect((await store.loadBaseline()).status).toBe('empty');
    expect((await store.probe()).status).toBe('available');
  });

  it('round-trips a save with the wire format unchanged', async () => {
    expect.hasAssertions();
    const { client, records } = createCanaClientDouble();
    const store = new CanaDesignerStore({ client });
    const saveResult = await store.save(PINNED_PAYLOAD);
    expect(saveResult.status).toBe('persisted');
    // Exactly one JSON.stringify of the same document, under the pinned key.
    expect(records.get('service-management.v1')).toBe(JSON.stringify(PINNED_PAYLOAD));
    const loadResult = await store.load();
    expect(loadResult.status).toBe('ok');
    expect(loadResult.payload).toStrictEqual(PINNED_PAYLOAD);
  });

  it('round-trips the baseline under the pinned baseline key', async () => {
    expect.hasAssertions();
    const { client, records } = createCanaClientDouble();
    const store = new CanaDesignerStore({ client });
    const snapshot = {
      domains: [
        {
          id: 'domain-1', name: 'Billing', color: '#fff', context: {}, entities: []
        }
      ],
      relationships: []
    };
    expect((await store.saveBaseline(snapshot)).status).toBe('persisted');
    expect(records.get('service-management.schema-baseline.v1')).toBe(JSON.stringify(snapshot));
    const loaded = await store.loadBaseline();
    expect(loaded.status).toBe('ok');
    expect(loaded.payload).toStrictEqual(snapshot);
  });

  it('clears the state document so a later load reports empty, independently of the baseline', async () => {
    expect.hasAssertions();
    const { client } = createCanaClientDouble();
    const store = new CanaDesignerStore({ client });
    await store.save(PINNED_PAYLOAD);
    await store.saveBaseline({ domains: [], relationships: [] });
    expect((await store.clear()).status).toBe('persisted');
    expect((await store.load()).status).toBe('empty');
    // The baseline survives a state clear, and vice versa.
    expect((await store.loadBaseline()).status).toBe('ok');
    expect((await store.clearBaseline()).status).toBe('persisted');
    expect((await store.loadBaseline()).status).toBe('empty');
  });

  it('throws synchronously for an unserializable payload — the port’s programmer-error escape', () => {
    expect.hasAssertions();
    const { client } = createCanaClientDouble();
    const store = new CanaDesignerStore({ client });
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => store.save(circular)).toThrow(/circular|cyclic/i);
    expect(() => store.saveBaseline(circular)).toThrow(/circular|cyclic/i);
  });
});

describe('cana designer store — unavailable (no usable IndexedDB / not wired)', () => {
  it('reports unavailable when Cana open rejects with the real Unavailable error', async () => {
    expect.hasAssertions();
    const { client, script } = createCanaClientDouble();
    script.openError = canaError(
      'Unavailable',
      'No usable IndexedDB in this environment. Private browsing or an unsupported browser.'
    );
    const store = new CanaDesignerStore({ client });
    const probe = await store.probe();
    expect(probe.status).toBe('unavailable');
    expect(probe.reason).toContain('Unavailable');
    expect((await store.load()).status).toBe('unavailable');
    expect((await store.loadBaseline()).status).toBe('unavailable');
  });

  it('never reports a save against an unavailable backend as persisted', async () => {
    expect.hasAssertions();
    const { client, records, script } = createCanaClientDouble();
    script.openError = canaError('Unavailable', 'No usable IndexedDB in this environment.');
    const store = new CanaDesignerStore({ client });
    const saveResult = await store.save(PINNED_PAYLOAD);
    expect(saveResult.status).toBe('unknown');
    expect(saveResult.status).not.toBe('persisted');
    expect(saveResult.reason).toContain('unavailable');
    expect(records.has('service-management.v1')).toBe(false);
    expect((await store.clear()).status).toBe('unknown');
  });

  it('reports unavailable when no client and no provider are wired — never a silent fallback', async () => {
    expect.hasAssertions();
    const store = new CanaDesignerStore();
    const probe = await store.probe();
    expect(probe.status).toBe('unavailable');
    expect(probe.reason).toContain('no Cana client is wired');
    expect((await store.load()).status).toBe('unavailable');
    expect((await store.save({})).status).toBe('unknown');
  });

  it('does not cache a failed open — a later attempt retries and can recover', async () => {
    expect.hasAssertions();
    const { client, script } = createCanaClientDouble();
    script.openError = canaError('UpgradeBlocked', 'Blocked by another connection.', {});
    const store = new CanaDesignerStore({ client });
    expect((await store.probe()).status).toBe('unavailable');
    script.openError = undefined;
    expect((await store.probe()).status).toBe('available');
    expect(script.openAttempts).toBe(2);
  });
});

describe('cana designer store — lost (eviction and corruption), never empty', () => {
  it('reports lost — not empty — when the record is gone and Cana flags eviction', async () => {
    expect.hasAssertions();
    const { client, script } = createCanaClientDouble();
    script.storageState = { evicted: true };
    const store = new CanaDesignerStore({ client });
    const result = await store.load();
    expect(result.status).toBe('lost');
    expect(result.status).not.toBe('empty');
    expect(result.reason).toContain('evicted');
    expect((await store.probe()).status).toBe('lost');
    expect((await store.loadBaseline()).status).toBe('lost');
  });

  it('loads a record found after an eviction open — re-saved data is real data', async () => {
    expect.hasAssertions();
    const { client, script } = createCanaClientDouble({
      'service-management.v1': JSON.stringify(PINNED_PAYLOAD)
    });
    script.storageState = { evicted: true };
    const store = new CanaDesignerStore({ client });
    const result = await store.load();
    expect(result.status).toBe('ok');
    expect(result.payload).toStrictEqual(PINNED_PAYLOAD);
  });

  it('reports lost when a stored payload is unreadable JSON', async () => {
    expect.hasAssertions();
    const { client } = createCanaClientDouble({ 'service-management.v1': '{corrupted json' });
    const store = new CanaDesignerStore({ client });
    const result = await store.load();
    expect(result.status).toBe('lost');
    expect(result.status).not.toBe('empty');
  });

  it('maps a read rejected with the real Evicted error to lost', async () => {
    expect.hasAssertions();
    const { client, script } = createCanaClientDouble();
    script.readError = canaError('Evicted', 'The database that held this data is gone.');
    const store = new CanaDesignerStore({ client });
    expect((await store.load()).status).toBe('lost');
  });

  it('maps an unclassified read failure to unavailable, not lost', async () => {
    expect.hasAssertions();
    const { client, script } = createCanaClientDouble();
    script.readError = canaError('Internal', 'Engine fault.');
    const store = new CanaDesignerStore({ client });
    const result = await store.load();
    expect(result.status).toBe('unavailable');
    expect(result.reason).toContain('Internal');
  });
});

describe('cana designer store — quota and unknown outcomes, surfaced distinctly', () => {
  it('reports a quota-rejected write as unknown with a quota reason — never persisted', async () => {
    expect.hasAssertions();
    const { client, records, script } = createCanaClientDouble();
    script.writeError = canaError('QuotaExceeded', 'The origin’s storage budget is exhausted.');
    const store = new CanaDesignerStore({ client });
    const saveResult = await store.save(PINNED_PAYLOAD);
    expect(saveResult.status).toBe('unknown');
    expect(saveResult.status).not.toBe('persisted');
    expect(saveResult.reason).toContain('quota:');
    expect(records.has('service-management.v1')).toBe(false);
  });

  it('surfaces quota pressure at probe as available-with-diagnostic, distinct from hard failure', async () => {
    expect.hasAssertions();
    const { client, script } = createCanaClientDouble();
    script.storageState = {
      persistent: false, nearQuota: true, usageBytes: 900, quotaBytes: 1000, evicted: false
    };
    const store = new CanaDesignerStore({ client });
    const probe = await store.probe();
    expect(probe.status).toBe('available');
    expect(probe.reason).toContain('quota:');
  });

  it('reports quota pressure without byte counters when storage omits estimates', async () => {
    expect.hasAssertions();
    const { client, script } = createCanaClientDouble();
    script.storageState = { nearQuota: true, evicted: false };
    const store = new CanaDesignerStore({ client });
    const probe = await store.probe();
    expect(probe.status).toBe('available');
    expect(probe.reason).toContain('near the origin quota;');
    expect(probe.reason).not.toContain('bytes');
  });

  it('surfaces non-persistent storage at probe as a durability diagnostic', async () => {
    expect.hasAssertions();
    const { client, script } = createCanaClientDouble();
    script.storageState = { persistent: false, nearQuota: false, evicted: false };
    const store = new CanaDesignerStore({ client });
    const probe = await store.probe();
    expect(probe.status).toBe('available');
    expect(probe.reason).toContain('durability:');
  });

  it('reports an indeterminate transaction as unknown, carrying the reconciliation handles', async () => {
    expect.hasAssertions();
    const { client, script } = createCanaClientDouble();
    script.transactionOutcome = 'unknown';
    const store = new CanaDesignerStore({ client });
    const saveResult = await store.save(PINNED_PAYLOAD);
    expect(saveResult.status).toBe('unknown');
    expect(saveResult.reason).toContain('unknown-outcome:');
    // The handles client.resolveWrite() needs (Cana JUM-411/559).
    expect(saveResult.reason).toContain('cana-test-origin:1');
    expect(saveResult.reason).toContain('1722000000000');
    const clearResult = await store.clear();
    expect(clearResult.status).toBe('unknown');
    expect(clearResult.reason).toContain('unknown-outcome:');
  });

  it('reports indeterminate transactions even when Cana omits reconciliation handles', async () => {
    expect.hasAssertions();
    const { client, script } = createCanaClientDouble();
    script.transactionOutcome = 'unknown';
    const withoutHandles = {
      ...client,
      async transaction(
        mode: string,
        stores: readonly string[],
        body: (scope: unknown) => Promise<unknown>
      ) {
        await client.transaction(mode, stores, body);
        return { outcome: 'unknown', events: [] };
      }
    };
    const store = new CanaDesignerStore({ client: withoutHandles });
    const saveResult = await store.save(PINNED_PAYLOAD);
    const clearResult = await store.clear();
    expect(saveResult.status).toBe('unknown');
    expect(saveResult.reason).not.toContain('correlationId');
    expect(clearResult.status).toBe('unknown');
    expect(clearResult.reason).not.toContain('correlationId');
  });

  it('tags an evicted-mid-write failure distinctly from a quota failure', async () => {
    expect.hasAssertions();
    const { client, script } = createCanaClientDouble();
    script.writeError = canaError('Evicted', 'The database was reclaimed mid-session.');
    const store = new CanaDesignerStore({ client });
    const saveResult = await store.save(PINNED_PAYLOAD);
    expect(saveResult.status).toBe('unknown');
    expect(saveResult.reason).toContain('evicted:');
  });

  it('tags unavailable and unknown-outcome write rejections distinctly', async () => {
    expect.hasAssertions();
    const { client, script } = createCanaClientDouble();
    const store = new CanaDesignerStore({ client });
    script.writeError = canaError('Unavailable', 'The backend vanished mid-session.');
    expect((await store.save(PINNED_PAYLOAD)).reason).toContain('unavailable:');
    script.writeError = canaError('UnknownOutcome', 'The worker died after dispatch.');
    expect((await store.save(PINNED_PAYLOAD)).reason).toContain('unknown-outcome:');
    script.writeError = canaError('Internal', 'Engine fault.');
    expect((await store.save(PINNED_PAYLOAD)).reason).toContain('Internal');
    script.writeError = new Error('foreign failure');
    expect((await store.save(PINNED_PAYLOAD)).reason).toContain('foreign failure');
  });

  it('stringifies thrown values that carry no message', async () => {
    expect.hasAssertions();
    const { client, script } = createCanaClientDouble();
    script.writeError = 0;
    const store = new CanaDesignerStore({ client });
    const saveResult = await store.save(PINNED_PAYLOAD);
    expect(saveResult.status).toBe('unknown');
    expect(saveResult.reason).toBe('0');
  });

  it('applies the same write-failure mapping to clear and clearBaseline', async () => {
    expect.hasAssertions();
    const { client, script } = createCanaClientDouble({ 'service-management.v1': '{}' });
    const store = new CanaDesignerStore({ client });
    script.writeError = canaError('QuotaExceeded', 'Budget exhausted.');
    const clearResult = await store.clear();
    expect(clearResult.status).toBe('unknown');
    expect(clearResult.reason).toContain('quota:');
    expect((await store.clearBaseline()).status).toBe('unknown');
  });

  it('still probes available when the durability state cannot be read', async () => {
    expect.hasAssertions();
    const { client } = createCanaClientDouble();
    const throwing = {
      ...client,
      async storageState() {
        throw canaError('Internal', 'navigator.storage rejected.');
      }
    };
    const store = new CanaDesignerStore({ client: throwing });
    expect((await store.probe()).status).toBe('available');
    // And a missing record with an unreadable durability state is empty, not lost.
    expect((await store.load()).status).toBe('empty');
  });
});

describe('designer store factory — Cana is the sole store (JUM-484)', () => {
  it('always builds the Cana adapter — there is no driver selection left', () => {
    expect.hasAssertions();
    // JUM-484 retired the transitional LocalStorageDesignerStore and removed
    // every localStorage path: no default, no explicit argument, no ambient
    // global, no URL parameter (decision 2026-07-29 — no fallback at all).
    expect(createDesignerStore()).toBeInstanceOf(CanaDesignerStore);
  });

  it('ignores the retired selection inputs rather than honouring them', () => {
    expect.hasAssertions();
    const globalKey = 'JUMENTIX_DESIGNER_STORE_DRIVER';
    try {
      (globalThis as Record<string, unknown>)[globalKey] = 'localstorage';
      Object.defineProperty(globalThis, 'location', {
        configurable: true,
        writable: true,
        value: { search: '?designer-store=localstorage' }
      });
      // Even with every retired escape hatch set to localstorage, the factory
      // still returns the Cana store: selected-localstorage is not a state
      // the designer can boot into anymore.
      expect(createDesignerStore()).toBeInstanceOf(CanaDesignerStore);
    } finally {
      delete (globalThis as Record<string, unknown>)[globalKey];
      delete (globalThis as Record<string, unknown>).location;
    }
  });

  it('builds the Cana adapter over an injected CanaDatabaseClient-shaped factory', async () => {
    expect.hasAssertions();
    const { client, records } = createCanaClientDouble();
    const store = createDesignerStore({
      // The injection convention mirrors buildDatabaseClientCompilers: the
      // factory may return a CanaDatabaseClient (`.cana` is used) or a bare client.
      indexedDbClient: () => ({ cana: client })
    });
    expect(store).toBeInstanceOf(CanaDesignerStore);
    expect((await store.save(PINNED_PAYLOAD)).status).toBe('persisted');
    expect(records.get('service-management.v1')).toBe(JSON.stringify(PINNED_PAYLOAD));
    expect((await store.load()).status).toBe('ok');
  });

  it('builds the Cana adapter over a bare injected client as well', async () => {
    expect.hasAssertions();
    const { client } = createCanaClientDouble();
    const store = createDesignerStore({ indexedDbClient: () => client });
    expect(store).toBeInstanceOf(CanaDesignerStore);
    expect((await store.probe()).status).toBe('available');
  });

  it('uses the default module specifier for the lazy provider', () => {
    expect.hasAssertions();
    expect(CANA_MODULE_SPECIFIER).toBe('@jumentix/cana');
  });
});

describe('cana designer store — real Cana module detection (Requirement 109)', () => {
  it('resolves the real @jumentix/cana module with the adapter entry points', () => {
    expect.hasAssertions();
    expect(typeof createCanaDatabaseClient).toBe('function');
    expect(typeof canaError).toBe('function');
    const database = createCanaDatabaseClient(CANA_DESIGNER_CLIENT_OPTIONS);
    // Cana-owned surface no substitute would carry: the full client on `.cana`
    // with crash-reconciliation (`resolveWrite`) and durability assessment.
    expect(typeof database.cana.resolveWrite).toBe('function');
    expect(typeof database.cana.open).toBe('function');
    expect(database.stores).toHaveProperty(CANA_DESIGNER_CLIENT_OPTIONS.schema.stores[0].name);
  });

  it('drives the default provider against the real engine: no indexedDB in Node → unavailable', async () => {
    expect.hasAssertions();
    // The REAL Cana client is built and opened here. In Node there is no
    // `indexedDB` global, so the engine's own terminal `Unavailable` rejection
    // must flow through the real adapter — a fake engine cannot produce it.
    const store = createDesignerStore();
    expect(store).toBeInstanceOf(CanaDesignerStore);
    const probe = await store.probe();
    expect(probe.status).toBe('unavailable');
    expect(probe.reason).toContain('Unavailable');
    expect(probe.reason).toContain('IndexedDB');
    const load = await store.load();
    expect(load.status).toBe('unavailable');
    // And the save path never claims durability it does not have.
    expect((await store.save({})).status).toBe('unknown');
  });
});
