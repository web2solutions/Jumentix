/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
import path from 'node:path';

/**
 * JUM-470 — unit suite for the designer normalisers
 * (`apps/service-management/src/state/designerState.js`).
 *
 * Scope is deliberately the complement of designerState.test.ts (JUM-468),
 * which already pins the UI-shaped happy paths. What is pinned here:
 *
 * - `normalizeField` / `normalizeContractInput` with importer-shaped inputs —
 *   the shapes that arrive from `src/importers/designerImporters.js` (OAS
 *   schema rows) rather than from the UI form, with unexpected types;
 * - `normalizeStatePayload` idempotence — a saved model must survive the load
 *   normalisation byte-identically, because a defect here silently rewrites
 *   the user's saved model (data loss disguised as a load);
 * - `normalizeStatePayload` legacy/partial upgrade — old payloads are upgraded
 *   predictably, never silently dropped;
 * - the exact RBAC default policy every new/imported entity starts with.
 *
 * OAS field rules (`toOasType`/`toOasFieldSchema`/`fromOasType`) are pinned by
 * modelQueries.test.ts (JUM-469) and are not duplicated here.
 */

const repoRoot = path.resolve(__dirname, '../../../../..');
const {
  DOMAIN_COLORS,
  createDefaultView,
  getDefaultRbacPolicy,
  normalizeContractInput,
  normalizeField,
  normalizeStatePayload
} = require(path.join(repoRoot, 'apps', 'service-management', 'src', 'state', 'designerState.js'));

describe('designer normalisers (JUM-470)', () => {
  describe('normalizeField — importer-shaped inputs', () => {
    it('coerces non-string names and boolean-ish flags', () => {
      const field = normalizeField({
        name: 42, type: 'integer', required: 1, pk: 0, fk: 'yes', unique: null, nullable: undefined
      }, 0);
      expect(field.name).toBe('42');
      expect(field.required).toBe(true);
      expect(field.pk).toBe(false);
      expect(field.fk).toBe(true);
      expect(field.unique).toBe(false);
      expect(field.nullable).toBe(false);
    });

    it('keeps itemsType only on array fields and repairs unknown array item types', () => {
      expect(normalizeField({ name: 'a', type: 'array', itemsType: 'weird' }, 0).itemsType).toBe('string');
      expect(normalizeField({ name: 'b', type: 'string', itemsType: 'uuid' }, 1).itemsType).toBe('');
    });

    it('maps non-numeric constraint values to null (no constraint)', () => {
      const field = normalizeField({
        name: 'c', type: 'string', minLength: 'abc', maxLength: 'many', minimum: {}, maximum: NaN
      }, 2);
      expect(field.minLength).toBeNull();
      expect(field.maxLength).toBeNull();
      expect(field.minimum).toBeNull();
      expect(field.maximum).toBeNull();
    });

    it('keeps zero-valued constraints — 0 is not "unset"', () => {
      const field = normalizeField({
        name: 'n', type: 'number', minLength: 0, maxLength: 0, minimum: 0, maximum: 0
      }, 0);
      expect(field.minLength).toBe(0);
      expect(field.maxLength).toBe(0);
      expect(field.minimum).toBe(0);
      expect(field.maximum).toBe(0);
    });

    it('stringifies enum members arriving from an OAS importer enum array', () => {
      expect(normalizeField({ name: 'status', enum: ['a', 1, ' b '] }, 0).enumValues)
        .toStrictEqual(['a', '1', 'b']);
    });
  });

  describe('normalizeContractInput — importer-shaped inputs', () => {
    it('builds fallback ids and names from the importer index', () => {
      const contract = normalizeContractInput(null, 3);
      expect(contract.id).toMatch(/^contract-import-3-[a-z0-9]+$/);
      expect(contract.name).toBe('Contract_4');
    });

    it('repairs whitespace names, channels and versions and unknown types', () => {
      expect(normalizeContractInput({
        id: ' c-1 ', name: '  ', type: 'query', channel: ' ch ', version: ' '
      }, 0)).toStrictEqual({
        id: 'c-1',
        name: 'Contract_1',
        type: 'event',
        channel: 'ch',
        version: '1.0.0',
        payloadSchema: {}
      });
    });

    it('keeps object payload schemas (arrays included) and drops null', () => {
      expect(normalizeContractInput({ payloadSchema: null }, 0).payloadSchema).toStrictEqual({});
      expect(normalizeContractInput({ payloadSchema: ['schema'] }, 1).payloadSchema)
        .toStrictEqual(['schema']);
    });
  });

  describe('normalizeStatePayload — round-trip stability', () => {
    it('is idempotent: a normalized payload survives the load normalisation unchanged', () => {
      const input = {
        domains: [{
          id: 'domain-1',
          name: 'Billing',
          color: '#34d399',
          x: 200,
          y: 300,
          context: {
            ubiquitousLanguage: 'UL',
            ownerTeam: 'Team',
            upstreamDependencies: ['up'],
            downstreamDependencies: ['down'],
            integrationChannel: 'ch',
            packageDependencies: ['pkg'],
            sharedValueObjects: ['vo']
          },
          entities: [{
            id: 'entity-1',
            name: 'Invoice',
            x: 14,
            y: 14,
            fields: [
              normalizeField({
                name: 'id', type: 'uuid', required: true, pk: true, unique: true
              }, 0),
              normalizeField({ name: 'total', type: 'number', minimum: 0 }, 1)
            ],
            meta: {
              aggregateRoot: true,
              invariants: ['total positive'],
              rbac: getDefaultRbacPolicy(),
              contracts: [{
                id: 'c-1',
                name: 'issued',
                type: 'event',
                channel: 'billing.issued',
                version: '1.0.0',
                payloadSchema: { type: 'object' }
              }],
              oasComposition: {
                mode: 'allOf', refs: ['A', 'B'], externalRefs: ['X'], discriminator: 'kind'
              }
            }
          }]
        }],
        relationships: [{
          id: 'rel-1',
          name: 'R',
          fromEntityId: 'entity-1',
          toEntityId: 'entity-1',
          fromCardinality: '1',
          toCardinality: 'N',
          fromAnchorSide: 'top',
          toAnchorSide: 'bottom',
          anchorBehavior: 'center',
          bendX: 5,
          bendY: 6,
          labelOffsetX: 1,
          labelOffsetY: 2
        }],
        selectedDomainId: 'domain-1',
        selectedEntityId: 'entity-1',
        selectedRelationshipId: 'rel-1',
        idCounter: 9,
        view: {
          zoom: 1.5,
          compactEntities: true,
          snapToGrid: false,
          edgeStyle: 'orthogonal',
          modelCheckMinSeverity: 'warn',
          exportBlockCritical: false,
          largeCanvasMode: true
        }
      };
      const once = normalizeStatePayload(input);
      const twice = normalizeStatePayload(once);
      // The second pass must not rewrite what the first pass produced — this
      // is the "load does not silently rewrite the saved model" guarantee.
      expect(twice).toStrictEqual(once);
      // Spot-pin the content that matters, so idempotence is not vacuous.
      expect(once.domains[0].entities[0].fields[1].minimum).toBe(0);
      expect(once.domains[0].entities[0].meta.oasComposition.refs).toStrictEqual(['A', 'B']);
      expect(once.relationships[0]).toStrictEqual(input.relationships[0]);
      expect(once.view).toStrictEqual(input.view);
      expect(once.idCounter).toBe(9);
    });
  });

  describe('normalizeStatePayload — legacy and partial payloads', () => {
    it('upgrades a legacy partial payload predictably instead of dropping it', () => {
      const normalized = normalizeStatePayload({
        domains: [{
          name: ' Legacy ',
          entities: [{
            name: ' Thing ',
            meta: {
              invariants: 'first\nsecond',
              contracts: [{}],
              oasComposition: { mode: 'allOf', refs: 'A, B' }
            }
          }]
        }],
        relationships: 'nope',
        view: { zoom: '1.5' }
      });

      expect(normalized.domains).toHaveLength(1);
      const domain = normalized.domains[0];
      expect(domain.id).toMatch(/^domain-import-0-[a-z0-9]+$/);
      expect(domain.name).toBe('Legacy');
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

      const entity = domain.entities[0];
      expect(entity.id).toMatch(/^entity-import-0-[a-z0-9]+$/);
      expect(entity.name).toBe('Thing');
      expect(entity.fields.map((field: { name: string }) => field.name))
        .toStrictEqual(['id', 'createdAt', 'updatedAt']);
      expect(entity.meta.aggregateRoot).toBe(false);
      // Newline-separated legacy invariants are upgraded to a list.
      expect(entity.meta.invariants).toStrictEqual(['first', 'second']);
      expect(entity.meta.rbac).toStrictEqual(getDefaultRbacPolicy());
      expect(entity.meta.contracts).toHaveLength(1);
      expect(entity.meta.contracts[0].name).toBe('Contract_1');
      expect(entity.meta.contracts[0].type).toBe('event');
      expect(entity.meta.contracts[0].version).toBe('1.0.0');
      // Comma-separated legacy composition refs are upgraded to a list.
      expect(entity.meta.oasComposition).toStrictEqual({
        mode: 'allOf', refs: ['A', 'B'], externalRefs: [], discriminator: ''
      });

      // A non-array relationships section becomes an empty list, not a throw.
      expect(normalized.relationships).toStrictEqual([]);
      expect(normalized.selectedDomainId).toBe(domain.id);
      expect(normalized.selectedEntityId).toBeNull();
      expect(normalized.selectedRelationshipId).toBeNull();
      expect(normalized.idCounter).toBe(1);
      expect(normalized.view).toStrictEqual({
        ...createDefaultView(),
        zoom: 1.5
      });
    });

    it('treats a non-array domains section as an empty model', () => {
      const normalized = normalizeStatePayload({ domains: { 0: { name: 'Ghost' } }, relationships: null });
      expect(normalized.domains).toStrictEqual([]);
      expect(normalized.relationships).toStrictEqual([]);
      expect(normalized.selectedDomainId).toBeNull();
      expect(normalized.view).toStrictEqual(createDefaultView());
    });
  });

  describe('rBAC defaults', () => {
    it('pins the default policy: five actions, exact roles, all tenant-scoped', () => {
      expect(getDefaultRbacPolicy()).toStrictEqual({
        list: { roles: ['superadmin', 'admin'], tenantScoped: true },
        getById: { roles: ['superadmin', 'admin', 'user'], tenantScoped: true },
        create: { roles: ['superadmin', 'admin'], tenantScoped: true },
        update: { roles: ['superadmin', 'admin'], tenantScoped: true },
        delete: { roles: ['superadmin', 'admin'], tenantScoped: true }
      });
    });

    it('returns an independent copy per call, so entities cannot corrupt the default', () => {
      const first = getDefaultRbacPolicy();
      first.list.roles.push('intruder');
      first.delete.tenantScoped = false;
      expect(getDefaultRbacPolicy()).toStrictEqual({
        list: { roles: ['superadmin', 'admin'], tenantScoped: true },
        getById: { roles: ['superadmin', 'admin', 'user'], tenantScoped: true },
        create: { roles: ['superadmin', 'admin'], tenantScoped: true },
        update: { roles: ['superadmin', 'admin'], tenantScoped: true },
        delete: { roles: ['superadmin', 'admin'], tenantScoped: true }
      });
    });
  });
});
