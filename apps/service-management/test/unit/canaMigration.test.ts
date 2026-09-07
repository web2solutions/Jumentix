/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects, jest/no-conditional-in-test */
import fs from 'node:fs';
import path from 'node:path';

/**
 * Unit suite for the ONE-WAY migration of `service-management.v1` from
 * localStorage to Cana (JUM-484) and for the declared storage-environment
 * states the no-fallback decision (2026-07-29) makes mandatory.
 *
 * What is real here and what is a double, and why (Requirements 109/115):
 *
 * - The MIGRATION under test is the real `canaMigration.js`; nothing about
 *   its flow is faked.
 * - The legacy backend is a declared Map-backed localStorage double (the
 *   suite runs with no DOM — the module under test never touches one).
 * - The migration target is a declared port-level store double: the port is
 *   the boundary the migration writes through, and CanaDesignerStore's own
 *   behaviour is pinned by `canaDesignerStore.test.ts`. Scriptable hooks
 *   force the failure shapes the migration must survive (write rejection,
 *   read-back mismatch, missing client for the provenance record).
 *
 * The wire format (key names, JSON payloads) is pinned by Requirement 126
 * Contract 2 and MUST NOT change here.
 */

const repoRoot = path.resolve(__dirname, '../../../..');
const {
  CANA_MIGRATION_MARKER_KEY,
  CANA_MIGRATION_RECORD_KEY,
  CANA_MIGRATION_RECORD_VERSION,
  CANA_MIGRATION_SOURCE_BASELINE_KEY,
  CANA_MIGRATION_SOURCE_RETENTION_DAYS,
  CANA_MIGRATION_SOURCE_STATE_KEY,
  describeDesignerStorageEnvironment,
  describeLoadTimeDataLoss,
  migrateLocalStorageToCana,
  readRetainedMigrationSource
} = require(path.join(repoRoot, 'apps', 'service-management', 'src', 'store', 'canaMigration.js'));
const {
  CANA_MODULE_SPECIFIER
} = require(path.join(repoRoot, 'apps', 'service-management', 'src', 'store', 'designerStoreFactory.js'));

const FIXED_NOW = new Date('2026-08-01T12:00:00.000Z');
const now = () => new Date(FIXED_NOW.getTime());

type FakeStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  map: Map<string, string>;
};

function createFakeStorage(initial: Record<string, string> = {}): FakeStorage {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
    map
  };
}

type StoreScript = {
  saveError?: string;
  baselineSaveError?: string;
  tamperLoad?: (raw: string) => string;
  tamperBaselineLoad?: (raw: string) => string;
  noClient?: boolean;
  openError?: string;
};

/**
 * Declared port-level double of the migration target. Records are keyed by
 * the pinned wire keys, exactly like the Cana object store; `events` tracks
 * operation order so the export-before-migrate guarantee is assertable.
 */
function createStoreStub(initial: Record<string, string> = {}) {
  const records = new Map<string, string>(Object.entries(initial));
  const events: string[] = [];
  const script: StoreScript = {};
  const stateKey = CANA_MIGRATION_SOURCE_STATE_KEY;
  const baselineKey = CANA_MIGRATION_SOURCE_BASELINE_KEY;
  async function ensureOpenImpl() {
    if (script.openError) return { ok: false, reason: script.openError };
    return { ok: true };
  }
  const clientImpl = {
    async transaction(
      _mode: string,
      _stores: readonly string[],
      body: (scope: unknown) => Promise<unknown>
    ) {
      const scope = {
        table: () => ({
          async put(value: string, key: string) {
            records.set(key, value);
          }
        })
      };
      const result = await body(scope);
      return { outcome: 'committed', result };
    }
  };
  const store = {
    stateKey,
    baselineKey,
    storeName: 'designerDocuments',
    async save(payload: unknown) {
      events.push('save');
      if (script.saveError) return { status: 'unknown', reason: script.saveError };
      records.set(stateKey, JSON.stringify(payload));
      return { status: 'persisted' };
    },
    async load() {
      events.push('load');
      const raw = records.get(stateKey);
      if (raw === undefined) return { status: 'empty', payload: null };
      return { status: 'ok', payload: JSON.parse(script.tamperLoad ? script.tamperLoad(raw) : raw) };
    },
    async saveBaseline(snapshot: unknown) {
      events.push('saveBaseline');
      if (script.baselineSaveError) return { status: 'unknown', reason: script.baselineSaveError };
      records.set(baselineKey, JSON.stringify(snapshot));
      return { status: 'persisted' };
    },
    async loadBaseline() {
      events.push('loadBaseline');
      const raw = records.get(baselineKey);
      if (raw === undefined) return { status: 'empty', payload: null };
      return {
        status: 'ok',
        payload: JSON.parse(script.tamperBaselineLoad ? script.tamperBaselineLoad(raw) : raw)
      };
    }
  };
  // A port stub CAN lack the Cana-specific escape hatches — the provenance
  // record is best-effort and must degrade to `migrationRecordPersisted:
  // false` rather than fail the migration.
  Object.defineProperty(store, 'ensureOpen', {
    configurable: true,
    get() { return script.noClient ? undefined : ensureOpenImpl; }
  });
  Object.defineProperty(store, 'client', {
    configurable: true,
    get() { return script.noClient ? undefined : clientImpl; }
  });
  return {
    store, records, events, script
  };
}

const PINNED_PAYLOAD = {
  domains: [{ id: 'domain-1', name: 'Billing', entities: [{ id: 'entity-1', name: 'Invoice', fields: [] }] }],
  relationships: [],
  selectedDomainId: 'domain-1',
  selectedEntityId: null,
  selectedRelationshipId: null,
  idCounter: 2,
  activeTab: 'deploy-management',
  interfaces: [{ id: 'iface-1', name: 'BillingApi' }],
  serviceConfiguration: { serviceKind: 'rest-api' },
  runtimeEnvironment: { environment: 'dev', fileName: '.env.dev', values: {} },
  deployments: [{ name: 'aws-ec2', deployTarget: 'vm' }],
  view: { zoom: 1.25 }
};

const PINNED_BASELINE = {
  domains: [{
    id: 'domain-1', name: 'Billing', color: '#fff', context: {}, entities: []
  }],
  relationships: []
};

function seededStorage(overrides: Record<string, string> = {}): FakeStorage {
  return createFakeStorage({
    [CANA_MIGRATION_SOURCE_STATE_KEY]: JSON.stringify(PINNED_PAYLOAD),
    [CANA_MIGRATION_SOURCE_BASELINE_KEY]: JSON.stringify(PINNED_BASELINE),
    ...overrides
  });
}

describe('cana migration — pinned constants (Requirement 126 Contract 2)', () => {
  it('keeps the source keys, marker, record and retention pinned', () => {
    expect.hasAssertions();
    expect(CANA_MIGRATION_SOURCE_STATE_KEY).toBe('service-management.v1');
    expect(CANA_MIGRATION_SOURCE_BASELINE_KEY).toBe('service-management.schema-baseline.v1');
    expect(CANA_MIGRATION_MARKER_KEY).toBe('service-management.v1.cana-migration');
    expect(CANA_MIGRATION_RECORD_KEY).toBe('service-management.migration.v1');
    expect(CANA_MIGRATION_RECORD_VERSION).toBe(1);
    expect(CANA_MIGRATION_SOURCE_RETENTION_DAYS).toBe(30);
  });
});

describe('cana migration — no source', () => {
  it('reports no-source when the legacy payload is absent', async () => {
    expect.hasAssertions();
    const { store } = createStoreStub();
    const result = await migrateLocalStorageToCana({ storage: createFakeStorage(), store, now });
    expect(result.status).toBe('no-source');
  });

  it('reports no-source with a reason when there is no storage backend at all', async () => {
    expect.hasAssertions();
    const { store } = createStoreStub();
    const result = await migrateLocalStorageToCana({ storage: null, store, now });
    expect(result.status).toBe('no-source');
    expect(result.reason).toContain('localStorage');
  });

  it('reports no-source with the cause when the backend throws on read', async () => {
    expect.hasAssertions();
    const storage = createFakeStorage();
    storage.getItem = () => { throw new Error('SecurityError'); };
    const { store } = createStoreStub();
    const result = await migrateLocalStorageToCana({ storage, store, now });
    expect(result.status).toBe('no-source');
    expect(result.reason).toContain('SecurityError');
  });
});

describe('cana migration — verified happy path', () => {
  it('migrates the payload byte-exact, carries the baseline, retains the source', async () => {
    expect.hasAssertions();
    const storage = seededStorage();
    const { store, records } = createStoreStub();
    const backups: Array<[string, string]> = [];
    const result = await migrateLocalStorageToCana({
      storage,
      store,
      now,
      downloadBackup: (fileName: string, raw: string) => backups.push([fileName, raw])
    });

    expect(result.status).toBe('migrated');
    expect(result.verified).toBe(true);
    expect(result.baselineMigrated).toBe(true);
    expect(result.sourceRetained).toBe(true);
    expect(result.migrationRecordPersisted).toBe(true);
    expect(result.markerPersisted).toBe(true);

    // The wire format does not change: the Cana records are the exact
    // JSON.stringify of the same documents under the pinned keys.
    expect(records.get(CANA_MIGRATION_SOURCE_STATE_KEY)).toBe(JSON.stringify(PINNED_PAYLOAD));
    expect(records.get(CANA_MIGRATION_SOURCE_BASELINE_KEY)).toBe(JSON.stringify(PINNED_BASELINE));

    // One-way: the source stays in localStorage, unused, for the retention
    // period — a manual recovery path, never a fallback.
    expect(storage.map.get(CANA_MIGRATION_SOURCE_STATE_KEY)).toBe(JSON.stringify(PINNED_PAYLOAD));
    expect(storage.map.get(CANA_MIGRATION_SOURCE_BASELINE_KEY))
      .toBe(JSON.stringify(PINNED_BASELINE));

    // The verified marker carries the retention window.
    const marker = JSON.parse(storage.map.get(CANA_MIGRATION_MARKER_KEY) as string);
    expect(marker.status).toBe('verified');
    expect(marker.migratedAt).toBe(FIXED_NOW.toISOString());
    const expectedRetention = FIXED_NOW.getTime() + CANA_MIGRATION_SOURCE_RETENTION_DAYS * 86400000;
    expect(Date.parse(marker.sourceRetainedUntil)).toBe(expectedRetention);

    // Schema versioning in Cana from the first write: the provenance record.
    const record = JSON.parse(records.get(CANA_MIGRATION_RECORD_KEY) as string);
    expect(record.version).toBe(CANA_MIGRATION_RECORD_VERSION);
    expect(record.source).toBe('localstorage');
    expect(record.verified).toBe(true);
    expect(record.baselineMigrated).toBe(true);
    expect(record.migratedAt).toBe(FIXED_NOW.toISOString());

    // Export before migrate: the backup is the verbatim source payload.
    expect(backups).toHaveLength(1);
    expect(backups[0][0]).toMatch(/^service-management-v1-backup-.*\.json$/);
    expect(backups[0][1]).toBe(JSON.stringify(PINNED_PAYLOAD));
  });

  it('produces the backup BEFORE the first store write', async () => {
    expect.hasAssertions();
    const order: string[] = [];
    const { store, events } = createStoreStub();
    await migrateLocalStorageToCana({
      storage: seededStorage(),
      store,
      now,
      downloadBackup: () => order.push('backup')
    });
    expect(order[0]).toBe('backup');
    expect(events[0]).toBe('save');
  });

  it('migrates without a download hook (the backup is surfaced by the host, not required)', async () => {
    expect.hasAssertions();
    const { store } = createStoreStub();
    const result = await migrateLocalStorageToCana({ storage: seededStorage(), store, now });
    expect(result.status).toBe('migrated');
    expect(result.backupFileName).toMatch(/^service-management-v1-backup-.*\.json$/);
  });

  it('leaves an absent baseline absent — never fabricated', async () => {
    expect.hasAssertions();
    const storage = createFakeStorage({
      [CANA_MIGRATION_SOURCE_STATE_KEY]: JSON.stringify(PINNED_PAYLOAD)
    });
    const { store, records } = createStoreStub();
    const result = await migrateLocalStorageToCana({ storage, store, now });
    expect(result.status).toBe('migrated');
    expect(result.baselineMigrated).toBe(false);
    expect(records.has(CANA_MIGRATION_SOURCE_BASELINE_KEY)).toBe(false);
  });

  it('notes a corrupt baseline but still migrates the state payload', async () => {
    expect.hasAssertions();
    const storage = seededStorage({ [CANA_MIGRATION_SOURCE_BASELINE_KEY]: '{corrupt baseline' });
    const { store, records } = createStoreStub();
    const result = await migrateLocalStorageToCana({ storage, store, now });
    expect(result.status).toBe('migrated');
    expect(result.baselineMigrated).toBe(false);
    expect(result.baselineNote).toContain('baseline-lost');
    expect(records.get(CANA_MIGRATION_SOURCE_STATE_KEY)).toBe(JSON.stringify(PINNED_PAYLOAD));
  });

  it('honours key overrides (tests, future key versions)', async () => {
    expect.hasAssertions();
    const storage = createFakeStorage({ 'legacy.state': JSON.stringify(PINNED_PAYLOAD) });
    const { store, records } = createStoreStub();
    const result = await migrateLocalStorageToCana({
      storage, store, now, stateKey: 'legacy.state', baselineKey: 'legacy.baseline'
    });
    expect(result.status).toBe('migrated');
    expect(records.get(CANA_MIGRATION_SOURCE_STATE_KEY)).toBe(JSON.stringify(PINNED_PAYLOAD));
  });
});

describe('cana migration — declared failures, source always preserved', () => {
  it('fails on a corrupt source without writing anything anywhere', async () => {
    expect.hasAssertions();
    const storage = createFakeStorage({ [CANA_MIGRATION_SOURCE_STATE_KEY]: '{corrupted json' });
    const { store, records, events } = createStoreStub();
    let backups = 0;
    const result = await migrateLocalStorageToCana({
      storage, store, now, downloadBackup: () => { backups += 1; }
    });
    expect(result.status).toBe('failed');
    expect(result.reason).toContain('corrupt-source');
    // Nothing written, nothing deleted: the corrupt payload remains manually
    // recoverable and the migration never claims it.
    expect(events).toStrictEqual([]);
    expect(records.size).toBe(0);
    expect(backups).toBe(0);
    expect(storage.map.get(CANA_MIGRATION_SOURCE_STATE_KEY)).toBe('{corrupted json');
    expect(storage.map.has(CANA_MIGRATION_MARKER_KEY)).toBe(false);
  });

  it('fails when the Cana write rejects, and the re-run succeeds — idempotent', async () => {
    expect.hasAssertions();
    const storage = seededStorage();
    const { store, records, script } = createStoreStub();
    script.saveError = 'quota: QuotaExceededError';
    const first = await migrateLocalStorageToCana({ storage, store, now });
    expect(first.status).toBe('failed');
    expect(first.reason).toContain('save-failed');
    expect(first.reason).toContain('quota');
    expect(storage.map.has(CANA_MIGRATION_MARKER_KEY)).toBe(false);
    expect(storage.map.get(CANA_MIGRATION_SOURCE_STATE_KEY)).toBe(JSON.stringify(PINNED_PAYLOAD));

    // Interrupted migrations are safe to re-run: same result, no duplication.
    script.saveError = undefined;
    const second = await migrateLocalStorageToCana({ storage, store, now });
    expect(second.status).toBe('migrated');
    expect(records.get(CANA_MIGRATION_SOURCE_STATE_KEY)).toBe(JSON.stringify(PINNED_PAYLOAD));
    expect(records.size).toBe(3); // state + baseline + provenance record
  });

  it('fails when the baseline write rejects, preserving the source', async () => {
    expect.hasAssertions();
    const storage = seededStorage();
    const { store, script } = createStoreStub();
    script.baselineSaveError = 'unknown-outcome: worker crashed';
    const result = await migrateLocalStorageToCana({ storage, store, now });
    expect(result.status).toBe('failed');
    expect(result.reason).toContain('save-failed');
    expect(storage.map.has(CANA_MIGRATION_MARKER_KEY)).toBe(false);
    expect(storage.map.get(CANA_MIGRATION_SOURCE_STATE_KEY)).toBe(JSON.stringify(PINNED_PAYLOAD));
  });

  it('fails cutover when the read-back does not match the source — verify before cutover', async () => {
    expect.hasAssertions();
    const storage = seededStorage();
    const { store, script } = createStoreStub();
    script.tamperLoad = (raw: string) => JSON.stringify({ ...JSON.parse(raw), idCounter: 999 });
    const result = await migrateLocalStorageToCana({ storage, store, now });
    expect(result.status).toBe('failed');
    expect(result.reason).toContain('verification-mismatch');
    expect(storage.map.has(CANA_MIGRATION_MARKER_KEY)).toBe(false);
    expect(storage.map.get(CANA_MIGRATION_SOURCE_STATE_KEY)).toBe(JSON.stringify(PINNED_PAYLOAD));
  });

  it('fails cutover when the baseline read-back does not match', async () => {
    expect.hasAssertions();
    const storage = seededStorage();
    const { store, script } = createStoreStub();
    script.tamperBaselineLoad = () => JSON.stringify({ domains: [], relationships: [] });
    const result = await migrateLocalStorageToCana({ storage, store, now });
    expect(result.status).toBe('failed');
    expect(result.reason).toContain('verification-mismatch');
    expect(storage.map.has(CANA_MIGRATION_MARKER_KEY)).toBe(false);
  });

  it('fails cutover when the read-back finds nothing (unavailable backend)', async () => {
    expect.hasAssertions();
    const storage = seededStorage();
    const { store } = createStoreStub();
    // A load that reports empty after a persisted save is a verification
    // failure, never a silent cutover.
    store.load = async () => ({ status: 'empty', payload: null });
    const result = await migrateLocalStorageToCana({ storage, store, now });
    expect(result.status).toBe('failed');
    expect(result.reason).toContain('verification-mismatch');
    expect(result.reason).toContain('empty');
  });

  it('degrades the provenance record, never the migration, when no Cana client is reachable', async () => {
    expect.hasAssertions();
    const storage = seededStorage();
    const { store, records, script } = createStoreStub();
    script.noClient = true;
    const result = await migrateLocalStorageToCana({ storage, store, now });
    expect(result.status).toBe('migrated');
    expect(result.migrationRecordPersisted).toBe(false);
    expect(records.has(CANA_MIGRATION_RECORD_KEY)).toBe(false);
    expect(records.get(CANA_MIGRATION_SOURCE_STATE_KEY)).toBe(JSON.stringify(PINNED_PAYLOAD));
  });
});

describe('cana migration — idempotence and retention', () => {
  it('short-circuits a verified marker: already-migrated, no second backup, no rewrite', async () => {
    expect.hasAssertions();
    const storage = seededStorage();
    const { store, records } = createStoreStub();
    const first = await migrateLocalStorageToCana({ storage, store, now });
    expect(first.status).toBe('migrated');

    let backups = 0;
    const eventsBefore = records.size;
    const second = await migrateLocalStorageToCana({
      storage, store, now, downloadBackup: () => { backups += 1; }
    });
    expect(second.status).toBe('already-migrated');
    expect(second.sourceRetained).toBe(true);
    expect(second.migratedAt).toBe(FIXED_NOW.toISOString());
    expect(backups).toBe(0);
    expect(records.size).toBe(eventsBefore);
  });

  it('recovers from a crash after the Cana write but before the marker — same result, no duplication', async () => {
    expect.hasAssertions();
    const storage = seededStorage();
    const originalSetItem = storage.setItem;
    storage.setItem = (key, value) => {
      if (key === CANA_MIGRATION_MARKER_KEY) throw new Error('tab killed');
      originalSetItem(key, value);
    };
    const { store, records } = createStoreStub();
    const interrupted = await migrateLocalStorageToCana({ storage, store, now });
    expect(interrupted.status).toBe('migrated');
    expect(interrupted.markerPersisted).toBe(false);

    // Next boot: no marker, source still present → re-run lands the same end state.
    storage.setItem = originalSetItem;
    const rerun = await migrateLocalStorageToCana({ storage, store, now });
    expect(rerun.status).toBe('migrated');
    expect(rerun.markerPersisted).toBe(true);
    expect(records.get(CANA_MIGRATION_SOURCE_STATE_KEY)).toBe(JSON.stringify(PINNED_PAYLOAD));
    expect(records.size).toBe(3);
  });

  it('treats an unreadable marker as no marker and re-runs the migration', async () => {
    expect.hasAssertions();
    const storage = seededStorage({ [CANA_MIGRATION_MARKER_KEY]: 'not-json{' });
    const { store } = createStoreStub();
    const result = await migrateLocalStorageToCana({ storage, store, now });
    expect(result.status).toBe('migrated');
  });

  it('removes the retained source only after the retention period ends', async () => {
    expect.hasAssertions();
    const expired = FIXED_NOW.getTime() - 1000;
    const storage = seededStorage({
      [CANA_MIGRATION_MARKER_KEY]: JSON.stringify({
        version: 1,
        status: 'verified',
        migratedAt: '2026-07-01T00:00:00.000Z',
        sourceRetainedUntil: new Date(expired).toISOString()
      })
    });
    const { store } = createStoreStub();
    const result = await migrateLocalStorageToCana({ storage, store, now });
    expect(result.status).toBe('already-migrated');
    expect(result.sourceRetained).toBe(false);
    expect(storage.map.has(CANA_MIGRATION_SOURCE_STATE_KEY)).toBe(false);
    expect(storage.map.has(CANA_MIGRATION_SOURCE_BASELINE_KEY)).toBe(false);
    // The marker itself stays: the migration stays terminal and provenance survives.
    expect(storage.map.has(CANA_MIGRATION_MARKER_KEY)).toBe(true);
  });

  it('never reads the source as a store while it is retained', async () => {
    expect.hasAssertions();
    const future = FIXED_NOW.getTime() + 1000;
    const storage = seededStorage({
      [CANA_MIGRATION_MARKER_KEY]: JSON.stringify({
        version: 1,
        status: 'verified',
        migratedAt: FIXED_NOW.toISOString(),
        sourceRetainedUntil: new Date(future).toISOString()
      })
    });
    const { store, records } = createStoreStub();
    const result = await migrateLocalStorageToCana({ storage, store, now });
    expect(result.status).toBe('already-migrated');
    expect(result.sourceRetained).toBe(true);
    // Nothing was written to Cana and nothing was read from the source: the
    // retained payload is inert.
    expect(records.size).toBe(0);
    expect(storage.map.get(CANA_MIGRATION_SOURCE_STATE_KEY)).toBe(JSON.stringify(PINNED_PAYLOAD));
  });
});

describe('declared storage-environment states (no fallback — decision 2026-07-29)', () => {
  it('declares an unsupported environment when IndexedDB does not exist at all', () => {
    expect.hasAssertions();
    const state = describeDesignerStorageEnvironment({ indexedDbPresent: false, probeStatus: 'unavailable' });
    expect(state.kind).toBe('unsupported-environment');
    expect(state.severity).toBe('error');
    expect(state.message).toContain('IndexedDB');
    expect(state.message).toContain('unsupported');
  });

  it('declares a non-persisting session for private/incognito or blocked storage', () => {
    expect.hasAssertions();
    const state = describeDesignerStorageEnvironment({
      indexedDbPresent: true,
      probeStatus: 'unavailable',
      probeReason: 'cana Unavailable: IndexedDB open rejected'
    });
    expect(state.kind).toBe('non-persisting-session');
    expect(state.severity).toBe('error');
    expect(state.message).toContain('private/incognito');
    expect(state.message).toContain('will be lost');
    expect(state.message).toContain('cana Unavailable');
  });

  it('declares data loss distinctly from an empty first run', () => {
    expect.hasAssertions();
    const state = describeDesignerStorageEnvironment({ indexedDbPresent: true, probeStatus: 'lost' });
    expect(state.kind).toBe('data-lost');
    expect(state.severity).toBe('error');
    expect(state.message).toContain('no longer readable');
    expect(state.message).toContain('no fallback');
  });

  it('declares degraded durability (quota pressure, non-persistent storage) as a warning', () => {
    expect.hasAssertions();
    const state = describeDesignerStorageEnvironment({
      indexedDbPresent: true,
      probeStatus: 'available',
      probeReason: 'quota: storage usage is near the origin quota'
    });
    expect(state.kind).toBe('degraded-durability');
    expect(state.severity).toBe('info');
    expect(state.message).toContain('quota');
  });

  it('declares nothing when storage is healthy', () => {
    expect.hasAssertions();
    const state = describeDesignerStorageEnvironment({ indexedDbPresent: true, probeStatus: 'available' });
    expect(state.kind).toBe('ok');
    expect(state.message).toBeNull();
  });
});

describe('load-time data-lost declaration (JUM-626)', () => {
  it('declares data loss through the same data-lost state, naming the loss and the export recourse', () => {
    expect.hasAssertions();
    const state = describeLoadTimeDataLoss({
      reason: 'Stored payload under "service-management.v1" is not readable JSON',
      retainedSource: { retained: false }
    });
    expect(state.kind).toBe('data-lost');
    expect(state.severity).toBe('error');
    expect(state.message).toContain('could not be loaded');
    expect(state.message).toContain('corrupted');
    expect(state.message).toContain('no fallback store');
    expect(state.message).toContain('fresh template');
    expect(state.message).toContain('backup/export made earlier');
    expect(state.message).toContain('Import JSON');
    expect(state.message).toContain('not readable JSON');
  });

  it('names the retained pre-migration localStorage copy as the recourse when one is still retained', () => {
    expect.hasAssertions();
    const state = describeLoadTimeDataLoss({
      retainedSource: { retained: true, retainedUntil: '2026-08-31T12:00:00.000Z' }
    });
    expect(state.kind).toBe('data-lost');
    expect(state.message).toContain(CANA_MIGRATION_SOURCE_STATE_KEY);
    expect(state.message).toContain('2026-08-31T12:00:00.000Z');
    expect(state.message).toContain('Import JSON');
    expect(state.message).not.toContain('backup/export made earlier');
  });

  it('omits the cause when the port reported none', () => {
    expect.hasAssertions();
    const state = describeLoadTimeDataLoss({ retainedSource: { retained: false } });
    expect(state.message).not.toContain('Cause:');
  });

  it('reads a retained source only inside its retention window, with the payload still present', () => {
    expect.hasAssertions();
    const retainedUntil = new Date(FIXED_NOW.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const marker = JSON.stringify({ status: 'verified', migratedAt: FIXED_NOW.toISOString(), sourceRetainedUntil: retainedUntil });
    const storage = createFakeStorage({
      [CANA_MIGRATION_MARKER_KEY]: marker,
      [CANA_MIGRATION_SOURCE_STATE_KEY]: JSON.stringify({ domains: [] })
    });
    expect(readRetainedMigrationSource({ storage, now }))
      .toStrictEqual({ retained: true, retainedUntil });

    // Past the retention window the source is no longer a recovery path.
    const expired = createFakeStorage({
      [CANA_MIGRATION_MARKER_KEY]: marker,
      [CANA_MIGRATION_SOURCE_STATE_KEY]: JSON.stringify({ domains: [] })
    });
    const later = () => new Date(FIXED_NOW.getTime() + 31 * 24 * 60 * 60 * 1000);
    expect(readRetainedMigrationSource({ storage: expired, now: later }))
      .toStrictEqual({ retained: false });

    // No marker (never migrated, or marker unreadable) means no retained source.
    expect(readRetainedMigrationSource({
      storage: createFakeStorage({ [CANA_MIGRATION_SOURCE_STATE_KEY]: '{}' }),
      now
    })).toStrictEqual({ retained: false });

    // Marker inside the window but the payload itself already gone.
    expect(readRetainedMigrationSource({
      storage: createFakeStorage({ [CANA_MIGRATION_MARKER_KEY]: marker }),
      now
    })).toStrictEqual({ retained: false });
  });

  it('resolves the ambient storage defensively when none is injected — none exists off-DOM', () => {
    expect.hasAssertions();
    // This suite runs with no DOM, so the ambient `localStorage` is absent:
    // the default clock and the ambient-storage guard both engage for real.
    expect(readRetainedMigrationSource()).toStrictEqual({ retained: false });
  });

  it('uses the real clock when none is injected (far-future retention date)', () => {
    expect.hasAssertions();
    const storage = createFakeStorage({
      [CANA_MIGRATION_MARKER_KEY]: JSON.stringify({
        status: 'verified',
        migratedAt: FIXED_NOW.toISOString(),
        sourceRetainedUntil: '2099-01-01T00:00:00.000Z'
      }),
      [CANA_MIGRATION_SOURCE_STATE_KEY]: '{}'
    });
    expect(readRetainedMigrationSource({ storage }))
      .toStrictEqual({ retained: true, retainedUntil: '2099-01-01T00:00:00.000Z' });
  });

  it('treats a marker without a parseable retention date as not retained', () => {
    expect.hasAssertions();
    const storage = createFakeStorage({
      [CANA_MIGRATION_MARKER_KEY]: JSON.stringify({
        status: 'verified',
        migratedAt: FIXED_NOW.toISOString(),
        sourceRetainedUntil: 'not-a-date'
      }),
      [CANA_MIGRATION_SOURCE_STATE_KEY]: '{}'
    });
    expect(readRetainedMigrationSource({ storage, now })).toStrictEqual({ retained: false });
  });

  it('reports not retained when the retained payload itself cannot be read', () => {
    expect.hasAssertions();
    const retainedUntil = new Date(FIXED_NOW.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const storage = createFakeStorage({
      [CANA_MIGRATION_MARKER_KEY]: JSON.stringify({
        status: 'verified',
        migratedAt: FIXED_NOW.toISOString(),
        sourceRetainedUntil: retainedUntil
      })
    });
    const readable = storage.getItem;
    storage.getItem = (key: string) => {
      if (key === CANA_MIGRATION_MARKER_KEY) return readable(key);
      throw new Error('SecurityError');
    };
    expect(readRetainedMigrationSource({ storage, now })).toStrictEqual({ retained: false });
  });
});

describe('browser wiring — the Cana bundle is servable by the zero-build SPA (JUM-484)', () => {
  it('maps the factory module specifier to the vendored bundle through an import map', () => {
    expect.hasAssertions();
    const html = fs.readFileSync(
      path.join(repoRoot, 'apps', 'service-management', 'index.html'),
      'utf-8'
    );
    const importMapMatch = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
    expect(importMapMatch).not.toBeNull();
    const importMap = JSON.parse((importMapMatch as RegExpMatchArray)[1]);
    expect(importMap.imports[CANA_MODULE_SPECIFIER]).toBe('./vendor/cana/index.js');
    const scriptMatch = html.match(/<script type="module" src="\.\/script\.js(?:\?v=[^"]+)?"><\/script>/);
    expect(scriptMatch).not.toBeNull();
    // The import map must precede the module script that triggers the import.
    expect(html.indexOf('type="importmap"')).toBeLessThan(scriptMatch?.index ?? -1);
  });

  it('ignores the vendored bundle in git and regenerates it with the sync script', () => {
    expect.hasAssertions();
    const gitignore = fs.readFileSync(path.join(repoRoot, '.gitignore'), 'utf-8');
    expect(gitignore).toContain('apps/service-management/vendor/');
    expect(fs.existsSync(path.join(repoRoot, 'ci-cd', 'sync-service-management-cana-bundle.js'))).toBe(true);
  });
});
