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
  DOMAIN_COLORS,
  clampZoom,
  createDesignerState,
  createDefaultView,
  defaultFields,
  fallbackId,
  getDefaultRbacPolicy,
  normalizeContractInput,
  normalizeDomainInput,
  normalizeEntityInput,
  normalizeField,
  normalizeOptionalNumber,
  normalizeRelationship,
  normalizeStatePayload,
  parseCommaSeparated,
  parseEnumValues
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
    ['src/state/designerState.js', 'src/store/IDesignerStore.js', 'src/store/LocalStorageDesignerStore.js', 'src/model/rbacContract.js']
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

    it('restores deployments migrated to the Requirement 059 metadata contract (JUM-481)', async () => {
      const storage = createFakeStorage({
        'service-management.v1': JSON.stringify({
          domains: [],
          relationships: [],
          deployments: [
            {
              name: 'prod', type: 'dedicated', region: 'us-east-1', runtime: 'nodejs22.x'
            },
            {
              name: 'fn',
              region: 'us-east-1',
              runtime: 'nodejs22.x',
              serviceType: 'functions',
              deployTarget: 'lambda',
              runtimeProtocol: 'http',
              databaseDriver: 'InMemory',
              keyValueDriver: 'redis',
              pm2Profile: ''
            }
          ]
        })
      });
      const { core } = createCore(storage);
      await core.loadState();
      expect(core.state.deployments).toHaveLength(2);
      // The legacy entry migrates forward: type becomes deployTarget and the
      // missing metadata takes the matrix-derived defaults.
      expect(core.state.deployments[0]).toStrictEqual({
        name: 'prod',
        region: 'us-east-1',
        runtime: 'nodejs22.x',
        serviceType: 'restapi',
        deployTarget: 'dedicated-server',
        runtimeProtocol: 'http',
        databaseDriver: 'InMemory',
        keyValueDriver: 'redis',
        pm2Profile: 'dev'
      });
      // The current-shape entry round-trips unchanged.
      expect(core.state.deployments[1].deployTarget).toBe('lambda');
      expect(core.state.deployments[1].pm2Profile).toBe('');
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

    it('falls back for missing context/meta and maps populated contracts and fields', () => {
      const { core } = createCore();
      core.state.domains = [{
        id: 'domain-1',
        name: 'Bare',
        color: '#60a5fa',
        x: 0,
        y: 0,
        entities: [{
          id: 'entity-1',
          name: 'BareEntity',
          x: 0,
          y: 0,
          fields: [
            { name: 'id', type: 'uuid', required: true },
            {
              name: 'status', type: 'string', format: 'enum', itemsType: 'string', enumValues: ['a', 'b']
            }
          ],
          meta: {
            contracts: [{
              id: 'c1', name: 'Ping', type: 'command', channel: 'ch', version: '2.0.0', payloadSchema: {}
            }]
          }
        }, {
          id: 'entity-2',
          name: 'MetaLess',
          x: 0,
          y: 0,
          fields: []
        }]
      }];
      core.state.relationships = [{
        id: 'rel-1', fromEntityId: 'entity-1', toEntityId: 'entity-1', fromCardinality: 'N', toCardinality: '1'
      }];
      const snapshot = core.buildModelSnapshot();
      const domain = snapshot.domains[0];
      // Missing context/meta fall back to empty shapes.
      expect(domain.context).toStrictEqual({});
      expect(domain.entities[0].meta).toStrictEqual({
        contracts: [{
          id: 'c1', name: 'Ping', type: 'command', channel: 'ch', version: '2.0.0', payloadSchema: {}
        }]
      });
      const [bare, rich] = domain.entities[0].fields;
      expect(bare).toStrictEqual({
        name: 'id',
        type: 'uuid',
        required: true,
        pk: false,
        fk: false,
        unique: false,
        nullable: false,
        format: '',
        itemsType: '',
        enumValues: []
      });
      expect(rich.format).toBe('enum');
      expect(rich.itemsType).toBe('string');
      expect(rich.enumValues).toStrictEqual(['a', 'b']);
      // An entity without meta falls back to the empty baseline meta shape.
      expect(domain.entities[1].meta).toStrictEqual({ aggregateRoot: false, invariants: [] });
      expect(snapshot.relationships[0]).toStrictEqual({
        id: 'rel-1', fromEntityId: 'entity-1', toEntityId: 'entity-1', fromCardinality: 'N', toCardinality: '1'
      });
    });
  });

  describe('pure normalisation helpers', () => {
    it('parseEnumValues handles falsy, array and comma-separated inputs', () => {
      expect(parseEnumValues(null)).toStrictEqual([]);
      expect(parseEnumValues([' a ', 'b', ''])).toStrictEqual(['a', 'b']);
      expect(parseEnumValues('a, b,,c')).toStrictEqual(['a', 'b', 'c']);
    });

    it('parseCommaSeparated handles array, string and empty inputs', () => {
      expect(parseCommaSeparated(['a', ' b ', ''])).toStrictEqual(['a', 'b']);
      expect(parseCommaSeparated('a,b, ,c')).toStrictEqual(['a', 'b', 'c']);
      expect(parseCommaSeparated('')).toStrictEqual([]);
    });

    it('normalizeOptionalNumber maps blanks and non-numerics to null', () => {
      expect(normalizeOptionalNumber(null)).toBeNull();
      expect(normalizeOptionalNumber(undefined)).toBeNull();
      expect(normalizeOptionalNumber('')).toBeNull();
      expect(normalizeOptionalNumber('7')).toBe(7);
      expect(normalizeOptionalNumber('nope')).toBeNull();
    });

    it('clampZoom clamps to the pinned 0.5–2 range', () => {
      expect(clampZoom(0.1)).toBe(0.5);
      expect(clampZoom(5)).toBe(2);
      expect(clampZoom(1.3)).toBe(1.3);
    });

    it('fallbackId embeds prefix and seed', () => {
      expect(fallbackId('domain', 3)).toMatch(/^domain-import-3-[a-z0-9]+$/);
    });

    it('normalizeField applies defaults to an empty field', () => {
      expect(normalizeField(undefined, 2)).toStrictEqual({
        name: 'field_3',
        type: 'string',
        required: false,
        pk: false,
        fk: false,
        unique: false,
        nullable: false,
        format: '',
        description: '',
        enumValues: [],
        pattern: '',
        minLength: null,
        maxLength: null,
        minimum: null,
        maximum: null,
        itemsType: ''
      });
    });

    it('normalizeField keeps valid input and resolves array item types', () => {
      const rich = normalizeField({
        name: 'tags',
        type: 'array',
        itemsType: 'uuid',
        enum: 'a, b',
        format: 'f',
        description: 'd',
        pattern: 'p',
        minLength: '1',
        maxLength: 5,
        minimum: 0,
        maximum: 10,
        required: true,
        pk: true,
        fk: true,
        unique: true,
        nullable: true
      }, 0);
      expect(rich).toStrictEqual({
        name: 'tags',
        type: 'array',
        required: true,
        pk: true,
        fk: true,
        unique: true,
        nullable: true,
        format: 'f',
        description: 'd',
        enumValues: ['a', 'b'],
        pattern: 'p',
        minLength: 1,
        maxLength: 5,
        minimum: 0,
        maximum: 10,
        itemsType: 'uuid'
      });
      // An array without itemsType defaults to string items; an enumValues
      // array is kept as-is; an unknown type falls back to string.
      expect(normalizeField({ type: 'array' }, 0).itemsType).toBe('string');
      expect(normalizeField({ enumValues: ['x'] }, 0).enumValues).toStrictEqual(['x']);
      expect(normalizeField({ type: 'weird' }, 0).type).toBe('string');
    });

    it('normalizeContractInput applies defaults and validates the type enum', () => {
      const sparse = normalizeContractInput();
      expect(sparse.id).toMatch(/^contract-import-0-[a-z0-9]+$/);
      expect(sparse).toStrictEqual({
        id: sparse.id, name: 'Contract_1', type: 'event', channel: '', version: '1.0.0', payloadSchema: {}
      });
      const rich = normalizeContractInput({
        id: 'c-1', name: 'Ping', type: 'response', channel: 'ch', version: '3.0.0', payloadSchema: { type: 'object' }
      }, 4);
      expect(rich).toStrictEqual({
        id: 'c-1', name: 'Ping', type: 'response', channel: 'ch', version: '3.0.0', payloadSchema: { type: 'object' }
      });
      expect(normalizeContractInput({ payloadSchema: 'not-an-object' }, 0).payloadSchema).toStrictEqual({});
    });

    it('normalizeRelationship fills anchors, cardinals and offsets', () => {
      const sparse = normalizeRelationship({ fromEntityId: 'a', toEntityId: 'b' });
      expect(sparse).toStrictEqual({
        fromEntityId: 'a',
        toEntityId: 'b',
        name: 'a -> b',
        fromCardinality: 'N',
        toCardinality: '1',
        fromAnchorSide: null,
        toAnchorSide: null,
        anchorBehavior: 'auto',
        bendX: null,
        bendY: null,
        labelOffsetX: 0,
        labelOffsetY: 0
      });
      const rich = normalizeRelationship({
        name: 'R',
        fromCardinality: '1',
        toCardinality: 'N',
        fromAnchorSide: 'top',
        toAnchorSide: 'left',
        anchorBehavior: 'center',
        bendX: 5,
        bendY: -2,
        labelOffsetX: 3,
        labelOffsetY: 4
      });
      expect(rich.name).toBe('R');
      expect(rich.fromAnchorSide).toBe('top');
      expect(rich.toAnchorSide).toBe('left');
      expect(rich.anchorBehavior).toBe('center');
      expect(rich.bendX).toBe(5);
      expect(rich.labelOffsetX).toBe(3);
      expect(rich.labelOffsetY).toBe(4);
    });

    it('getDefaultRbacPolicy and defaultFields return the pinned shapes', () => {
      const rbac = getDefaultRbacPolicy();
      expect(Object.keys(rbac).sort()).toStrictEqual(['create', 'delete', 'getById', 'list', 'update']);
      expect(rbac.getById.roles).toContain('user');
      expect(defaultFields().map((field: { name: string }) => field.name))
        .toStrictEqual(['id', 'createdAt', 'updatedAt']);
    });
  });

  describe('normalizeEntityInput', () => {
    it('builds a fully defaulted entity from empty input', () => {
      const entity = normalizeEntityInput(undefined, 0);
      expect(entity.id).toMatch(/^entity-import-0-[a-z0-9]+$/);
      expect(entity.name).toBe('Entity_1');
      expect(entity.fields.map((field: { name: string }) => field.name))
        .toStrictEqual(['id', 'createdAt', 'updatedAt']);
      expect(entity.x).toBe(14);
      expect(entity.y).toBe(14);
      expect(entity.meta.aggregateRoot).toBe(false);
      expect(entity.meta.invariants).toStrictEqual([]);
      expect(entity.meta.rbac.list.roles).toStrictEqual(['superadmin', 'admin']);
      expect(entity.meta.contracts).toStrictEqual([]);
      expect(entity.meta.oasComposition).toStrictEqual({
        mode: '', refs: [], externalRefs: [], discriminator: ''
      });
    });

    it('keeps rich input, merging rbac rules over the defaults', () => {
      const entity = normalizeEntityInput({
        id: 'e-9',
        name: 'Order',
        x: 100,
        y: 200,
        fields: [{ name: 'total', type: 'number' }],
        meta: {
          aggregateRoot: true,
          invariants: ['a', ' b ', ''],
          rbac: {
            list: { roles: ['admin'], tenantScoped: false },
            delete: { roles: 'nope', tenantScoped: 'yes' }
          },
          contracts: [{ name: 'Placed' }],
          oasComposition: {
            mode: 'allOf', refs: 'A,B', externalRefs: ['X'], discriminator: 'kind'
          }
        }
      }, 1);
      expect(entity.id).toBe('e-9');
      expect(entity.x).toBe(100);
      expect(entity.y).toBe(200);
      expect(entity.fields).toHaveLength(1);
      expect(entity.meta.aggregateRoot).toBe(true);
      expect(entity.meta.invariants).toStrictEqual(['a', 'b']);
      // JUM-477: tenantScoped is re-derived from the roles on load (the
      // stored `false` was a flag the runtime could not honour for a
      // normalized admin role), so the persisted shape is repaired.
      expect(entity.meta.rbac.list).toStrictEqual({ roles: ['admin'], tenantScoped: true });
      // A non-array roles value falls back to the default rule's roles; the
      // derived tenantScoped for that default rule is true.
      expect(entity.meta.rbac.delete.roles).toStrictEqual(['superadmin', 'admin']);
      expect(entity.meta.rbac.delete.tenantScoped).toBe(true);
      expect(entity.meta.contracts).toHaveLength(1);
      expect(entity.meta.contracts[0].name).toBe('Placed');
      expect(entity.meta.oasComposition).toStrictEqual({
        mode: 'allOf', refs: ['A', 'B'], externalRefs: ['X'], discriminator: 'kind'
      });
    });
  });

  describe('normalizeDomainInput', () => {
    it('builds a fully defaulted domain from empty input', () => {
      const domain = normalizeDomainInput(undefined, 0);
      expect(domain.id).toMatch(/^domain-import-0-[a-z0-9]+$/);
      expect(domain.name).toBe('Domain_1');
      expect(domain.color).toBe(DOMAIN_COLORS[0]);
      expect(domain.x).toBe(120);
      expect(domain.y).toBe(90);
      expect(domain.context).toStrictEqual({
        ubiquitousLanguage: '',
        ownerTeam: '',
        upstreamDependencies: [],
        downstreamDependencies: [],
        integrationChannel: '',
        packageDependencies: [],
        sharedValueObjects: []
      });
      expect(domain.entities).toStrictEqual([]);
    });

    it('keeps rich input including context lists and a valid color', () => {
      const domain = normalizeDomainInput({
        id: 'd-1',
        name: 'Sales',
        color: '#A1B2C3',
        x: 5,
        y: 6,
        context: {
          ubiquitousLanguage: 'UL',
          ownerTeam: 'Team',
          upstreamDependencies: 'a,b',
          downstreamDependencies: ['c'],
          integrationChannel: 'ch',
          packageDependencies: 'p',
          sharedValueObjects: ['v']
        },
        entities: [{ id: 'e-1', name: 'E' }]
      }, 2);
      expect(domain.id).toBe('d-1');
      expect(domain.color).toBe('#A1B2C3');
      expect(domain.x).toBe(5);
      expect(domain.y).toBe(6);
      expect(domain.context.upstreamDependencies).toStrictEqual(['a', 'b']);
      expect(domain.context.downstreamDependencies).toStrictEqual(['c']);
      expect(domain.context.packageDependencies).toStrictEqual(['p']);
      expect(domain.context.sharedValueObjects).toStrictEqual(['v']);
      expect(domain.entities).toHaveLength(1);
    });
  });

  describe('normalizeStatePayload selection and view arms', () => {
    it('keeps explicit selections, idCounter and a fully overridden view', () => {
      const normalized = normalizeStatePayload({
        domains: [],
        relationships: [],
        selectedDomainId: 'd-x',
        selectedEntityId: 'e-x',
        selectedRelationshipId: 'r-x',
        idCounter: 42,
        view: {
          zoom: 1.5,
          compactEntities: true,
          snapToGrid: false,
          edgeStyle: 'orthogonal',
          modelCheckMinSeverity: 'error',
          exportBlockCritical: false,
          largeCanvasMode: true
        }
      });
      expect(normalized.selectedDomainId).toBe('d-x');
      expect(normalized.selectedEntityId).toBe('e-x');
      expect(normalized.selectedRelationshipId).toBe('r-x');
      expect(normalized.idCounter).toBe(42);
      expect(normalized.view).toStrictEqual({
        zoom: 1.5,
        compactEntities: true,
        snapToGrid: false,
        edgeStyle: 'orthogonal',
        modelCheckMinSeverity: 'error',
        exportBlockCritical: false,
        largeCanvasMode: true
      });
    });
  });

  describe('applySnapshot defaults', () => {
    it('restores every section to defaults from an empty snapshot', () => {
      const { core } = createCore();
      core.applySnapshot({});
      expect(core.state.domains).toStrictEqual([]);
      expect(core.state.relationships).toStrictEqual([]);
      expect(core.state.selectedDomainId).toBeNull();
      expect(core.state.selectedEntityId).toBeNull();
      expect(core.state.selectedRelationshipId).toBeNull();
      expect(core.state.idCounter).toBe(1);
      expect(core.state.activeTab).toBe('domain-designer');
      expect(core.state.interfaces).toStrictEqual([]);
      expect(core.state.deployments).toStrictEqual([]);
      expect(core.state.view).toStrictEqual({ zoom: 1 });
      expect(core.state.serviceConfiguration.serviceKind).toBe('rest-api');
      expect(core.state.runtimeEnvironment.environment).toBe('dev');
    });

    it('falls back to the first domain when the snapshot has no selection', () => {
      const { core } = createCore();
      core.applySnapshot({
        domains: [{ id: 'd-1', name: 'D', entities: [] }],
        relationships: [{ id: 'rel-9', fromEntityId: 'a', toEntityId: 'b' }],
        view: { zoom: 2 }
      });
      expect(core.state.selectedDomainId).toBe('d-1');
      expect(core.state.view).toStrictEqual({ zoom: 2 });
      // recomputeIdCounter walks relationships too: rel-9 pushes the counter to 10.
      expect(core.state.idCounter).toBe(10);
      expect(core.state.relationships[0].fromCardinality).toBe('N');
    });
  });

  describe('saveState payload contract', () => {
    it('writes exactly the twelve pinned Requirement 126 sections', async () => {
      const { core, storage } = createCore();
      await core.loadState();
      const payload = JSON.parse(storage.map.get('service-management.v1') as string);
      expect(Object.keys(payload).sort()).toStrictEqual([
        'activeTab',
        'deployments',
        'domains',
        'idCounter',
        'interfaces',
        'relationships',
        'runtimeEnvironment',
        'selectedDomainId',
        'selectedEntityId',
        'selectedRelationshipId',
        'serviceConfiguration',
        'view'
      ]);
    });
  });

  describe('history edge cases', () => {
    it('redo with an empty future is a no-op', async () => {
      const { core, renders } = createCore();
      await core.loadState();
      core.redo();
      expect(core.state.domains[0].name).toBe('Seed');
      expect(renders).toHaveLength(0);
    });

    it('a new record clears the redo future', async () => {
      const { core } = createCore();
      await core.loadState();
      core.withPersist(() => {
        core.state.domains[0].name = 'Changed';
      });
      core.undo();
      expect(core.history.future).toHaveLength(1);
      core.withPersist(() => {
        core.state.domains[0].name = 'Other';
      });
      expect(core.history.future).toStrictEqual([]);
    });
  });

  describe('loadState corrupt-but-decodable payload', () => {
    it('recovers through the catch path when normalisation throws', async () => {
      const storage = createFakeStorage({
        'service-management.v1': JSON.stringify({ domains: [], relationships: [null] })
      });
      const { core } = createCore(storage);
      core.state.view = { ...createDefaultView(), zoom: 2 };
      await core.loadState();
      expect(core.state.domains[0].name).toBe('Seed');
      expect(core.state.view).toStrictEqual(createDefaultView());
      expect(JSON.parse(storage.map.get('service-management.v1') as string).domains[0].name).toBe('Seed');
    });
  });
});
