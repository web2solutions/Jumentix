/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */

/**
 * First-run sample model suite (JUM-548).
 *
 * The sample is the designer's first impression, so the properties pinned
 * here are the ones a broken sample would silently lose:
 *
 * - It normalizes into the intended model: one `Users` domain with the five
 *   identity entities and three relationships, every artifact carrying the
 *   `sample-` id marker that distinguishes it from user work.
 * - It is deterministic: two builds are deep-equal, so the sample can serve
 *   as a fixture (JUM-471's round-trip reference) without id drift.
 * - It passes the export quality gate: `collectModelIssues` reports NOTHING
 *   on the normalized sample — a sample that cannot export, or that greets
 *   the first "Validate Model" click with warnings, teaches the wrong lesson.
 * - It exercises the otherwise invisible surfaces: a non-default RBAC rule
 *   whose tenant scoping is visibly derived from the roles, a message
 *   contract, invariants, and `oneOf` + discriminator composition whose refs
 *   resolve to real sample schemas in the exported OAS.
 * - It round-trips: JSON export → import is deep-equal (ids cross verbatim,
 *   marker included), and the OAS crossing reaches the export → import →
 *   export fixed point.
 */

const {
  SAMPLE_ID_PREFIX,
  buildSampleModelPayload,
  isSampleDomain,
  isSampleEntity,
  isSampleRelationship
} = require('@jumentix/designer-core/model/sampleModel.js');
const {
  normalizeStatePayload
} = require('@jumentix/designer-core/state/designerState.js');
const {
  collectModelIssues
} = require('@jumentix/designer-core/validation/modelValidation.js');
const {
  buildJsonExportDocument,
  buildOasDocument
} = require('@jumentix/designer-core/exporters/designerExporters.js');
const {
  buildDomainsFromOas
} = require('@jumentix/designer-core/importers/designerImporters.js');

function loadSample() {
  return normalizeStatePayload(buildSampleModelPayload());
}

function entityByName(
  state: { domains: Array<{ entities: Array<{ name: string }> }> },
  name: string
): any {
  return state.domains.flatMap((domain) => domain.entities).find((entity) => entity.name === name);
}

describe('first-run sample model (JUM-548)', () => {
  describe('content and marker', () => {
    it('normalizes into the intended identity model', () => {
      expect.hasAssertions();
      const state = loadSample();
      expect(state.domains).toHaveLength(1);
      const [users] = state.domains;
      expect(users.name).toBe('Users');
      expect(users.entities.map((entity: { name: string }) => entity.name))
        .toStrictEqual(['User', 'Organization', 'Email', 'Phone', 'ContactPoint']);
      expect(state.relationships.map((relationship: { name: string }) => relationship.name))
        .toStrictEqual(['User belongs to Organization', 'Email belongs to User', 'Phone belongs to User']);
      // Relationships resolve to real sample entities with valid cardinalities.
      state.relationships.forEach((relationship: { fromEntityId: string; toEntityId: string }) => {
        const ids = new Set(users.entities.map((entity: { id: string }) => entity.id));
        expect(ids.has(relationship.fromEntityId)).toBe(true);
        expect(ids.has(relationship.toEntityId)).toBe(true);
      });
      expect(state.selectedDomainId).toBe(users.id);
    });

    it('marks every sample artifact with the sample id prefix, and only those', () => {
      expect.hasAssertions();
      const state = loadSample();
      const [users] = state.domains;
      expect(users.id.startsWith(SAMPLE_ID_PREFIX)).toBe(true);
      expect(isSampleDomain(users)).toBe(true);
      users.entities.forEach((entity: { id: string }) => {
        expect(entity.id.startsWith(SAMPLE_ID_PREFIX)).toBe(true);
        expect(isSampleEntity(entity)).toBe(true);
      });
      state.relationships.forEach((relationship: { id: string }) => {
        expect(relationship.id.startsWith(SAMPLE_ID_PREFIX)).toBe(true);
        expect(isSampleRelationship(relationship)).toBe(true);
      });
      // User-built content (the id convention the designer itself assigns) is
      // never mistaken for sample content.
      expect(isSampleDomain({ id: 'domain-1' })).toBe(false);
      expect(isSampleEntity({ id: 'entity-7' })).toBe(false);
      expect(isSampleRelationship({ id: 'rel-3' })).toBe(false);
    });

    it('is deterministic: two builds are deep-equal (fixture-grade)', () => {
      expect.hasAssertions();
      expect(buildSampleModelPayload()).toStrictEqual(buildSampleModelPayload());
    });
  });

  describe('export quality gate', () => {
    it('reports zero model issues — the sample passes the export gate and validates clean', () => {
      expect.hasAssertions();
      // Zero issues at all, not only zero errors: the first "Validate Model"
      // click a new user makes lands on a clean result.
      expect(collectModelIssues(loadSample())).toStrictEqual([]);
    });
  });

  describe('exercised surfaces', () => {
    it('carries a non-default RBAC rule with tenant scoping visibly derived from the roles', () => {
      expect.hasAssertions();
      const organization = entityByName(loadSample(), 'Organization');
      // superadmin-only create: global boundary (tenantScoped false)...
      expect(organization.meta.rbac.create).toStrictEqual({
        roles: ['superadmin'],
        tenantScoped: false
      });
      // ...next to a tenant-scoped update — both derivations visible on real data.
      expect(organization.meta.rbac.update).toStrictEqual({
        roles: ['superadmin', 'admin'],
        tenantScoped: true
      });
    });

    it('carries aggregate invariants and a message contract with a channel and payload schema', () => {
      expect.hasAssertions();
      const user = entityByName(loadSample(), 'User');
      expect(user.meta.aggregateRoot).toBe(true);
      expect(user.meta.invariants.length).toBeGreaterThan(0);
      expect(user.meta.contracts).toHaveLength(1);
      expect(user.meta.contracts[0]).toMatchObject({
        name: 'UserRegistered',
        type: 'event',
        channel: 'users/user-registered',
        version: '1.0.0'
      });
      expect(user.meta.contracts[0].payloadSchema.type).toBe('object');
    });

    it('carries oneOf composition with a discriminator whose refs resolve to real sample schemas', () => {
      expect.hasAssertions();
      const contactPoint = entityByName(loadSample(), 'ContactPoint');
      expect(contactPoint.meta.oasComposition).toStrictEqual({
        mode: 'oneOf',
        refs: ['Users_Email', 'Users_Phone'],
        externalRefs: [],
        discriminator: 'kind'
      });
      const document = buildOasDocument(loadSample());
      expect(document.components.schemas.Users_Email).toBeDefined();
      expect(document.components.schemas.Users_Phone).toBeDefined();
      expect(document.components.schemas.Users_ContactPoint.oneOf).toStrictEqual([
        { $ref: '#/components/schemas/Users_Email' },
        { $ref: '#/components/schemas/Users_Phone' }
      ]);
      expect(document.components.schemas.Users_ContactPoint.discriminator).toStrictEqual({
        propertyName: 'kind',
        mapping: {
          Users_Email: '#/components/schemas/Users_Email',
          Users_Phone: '#/components/schemas/Users_Phone'
        }
      });
    });
  });

  describe('round-trip (the sample doubles as a JUM-471 fixture)', () => {
    it('round-trips deep-equal through the JSON export/import crossing, marker ids included', () => {
      expect.hasAssertions();
      const state = loadSample();
      const document = buildJsonExportDocument(state);
      const imported = normalizeStatePayload(JSON.parse(JSON.stringify(document)));
      expect(imported.domains).toStrictEqual(state.domains);
      expect(imported.relationships).toStrictEqual(state.relationships);
      expect(imported.view).toStrictEqual(state.view);
    });

    it('reaches the export → import → export fixed point through the OAS crossing', () => {
      expect.hasAssertions();
      const state = loadSample();
      const first = buildOasDocument(state);
      // The exercised surfaces cross as agreed extensions (JUM-478).
      expect(first['x-relations']).toHaveLength(3);
      const firstImport = buildDomainsFromOas(JSON.parse(JSON.stringify(first)));
      expect(firstImport.ok).toBe(true);
      expect(firstImport.domains[0].entities).toHaveLength(5);
      expect(firstImport.relationships).toHaveLength(3);
      const second = buildOasDocument({
        domains: firstImport.domains,
        relationships: firstImport.relationships
      });
      const secondImport = buildDomainsFromOas(JSON.parse(JSON.stringify(second)));
      const third = buildOasDocument({
        domains: secondImport.domains,
        relationships: secondImport.relationships
      });
      expect(third).toStrictEqual(second);
    });
  });
});

describe('sample id-marker predicates on nullish subjects (JUM-493)', () => {
  it('treat missing or non-string ids as non-sample, never throwing', () => {
    expect.hasAssertions();
    expect(isSampleDomain(undefined)).toBe(false);
    expect(isSampleDomain({})).toBe(false);
    expect(isSampleDomain({ id: 'user-1' })).toBe(false);
    expect(isSampleEntity(null)).toBe(false);
    expect(isSampleEntity({ id: `${SAMPLE_ID_PREFIX}entity-1` })).toBe(true);
    expect(isSampleRelationship({ name: 'owns' })).toBe(false);
  });
});

// Keeps this file a module: with no import/export left, TypeScript would
// treat it as a script and its top-level requires would share one global
// scope with every other script-mode suite in ts-jest's program (TS2451).
// eslint-disable-next-line jest/no-export
export {};
