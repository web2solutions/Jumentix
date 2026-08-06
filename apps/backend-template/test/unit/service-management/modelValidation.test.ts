/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
import path from 'node:path';

/**
 * Unit suite for the validation engine extracted from
 * `apps/service-management/script.js` by JUM-469
 * (`apps/service-management/src/validation/modelValidation.js`).
 *
 * `collectModelIssues` is exercised as a pure function over a state object —
 * no DOM, no store. Every rule, message and severity is pinned against the
 * pre-refactor behaviour.
 */

const repoRoot = path.resolve(__dirname, '../../../../..');
const { collectModelIssues } = require(
  path.join(repoRoot, 'apps', 'service-management', 'src', 'validation', 'modelValidation.js')
);
const { getDefaultRbacPolicy, normalizeField } = require(
  path.join(repoRoot, 'apps', 'service-management', 'src', 'state', 'designerState.js')
);

function createEntity(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'entity-1',
    name: 'Invoice',
    fields: [normalizeField({
      name: 'id', type: 'uuid', required: true, pk: true
    }, 0)],
    meta: {
      aggregateRoot: true,
      invariants: [],
      rbac: getDefaultRbacPolicy(),
      contracts: [],
      oasComposition: {
        mode: '', refs: [], externalRefs: [], discriminator: ''
      }
    },
    ...overrides
  };
}

function createState(overrides: Record<string, unknown> = {}) {
  return {
    domains: [{
      id: 'domain-1',
      name: 'Billing',
      entities: [createEntity()]
    }],
    relationships: [],
    ...overrides
  };
}

function messages(issues: Array<{ message: string }>) {
  return issues.map((issue) => issue.message);
}

describe('model validation engine (JUM-469)', () => {
  it('reports no issues for a clean model', () => {
    expect(collectModelIssues(createState())).toStrictEqual([]);
  });

  it('flags empty and duplicate domain names', () => {
    const issues = collectModelIssues(createState({
      domains: [
        { id: 'domain-1', name: '', entities: [] },
        { id: 'domain-2', name: 'Billing', entities: [] },
        { id: 'domain-3', name: 'billing', entities: [] }
      ]
    }));
    expect(messages(issues)).toStrictEqual([
      'Domain with empty name found.',
      'Duplicate domain name: billing'
    ]);
    const shape = issues.map((issue: { severity: string; entityId: string | null }) => [
      issue.severity,
      issue.entityId
    ]);
    expect(shape).toStrictEqual([
      ['error', null],
      ['error', null]
    ]);
  });

  it('flags empty and duplicate entity names', () => {
    const issues = collectModelIssues(createState({
      domains: [{
        id: 'domain-1',
        name: 'Billing',
        entities: [
          createEntity({ id: 'entity-1', name: '' }),
          createEntity({ id: 'entity-2', name: 'Invoice' }),
          createEntity({ id: 'entity-3', name: 'INVOICE' })
        ]
      }]
    }));
    expect(messages(issues)).toStrictEqual([
      'Entity with empty name in domain Billing',
      'Duplicate entity name in domain Billing: INVOICE'
    ]);
    expect(issues[0].entityId).toBe('entity-1');
    expect(issues[1].entityId).toBe('entity-3');
  });

  it('flags empty and duplicated field names', () => {
    const issues = collectModelIssues(createState({
      domains: [{
        id: 'domain-1',
        name: 'Billing',
        entities: [createEntity({
          fields: [
            normalizeField({ name: 'id', type: 'uuid', pk: true }, 0),
            normalizeField({ name: 'total', type: 'number' }, 1),
            normalizeField({ name: 'Total', type: 'number' }, 2),
            { ...normalizeField({ name: 'notes', type: 'string' }, 3), name: '' }
          ]
        })]
      }]
    }));
    expect(messages(issues)).toStrictEqual([
      'Entity Billing/Invoice has duplicated field: Total',
      'Entity Billing/Invoice has an empty field name.'
    ]);
  });

  it('flags array fields without itemsType', () => {
    const field = normalizeField({ name: 'tags', type: 'array', itemsType: 'string' }, 1);
    field.itemsType = '';
    const issues = collectModelIssues(createState({
      domains: [{
        id: 'domain-1',
        name: 'Billing',
        entities: [createEntity({
          fields: [normalizeField({ name: 'id', type: 'uuid', pk: true }, 0), field]
        })]
      }]
    }));
    expect(messages(issues)).toStrictEqual([
      'Field Billing/Invoice.tags is array but has no itemsType.'
    ]);
  });

  it('flags inverted length and range constraints', () => {
    const issues = collectModelIssues(createState({
      domains: [{
        id: 'domain-1',
        name: 'Billing',
        entities: [createEntity({
          fields: [
            normalizeField({ name: 'id', type: 'uuid', pk: true }, 0),
            normalizeField({
              name: 'code', type: 'string', minLength: 9, maxLength: 3
            }, 1),
            normalizeField({
              name: 'total', type: 'number', minimum: 10, maximum: 2
            }, 2)
          ]
        })]
      }]
    }));
    expect(messages(issues)).toStrictEqual([
      'Field Billing/Invoice.code has minLength > maxLength.',
      'Field Billing/Invoice.total has minimum > maximum.'
    ]);
  });

  it('flags entities without a primary key', () => {
    const issues = collectModelIssues(createState({
      domains: [{
        id: 'domain-1',
        name: 'Billing',
        entities: [createEntity({ fields: [normalizeField({ name: 'name', type: 'string' }, 0)] })]
      }]
    }));
    expect(messages(issues)).toContain('Entity Billing/Invoice has no primary key field.');
  });

  it('warns about fields that are required and nullable at once', () => {
    const issues = collectModelIssues(createState({
      domains: [{
        id: 'domain-1',
        name: 'Billing',
        entities: [createEntity({
          fields: [
            normalizeField({ name: 'id', type: 'uuid', pk: true }, 0),
            normalizeField({
              name: 'name', type: 'string', required: true, nullable: true
            }, 1)
          ]
        })]
      }]
    }));
    expect(messages(issues)).toStrictEqual([
      'Field Billing/Invoice.name is required and nullable simultaneously.'
    ]);
    expect(issues[0].severity).toBe('warn');
  });

  it('warns about invariants on entities that are not aggregate roots', () => {
    const issues = collectModelIssues(createState({
      domains: [{
        id: 'domain-1',
        name: 'Billing',
        entities: [createEntity({
          meta: {
            aggregateRoot: false,
            invariants: ['total must be positive'],
            rbac: getDefaultRbacPolicy(),
            contracts: [],
            oasComposition: {}
          }
        })]
      }]
    }));
    expect(messages(issues)).toStrictEqual([
      'Entity Billing/Invoice has invariants but is not marked as aggregate root.'
    ]);
  });

  it('warns once per RBAC action without roles', () => {
    const entity = createEntity();
    entity.meta.rbac = {
      list: { roles: [], tenantScoped: true },
      getById: { roles: ['user'], tenantScoped: true },
      create: { roles: [], tenantScoped: true },
      update: { roles: [], tenantScoped: true },
      delete: { roles: [], tenantScoped: true }
    };
    const issues = collectModelIssues(createState({
      domains: [{ id: 'domain-1', name: 'Billing', entities: [entity] }]
    }));
    expect(messages(issues)).toStrictEqual([
      'Entity Billing/Invoice has no RBAC roles for action "list".',
      'Entity Billing/Invoice has no RBAC roles for action "create".',
      'Entity Billing/Invoice has no RBAC roles for action "update".',
      'Entity Billing/Invoice has no RBAC roles for action "delete".'
    ]);
  });

  it('flags contracts without name and warns about empty channels', () => {
    const entity = createEntity();
    entity.meta.contracts = [
      {
        id: 'c1', name: '', type: 'event', channel: '', version: '1.0.0', payloadSchema: {}
      },
      {
        id: 'c2', name: 'issued', type: 'event', channel: '', version: '1.0.0', payloadSchema: {}
      }
    ];
    const issues = collectModelIssues(createState({
      domains: [{ id: 'domain-1', name: 'Billing', entities: [entity] }]
    }));
    expect(messages(issues)).toStrictEqual([
      'Entity Billing/Invoice has a contract without name.',
      'Contract Billing/Invoice.unknown has empty channel/topic.',
      'Contract Billing/Invoice.issued has empty channel/topic.'
    ]);
    expect(issues[0].severity).toBe('error');
    expect(issues[1].severity).toBe('warn');
  });

  it('warns about compositions with too few refs and orphan discriminators', () => {
    const entity = createEntity();
    entity.meta.oasComposition = {
      mode: 'oneOf', refs: ['Only'], externalRefs: [], discriminator: ''
    };
    const other = createEntity({ id: 'entity-2', name: 'Receipt' });
    other.meta.oasComposition = {
      mode: '', refs: [], externalRefs: [], discriminator: 'kind'
    };
    const issues = collectModelIssues(createState({
      domains: [{ id: 'domain-1', name: 'Billing', entities: [entity, other] }]
    }));
    expect(messages(issues)).toStrictEqual([
      'Entity Billing/Invoice composition "oneOf" should reference at least 2 schemas.',
      'Entity Billing/Receipt has discriminator without composition mode.'
    ]);
  });

  it('flags relationships with missing endpoints, invalid cardinality and half bends', () => {
    const state = createState({
      relationships: [
        {
          id: 'rel-1',
          name: '',
          fromEntityId: 'entity-1',
          toEntityId: 'ghost',
          fromCardinality: 'M',
          toCardinality: '1',
          bendX: 10,
          bendY: null
        }
      ]
    });
    const issues = collectModelIssues(state);
    expect(messages(issues)).toStrictEqual([
      'Relationship "rel-1" references missing entities.',
      'Relationship "rel-1" has invalid cardinality.',
      'Relationship "rel-1" should define both bendX and bendY or none.'
    ]);
    expect(issues.map((issue: { severity: string }) => issue.severity)).toStrictEqual(['error', 'error', 'warn']);
  });

  it('accepts relationships with both bend coordinates set', () => {
    const state = createState({
      relationships: [{
        id: 'rel-1',
        name: 'self',
        fromEntityId: 'entity-1',
        toEntityId: 'entity-1',
        fromCardinality: 'N',
        toCardinality: '1',
        bendX: 10,
        bendY: 20
      }]
    });
    expect(collectModelIssues(state)).toStrictEqual([]);
  });
});
