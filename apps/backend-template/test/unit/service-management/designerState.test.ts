/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
import fs from 'node:fs';
import path from 'node:path';

/**
 * Unit suite for the DOM-free designer state core extracted from
 * `apps/service-management/script.js` by JUM-468: state, normalisation,
 * save/load, history (undo/redo) and `withPersist`, all behind the
 * `IDesignerStore` port.
 *
 * The suite runs with no DOM and no DOM shim — importing and exercising the
 * module here is itself the proof of the "core is DOM-free" acceptance
 * criterion and the precondition for JUM-470/JUM-471.
 */

const repoRoot = path.resolve(__dirname, '../../../../..');
const {
  createDesignerState,
  createDefaultView,
  normalizeStatePayload
} = require(path.join(repoRoot, 'apps', 'service-management', 'src', 'state', 'designerState.js'));
const {
  LocalStorageDesignerStore
} = require(path.join(repoRoot, 'apps', 'service-management', 'src', 'store', 'LocalStorageDesignerStore.js'));

function createFakeStorage(initial: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key: string) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key: string, value: string) => { map.set(key, String(value)); },
    removeItem: (key: string) => { map.delete(key); },
    map
  };
}

type Core = ReturnType<typeof createDesignerState>;

function createCore(storage = createFakeStorage()) {
  const store = new LocalStorageDesignerStore({ storage });
  let core: Core;
  const seed = () => {
    core.state.domains = [{
      id: 'domain-1',
      name: 'Seed',
      color: '#60a5fa',
      x: 80,
      y: 80,
      context: {},
      entities: [{
        id: 'entity-1',
        name: 'SeedEntity',
        x: 14,
        y: 14,
        fields: [],
        meta: {
          aggregateRoot: false, invariants: [], rbac: {}, contracts: [], oasComposition: {}
        }
      }]
    }];
    core.state.relationships = [];
    core.state.selectedDomainId = 'domain-1';
    core.state.selectedEntityId = null;
    core.state.selectedRelationshipId = null;
    core.state.idCounter = 2;
    core.state.view = createDefaultView();
  };
  const renders: number[] = [];
  core = createDesignerState({ store, seed, render: () => renders.push(1) });
  return {
    core, store, storage, renders
  };
}

describe('designer state core (JUM-468)', () => {
  it('is DOM-free: no document/window references in the extracted modules', () => {
    ['src/state/designerState.js', 'src/store/IDesignerStore.js', 'src/store/LocalStorageDesignerStore.js']
      .forEach((modulePath) => {
        const source = fs.readFileSync(
          path.join(repoRoot, 'apps', 'service-management', ...modulePath.split('/')),
          'utf-8'
        );
        // Strip comments so prose about the contract cannot false-positive;
        // what remains must not reach the DOM globals.
        const code = source
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
        expect(code).not.toMatch(/\bdocument\s*\./);
        expect(code).not.toMatch(/\bwindow\s*\./);
      });
  });

  describe('normalizeStatePayload', () => {
    it('normalises garbage input to the same defaults the pre-refactor load used', () => {
      const normalized = normalizeStatePayload(null);
      expect(normalized.domains).toStrictEqual([]);
      expect(normalized.relationships).toStrictEqual([]);
      expect(normalized.selectedDomainId).toBeNull();
      expect(normalized.idCounter).toBe(1);
      expect(normalized.view).toStrictEqual(createDefaultView());
    });

    it('drops relationships pointing at unknown entities and clamps the view', () => {
      const normalized = normalizeStatePayload({
        domains: [{
          id: 'domain-1',
          name: 'Billing',
          entities: [{ id: 'entity-1', name: 'Invoice', fields: [] }]
        }],
        relationships: [
          { id: 'rel-1', fromEntityId: 'entity-1', toEntityId: 'entity-1' },
          { id: 'rel-2', fromEntityId: 'entity-1', toEntityId: 'ghost' }
        ],
        view: { zoom: 99, edgeStyle: 'diagonal', modelCheckMinSeverity: 'fatal' }
      });
      expect(normalized.relationships.map((r: { id: string }) => r.id)).toStrictEqual(['rel-1']);
      expect(normalized.selectedDomainId).toBe('domain-1');
      expect(normalized.view.zoom).toBe(2);
      expect(normalized.view.edgeStyle).toBe('curved');
      expect(normalized.view.modelCheckMinSeverity).toBe('info');
      expect(normalized.view.exportBlockCritical).toBe(true);
    });
  });

  describe('loadState', () => {
    it('seeds and persists the default template on an empty store (first run)', async () => {
      const { core, storage } = createCore();
      await core.loadState();
      expect(core.state.domains[0].name).toBe('Seed');
      expect(storage.map.has('service-management.v1')).toBe(true);
      expect(core.history.past).toStrictEqual([]);
    });

    it('restores a previously saved model identically (no behaviour change)', async () => {
      const first = createCore();
      await first.core.loadState();
      first.core.withPersist(() => {
        first.core.state.domains[0].name = 'Renamed';
      });

      const second = createCore(first.storage);
      second.core.state.domains = [];
      await second.core.loadState();
      expect(second.core.state.domains[0].name).toBe('Renamed');
      expect(second.core.state.selectedDomainId).toBe('domain-1');
      // idCounter is recomputed from the highest numeric id suffix.
      expect(second.core.state.idCounter).toBe(2);
    });

    it('recovers from lost (corrupted) storage by reseeding, persisting and resetting the view', async () => {
      const storage = createFakeStorage({ 'service-management.v1': '{corrupted' });
      const { core } = createCore(storage);
      core.state.view = { ...createDefaultView(), zoom: 2 };
      await core.loadState();
      expect(core.state.domains[0].name).toBe('Seed');
      expect(core.state.view).toStrictEqual(createDefaultView());
      // The recovered state overwrites the corrupted payload, as before.
      expect(JSON.parse(storage.map.get('service-management.v1') as string).domains[0].name).toBe('Seed');
    });

    it('seeds in memory only when storage is unavailable — no fallback, no write', async () => {
      const storage = createFakeStorage();
      storage.getItem = () => { throw new Error('SecurityError'); };
      storage.setItem = () => { throw new Error('SecurityError'); };
      const { core } = createCore(storage);
      await core.loadState();
      expect(core.state.domains[0].name).toBe('Seed');
      expect(core.history.past).toStrictEqual([]);
    });
  });

  describe('withPersist / history / undo / redo', () => {
    it('records history before the action and saves after it', async () => {
      const { core, storage } = createCore();
      await core.loadState();
      core.withPersist(() => {
        core.state.domains[0].name = 'Changed';
      });
      expect(core.history.past).toHaveLength(1);
      expect(core.history.past[0].domains[0].name).toBe('Seed');
      expect(JSON.parse(storage.map.get('service-management.v1') as string).domains[0].name).toBe('Changed');
    });

    it('skips history when recordHistory is false but still saves', async () => {
      const { core, storage } = createCore();
      await core.loadState();
      core.withPersist(() => {
        core.state.domains[0].name = 'Quiet';
      }, { recordHistory: false });
      expect(core.history.past).toHaveLength(0);
      expect(JSON.parse(storage.map.get('service-management.v1') as string).domains[0].name).toBe('Quiet');
    });

    it('undo restores the previous snapshot and redo reapplies it, rendering each time', async () => {
      const { core, renders } = createCore();
      await core.loadState();
      core.withPersist(() => {
        core.state.domains[0].name = 'Changed';
      });
      core.undo();
      expect(core.state.domains[0].name).toBe('Seed');
      expect(core.history.future).toHaveLength(1);
      core.redo();
      expect(core.state.domains[0].name).toBe('Changed');
      expect(renders).toHaveLength(2);
    });

    it('undo with an empty past is a no-op', async () => {
      const { core, renders } = createCore();
      await core.loadState();
      core.undo();
      expect(core.state.domains[0].name).toBe('Seed');
      expect(renders).toHaveLength(0);
    });

    it('caps history at 100 entries', () => {
      const { core } = createCore();
      for (let i = 0; i < 110; i += 1) {
        core.withPersist(() => {
          core.state.idCounter = i + 2;
        });
      }
      expect(core.history.past).toHaveLength(100);
    });

    it('exposes state and history by reference for the UI layer', () => {
      const { core } = createCore();
      core.state.activeTab = 'service-config';
      expect(core.snapshotState().activeTab).toBe('service-config');
      core.history.past = [];
      expect(core.history.past).toStrictEqual([]);
    });
  });

  describe('buildModelSnapshot (schema-baseline shape)', () => {
    it('emits the pinned Requirement 126 baseline sections', async () => {
      const { core } = createCore();
      await core.loadState();
      const snapshot = core.buildModelSnapshot();
      expect(Object.keys(snapshot).sort()).toStrictEqual(['domains', 'relationships']);
      const entity = snapshot.domains[0].entities[0];
      expect(Object.keys(snapshot.domains[0]).sort()).toStrictEqual(['color', 'context', 'entities', 'id', 'name']);
      expect(Object.keys(entity).sort()).toStrictEqual(['contracts', 'fields', 'id', 'meta', 'name']);
    });
  });
});
