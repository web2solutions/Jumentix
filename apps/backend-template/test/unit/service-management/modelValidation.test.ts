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
      'Duplicate entity name in domain Billing: INVOICE',
      // JUM-474: case-distinct duplicates also collapse onto one OAS route.
      'Entities Billing/Invoice and Billing/INVOICE resolve to the same OAS route path: /billing/invoice'
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

describe('model validation severity contract (JUM-470)', () => {
  it('pins every issue type with its exact message, severity and focus entity, in engine order', () => {
    const rbacEmpty = {
      list: { roles: [], tenantScoped: true },
      getById: { roles: [], tenantScoped: true },
      create: { roles: [], tenantScoped: true },
      update: { roles: [], tenantScoped: true },
      delete: { roles: [], tenantScoped: true }
    };
    const emptyNamed = createEntity({ id: 'entity-empty', name: '' });
    const broken = createEntity({ id: 'entity-broken', name: 'Invoice' });
    broken.fields = [
      { ...normalizeField({ name: 'tags', type: 'array' }, 0), itemsType: '' },
      normalizeField({
        name: 'code', type: 'string', minLength: 9, maxLength: 3
      }, 1),
      normalizeField({ name: 'Code', type: 'string' }, 2),
      normalizeField({
        name: 'total', type: 'number', minimum: 10, maximum: 2
      }, 3),
      normalizeField({
        name: 'name', type: 'string', required: true, nullable: true
      }, 4),
      { ...normalizeField({ name: 'notes', type: 'string' }, 5), name: '' }
    ];
    broken.meta = {
      aggregateRoot: false,
      invariants: ['total must be positive'],
      rbac: rbacEmpty,
      contracts: [
        {
          id: 'c1', name: '', type: 'event', channel: '', version: '1.0.0', payloadSchema: {}
        },
        {
          id: 'c2', name: 'issued', type: 'event', channel: '', version: '1.0.0', payloadSchema: {}
        }
      ],
      oasComposition: {
        mode: 'oneOf', refs: ['Only'], externalRefs: [], discriminator: ''
      }
    };
    const clean = createEntity({ id: 'entity-clean', name: 'Receipt' });
    clean.meta.oasComposition = {
      mode: '', refs: [], externalRefs: [], discriminator: 'kind'
    };

    const state = createState({
      domains: [
        { id: 'domain-empty', name: '', entities: [] },
        { id: 'domain-1', name: 'Billing', entities: [emptyNamed, broken, clean] },
        { id: 'domain-2', name: 'billing', entities: [] }
      ],
      relationships: [{
        id: 'rel-1',
        name: '',
        fromEntityId: 'entity-clean',
        toEntityId: 'ghost',
        fromCardinality: 'M',
        toCardinality: '1',
        bendX: 10,
        bendY: null
      }]
    });

    const issues = collectModelIssues(state);
    type Issue = { message: string; severity: string; entityId: string | null };
    const shape = issues.map((issue: Issue) => [
      issue.message,
      issue.severity,
      issue.entityId
    ]);
    expect(shape).toStrictEqual([
      ['Domain with empty name found.', 'error', null],
      ['Entity with empty name in domain Billing', 'error', 'entity-empty'],
      ['Field Billing/Invoice.tags is array but has no itemsType.', 'error', 'entity-broken'],
      ['Field Billing/Invoice.code has minLength > maxLength.', 'error', 'entity-broken'],
      ['Entity Billing/Invoice has duplicated field: Code', 'error', 'entity-broken'],
      ['Field Billing/Invoice.total has minimum > maximum.', 'error', 'entity-broken'],
      ['Field Billing/Invoice.name is required and nullable simultaneously.', 'warn', 'entity-broken'],
      ['Entity Billing/Invoice has an empty field name.', 'error', 'entity-broken'],
      ['Entity Billing/Invoice has no primary key field.', 'error', 'entity-broken'],
      ['Entity Billing/Invoice has invariants but is not marked as aggregate root.', 'warn', 'entity-broken'],
      ['Entity Billing/Invoice has no RBAC roles for action "list".', 'warn', 'entity-broken'],
      ['Entity Billing/Invoice has no RBAC roles for action "getById".', 'warn', 'entity-broken'],
      ['Entity Billing/Invoice has no RBAC roles for action "create".', 'warn', 'entity-broken'],
      ['Entity Billing/Invoice has no RBAC roles for action "update".', 'warn', 'entity-broken'],
      ['Entity Billing/Invoice has no RBAC roles for action "delete".', 'warn', 'entity-broken'],
      ['Entity Billing/Invoice has a contract without name.', 'error', 'entity-broken'],
      ['Contract Billing/Invoice.unknown has empty channel/topic.', 'warn', 'entity-broken'],
      ['Contract Billing/Invoice.issued has empty channel/topic.', 'warn', 'entity-broken'],
      ['Entity Billing/Invoice composition "oneOf" should reference at least 2 schemas.', 'warn', 'entity-broken'],
      ['Entity Billing/Receipt has discriminator without composition mode.', 'warn', 'entity-clean'],
      ['Duplicate domain name: billing', 'error', null],
      ['Relationship "rel-1" references missing entities.', 'error', null],
      ['Relationship "rel-1" has invalid cardinality.', 'error', null],
      ['Relationship "rel-1" should define both bendX and bendY or none.', 'warn', null]
    ]);
    // The severity vocabulary is exactly error|warn here: no rule emits 'info',
    // so the export gate's `severity === 'error'` filter sees everything it must.
    expect([...new Set(issues.map((issue: { severity: string }) => issue.severity))].sort())
      .toStrictEqual(['error', 'warn']);
  });
});

describe('export quality gate boundary (JUM-470)', () => {
  // `canExportModel` (script.js) blocks exactly when the engine reports at
  // least one `severity === 'error'` issue. Both directions are pinned here:
  // a false negative ships a broken OAS, a false positive blocks a valid model.
  it('a model with only warnings stays below the blocking threshold', () => {
    const entity = createEntity({
      fields: [
        normalizeField({ name: 'id', type: 'uuid', pk: true }, 0),
        normalizeField({
          name: 'name', type: 'string', required: true, nullable: true
        }, 1)
      ]
    });
    entity.meta.rbac = {
      list: { roles: [], tenantScoped: true },
      getById: { roles: [], tenantScoped: true },
      create: { roles: [], tenantScoped: true },
      update: { roles: [], tenantScoped: true },
      delete: { roles: [], tenantScoped: true }
    };
    const issues = collectModelIssues(createState({
      domains: [{ id: 'domain-1', name: 'Billing', entities: [entity] }]
    }));
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((issue: { severity: string }) => issue.severity === 'warn')).toBe(true);
    expect(issues.some((issue: { severity: string }) => issue.severity === 'error')).toBe(false);
  });

  it('a single error crosses the blocking threshold', () => {
    const issues = collectModelIssues(createState({
      domains: [{
        id: 'domain-1',
        name: 'Billing',
        entities: [createEntity({ fields: [normalizeField({ name: 'name', type: 'string' }, 0)] })]
      }]
    }));
    const critical = issues.filter((issue: { severity: string }) => issue.severity === 'error');
    expect(critical).toHaveLength(1);
    expect(critical[0].message).toBe('Entity Billing/Invoice has no primary key field.');
  });
});

describe('validation boundary inputs (JUM-470)', () => {
  it('treats a partial RBAC policy as empty roles instead of crashing', () => {
    const entity = createEntity();
    entity.meta.rbac = { list: { roles: 'oops', tenantScoped: true } };
    const issues = collectModelIssues(createState({
      domains: [{ id: 'domain-1', name: 'Billing', entities: [entity] }]
    }));
    expect(messages(issues)).toStrictEqual([
      'Entity Billing/Invoice has no RBAC roles for action "list".',
      'Entity Billing/Invoice has no RBAC roles for action "getById".',
      'Entity Billing/Invoice has no RBAC roles for action "create".',
      'Entity Billing/Invoice has no RBAC roles for action "update".',
      'Entity Billing/Invoice has no RBAC roles for action "delete".'
    ]);
    expect(issues.every((issue: { severity: string }) => issue.severity === 'warn')).toBe(true);
  });

  it('ignores non-array invariants and contracts and a missing oasComposition', () => {
    const entity = createEntity();
    entity.meta = {
      aggregateRoot: false,
      invariants: 'not-an-array',
      rbac: getDefaultRbacPolicy(),
      contracts: 'nope'
    };
    expect(collectModelIssues(createState({
      domains: [{ id: 'domain-1', name: 'Billing', entities: [entity] }]
    }))).toStrictEqual([]);
  });

  it('validates an entity without meta against the installed default RBAC policy', () => {
    const entity = {
      id: 'entity-1',
      name: 'Invoice',
      fields: [normalizeField({ name: 'id', type: 'uuid', pk: true }, 0)]
    };
    expect(collectModelIssues(createState({
      domains: [{ id: 'domain-1', name: 'Billing', entities: [entity] }]
    }))).toStrictEqual([]);
  });

  it('does not flag a well-formed array field or a two-ref composition', () => {
    const entity = createEntity({
      fields: [
        normalizeField({ name: 'id', type: 'uuid', pk: true }, 0),
        normalizeField({ name: 'tags', type: 'array', itemsType: 'string' }, 1)
      ]
    });
    entity.meta.oasComposition = {
      mode: 'allOf', refs: ['A', 'B'], externalRefs: [], discriminator: 'kind'
    };
    expect(collectModelIssues(createState({
      domains: [{ id: 'domain-1', name: 'Billing', entities: [entity] }]
    }))).toStrictEqual([]);
  });

  it('does not flag equal or single-sided length and range constraints', () => {
    const entity = createEntity({
      fields: [
        normalizeField({ name: 'id', type: 'uuid', pk: true }, 0),
        normalizeField({
          name: 'a', type: 'string', minLength: 3, maxLength: 3
        }, 1),
        normalizeField({
          name: 'b', type: 'number', minimum: 2, maximum: 2
        }, 2),
        normalizeField({ name: 'c', type: 'string', minLength: 1 }, 3),
        normalizeField({ name: 'd', type: 'number', maximum: 5 }, 4)
      ]
    });
    expect(collectModelIssues(createState({
      domains: [{ id: 'domain-1', name: 'Billing', entities: [entity] }]
    }))).toStrictEqual([]);
  });

  it('does not flag a relationship with no bend coordinates', () => {
    const state = createState({
      relationships: [{
        id: 'rel-1',
        name: 'link',
        fromEntityId: 'entity-1',
        toEntityId: 'entity-1',
        fromCardinality: '1',
        toCardinality: 'N'
      }]
    });
    expect(collectModelIssues(state)).toStrictEqual([]);
  });
});

describe('oas export gate collisions (JUM-474)', () => {
  it('reports an error when distinct entity names collapse to the same OAS schema name and route path', () => {
    const issues = collectModelIssues({
      domains: [
        {
          id: 'domain-1',
          name: 'Foo Bar',
          entities: [createEntity({ id: 'entity-1', name: 'Baz' })]
        },
        {
          id: 'domain-2',
          name: 'Foo-Bar',
          entities: [createEntity({ id: 'entity-2', name: 'Baz' })]
        }
      ],
      relationships: []
    });
    expect(messages(issues)).toStrictEqual([
      'Entities Foo Bar/Baz and Foo-Bar/Baz resolve to the same OAS schema name: Foo_Bar_Baz',
      'Entities Foo Bar/Baz and Foo-Bar/Baz resolve to the same OAS route path: /foo-bar/baz'
    ]);
    expect(issues.every((issue: { severity: string }) => issue.severity === 'error')).toBe(true);
  });

  it('reports an error when two domains share an entity route but not a schema name', () => {
    // Same route path, different schema names: the exported document would
    // silently keep only one path item.
    const issues = collectModelIssues({
      domains: [
        {
          id: 'domain-1',
          name: 'Billing',
          entities: [createEntity({ id: 'entity-1', name: 'Invoice' })]
        },
        {
          id: 'domain-2',
          name: 'billing',
          entities: [createEntity({ id: 'entity-2', name: 'Invoice' })]
        }
      ],
      relationships: []
    });
    expect(messages(issues)).toStrictEqual([
      'Duplicate domain name: billing',
      'Entities Billing/Invoice and billing/Invoice resolve to the same OAS route path: /billing/invoice'
    ]);
  });

  it('does not flag entities whose names survive the OAS tokenisation intact', () => {
    expect(collectModelIssues({
      domains: [
        {
          id: 'domain-1',
          name: 'Billing',
          entities: [createEntity({ id: 'entity-1', name: 'Invoice' })]
        },
        {
          id: 'domain-2',
          name: 'Catalog',
          entities: [createEntity({ id: 'entity-2', name: 'Invoice' })]
        }
      ],
      relationships: []
    })).toStrictEqual([]);
  });
});
