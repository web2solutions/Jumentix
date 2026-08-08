/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */

/**
 * Unit suite for the import mappers extracted from
 * `apps/service-management/script.js` by JUM-469
 * (`packages/designer-core/src/importers/designerImporters.js`).
 *
 * Both mappers are exercised as pure functions over parsed JSON — no
 * FileReader, no DOM. The OAS round-trip test pins the export→import mapping
 * that JUM-471 (round-trip suite) and JUM-478 (lossless round-trip) build
 * on.
 */

const { buildDomainFromPackage, buildDomainsFromOas } = require(
  '@jumentix/designer-core/importers/designerImporters.js'
);
const { buildOasDocument } = require(
  '@jumentix/designer-core/exporters/designerExporters.js'
);
const { normalizeStatePayload, getDefaultRbacPolicy } = require(
  '@jumentix/designer-core/state/designerState.js'
);

describe('designer importers (JUM-469)', () => {
  describe('buildDomainFromPackage', () => {
    it('rejects documents without a domain entity list', () => {
      expect(buildDomainFromPackage(null, [])).toStrictEqual({ ok: false, reason: 'invalid-package' });
      expect(buildDomainFromPackage({}, [])).toStrictEqual({ ok: false, reason: 'invalid-package' });
      expect(buildDomainFromPackage({ domain: { name: 'X' } }, [])).toStrictEqual({ ok: false, reason: 'invalid-package' });
    });

    it('normalizes a valid package into a positioned domain', () => {
      const result = buildDomainFromPackage({
        domain: {
          name: 'Catalog',
          entities: [{
            name: 'Product',
            fields: [{
              name: 'id', type: 'uuid', pk: true, required: true
            }]
          }],
          context: {
            packageDependencies: ['shared', 'shared', 'kernel'],
            sharedValueObjects: ['money', 'money']
          }
        }
      }, []);
      expect(result.ok).toBe(true);
      expect(result.domain.name).toBe('Catalog');
      expect(result.domain.color).toBe('#60a5fa');
      expect([result.domain.x, result.domain.y]).toStrictEqual([120, 90]);
      expect(result.domain.context.packageDependencies).toStrictEqual(['shared', 'kernel']);
      expect(result.domain.context.sharedValueObjects).toStrictEqual(['money']);
      expect(result.domain.entities).toHaveLength(1);
      expect(result.domain.entities[0].fields[0].pk).toBe(true);
    });

    it('suffixes the domain name until it stops colliding', () => {
      const existing = [
        {
          id: 'd1', name: 'Catalog', context: {}, entities: []
        },
        {
          id: 'd2', name: 'Catalog_2', context: {}, entities: []
        }
      ];
      const result = buildDomainFromPackage({
        domain: { name: 'Catalog', entities: [] }
      }, existing);
      expect(result.ok).toBe(true);
      expect(result.domain.name).toBe('Catalog_3');
    });

    it('keeps incoming package dependencies that no existing domain declares', () => {
      const existing = [
        { id: 'd0', name: 'Other', entities: [] },
        {
          id: 'd1',
          name: 'Billing',
          context: { packageDependencies: ['shared'] },
          entities: []
        }
      ];
      const result = buildDomainFromPackage({
        domain: {
          name: 'Catalog',
          entities: [],
          context: { packageDependencies: ['shared', 'new-dep', 'new-dep'] }
        }
      }, existing);
      expect(result.domain.context.packageDependencies).toStrictEqual(['shared', 'new-dep']);
    });

    it('recomputes domain/entity ids that collide with the existing model, keeps free ids verbatim (JUM-617)', () => {
      const existing = [
        {
          id: 'domain-1',
          name: 'Catalog',
          entities: [{ id: 'entity-1', name: 'Product' }]
        }
      ];
      const result = buildDomainFromPackage({
        domain: {
          id: 'domain-1',
          name: 'Catalog',
          entities: [
            { id: 'entity-1', name: 'Product', fields: [] },
            { id: 'entity-9', name: 'Price', fields: [] },
            { id: 'entity-9', name: 'PriceCopy', fields: [] }
          ]
        }
      }, existing);
      expect(result.ok).toBe(true);
      // Colliding ids are recomputed...
      expect(result.domain.id).not.toBe('domain-1');
      expect(result.domain.entities[0].id).not.toBe('entity-1');
      // ...ids that are free cross verbatim...
      expect(result.domain.entities[1].id).toBe('entity-9');
      // ...and an id repeated within the package itself is recomputed too.
      expect(result.domain.entities[2].id).not.toBe('entity-9');
      const ids = [
        result.domain.id,
        ...result.domain.entities.map((entity: { id: string }) => entity.id)
      ];
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('handles a missing context on the incoming domain', () => {
      const result = buildDomainFromPackage({ domain: { name: 'Bare', entities: [] } }, []);
      expect(result.ok).toBe(true);
      expect(result.domain.context.packageDependencies).toStrictEqual([]);
      expect(result.domain.context.sharedValueObjects).toStrictEqual([]);
    });
  });

  describe('buildDomainsFromOas', () => {
    it('rejects documents without components.schemas', () => {
      expect(buildDomainsFromOas(null)).toStrictEqual({ ok: false, reason: 'invalid-oas' });
      expect(buildDomainsFromOas({})).toStrictEqual({ ok: false, reason: 'invalid-oas' });
      expect(buildDomainsFromOas({ components: { schemas: 'nope' } })).toStrictEqual({ ok: false, reason: 'invalid-oas' });
    });

    it('rejects documents whose schemas hold no usable entry', () => {
      expect(buildDomainsFromOas({ components: { schemas: {} } })).toStrictEqual({ ok: false, reason: 'no-schemas' });
      expect(buildDomainsFromOas({ components: { schemas: { Broken: null } } }))
        .toStrictEqual({ ok: false, reason: 'no-schemas' });
    });

    it('groups schemas by x-domain and maps fields back through fromOasType', () => {
      const result = buildDomainsFromOas({
        components: {
          schemas: {
            Billing_Invoice: {
              type: 'object',
              'x-domain': 'Billing',
              'x-entity': 'Invoice',
              required: ['id', 'total'],
              properties: {
                id: { type: 'string', format: 'uuid' },
                organizationId: { type: 'string', format: 'uuid' },
                total: { type: 'number', minimum: 0, maximum: 10 },
                day: { type: 'string', format: 'date' },
                at: { type: 'string', format: 'date-time' },
                active: { type: 'boolean' },
                count: { type: 'integer' },
                tags: { type: 'array', items: { type: 'string', format: 'uuid' }, nullable: true },
                meta: { type: 'object' },
                status: {
                  type: 'string', enum: ['open'], pattern: '^[a-z]+$', minLength: 2, maxLength: 6, description: 'State'
                }
              }
            },
            Billing_Receipt: {
              type: 'object',
              'x-domain': 'Billing',
              'x-entity': 'Receipt',
              properties: {}
            },
            Plain: {
              type: 'object'
            }
          }
        }
      });
      expect(result.ok).toBe(true);
      expect(result.domains).toHaveLength(2);

      const [billing, imported] = result.domains;
      expect(billing.name).toBe('Billing');
      expect(billing.entities).toHaveLength(2);

      const invoice = billing.entities[0];
      expect(invoice.name).toBe('Invoice');
      expect([invoice.x, invoice.y]).toStrictEqual([14, 14]);
      const byName = Object.fromEntries(
        invoice.fields.map((field: { name: string }) => [field.name, field])
      );
      expect(byName.id).toMatchObject({
        type: 'uuid', required: true, pk: true, unique: true, fk: false
      });
      expect(byName.organizationId).toMatchObject({
        type: 'uuid', required: false, pk: false, fk: true, unique: false
      });
      expect(byName.total).toMatchObject({
        type: 'number', required: true, minimum: 0, maximum: 10
      });
      expect(byName.day.type).toBe('date');
      expect(byName.at.type).toBe('datetime');
      expect(byName.active.type).toBe('boolean');
      expect(byName.count.type).toBe('integer');
      expect(byName.tags).toMatchObject({ type: 'array', itemsType: 'uuid', nullable: true });
      expect(byName.meta.type).toBe('object');
      expect(byName.status).toMatchObject({
        type: 'string',
        enumValues: ['open'],
        pattern: '^[a-z]+$',
        minLength: 2,
        maxLength: 6,
        description: 'State'
      });

      // Empty properties fall back to the default id/createdAt/updatedAt fields.
      const receipt = billing.entities[1];
      expect([receipt.x, receipt.y]).toStrictEqual([220, 14]);
      expect(receipt.fields.map((field: { name: string }) => field.name))
        .toStrictEqual(['id', 'createdAt', 'updatedAt']);

      // Without x-domain/x-entity the schema key and the Imported domain are used.
      expect(imported.name).toBe('Imported');
      expect(imported.entities[0].name).toBe('Plain');
      expect(imported.color).toBe('#34d399');
    });

    it('falls back to the Imported domain and schema key for blank markers, tolerating null field schemas', () => {
      const result = buildDomainsFromOas({
        components: {
          schemas: {
            Legacy: {
              type: 'object',
              'x-domain': '   ',
              'x-entity': ' ',
              properties: {
                ghost: null
              }
            }
          }
        }
      });
      expect(result.ok).toBe(true);
      expect(result.domains[0].name).toBe('Imported');
      expect(result.domains[0].entities[0].name).toBe('Legacy');
      expect(result.domains[0].entities[0].fields[0]).toMatchObject({ name: 'ghost', type: 'string' });
    });

    it('normalizes the JUM-478 entity meta extension set back into meta', () => {
      const result = buildDomainsFromOas({
        components: {
          schemas: {
            Billing_Invoice: {
              type: 'object',
              'x-domain': 'Billing',
              'x-entity': 'Invoice',
              'x-aggregate-root': true,
              'x-invariants': ['total must be positive'],
              'x-rbac': { list: { roles: ['superadmin'] } },
              'x-message-contracts': [{
                id: 'contract-1', name: 'issued', type: 'event', channel: 'billing.issued', version: '1.0.0'
              }],
              oneOf: [{ $ref: '#/components/schemas/Base' }, { $ref: 'common.yaml#Money' }],
              'x-external-refs': ['common.yaml#Money'],
              discriminator: { propertyName: 'kind' },
              properties: {
                id: { type: 'string', format: 'uuid' },
                code: { type: 'string', 'x-field-flags': { pk: false, fk: false, unique: true } }
              }
            },
            Billing_Receipt: {
              type: 'object',
              'x-domain': 'Billing',
              'x-entity': 'Receipt',
              'x-fieldless': true,
              properties: {}
            }
          }
        }
      });
      expect(result.ok).toBe(true);
      const [invoice, receipt] = result.domains[0].entities;
      expect(invoice.meta).toStrictEqual({
        aggregateRoot: true,
        invariants: ['total must be positive'],
        rbac: {
          list: { roles: ['superadmin'], tenantScoped: false },
          getById: { roles: ['superadmin', 'admin', 'user'], tenantScoped: true },
          create: { roles: ['superadmin', 'admin'], tenantScoped: true },
          update: { roles: ['superadmin', 'admin'], tenantScoped: true },
          delete: { roles: ['superadmin', 'admin'], tenantScoped: true }
        },
        contracts: [{
          id: 'contract-1',
          name: 'issued',
          type: 'event',
          channel: 'billing.issued',
          version: '1.0.0',
          payloadSchema: {}
        }],
        oasComposition: {
          mode: 'oneOf',
          // Local refs strip the prefix; anything else crosses verbatim.
          refs: ['Base', 'common.yaml#Money'],
          externalRefs: ['common.yaml#Money'],
          discriminator: 'kind'
        }
      });
      // x-field-flags overrides the name heuristic per flag.
      const byName = Object.fromEntries(
        invoice.fields.map((field: { name: string }) => [field.name, field])
      );
      expect(byName.code.unique).toBe(true);
      expect(byName.id.pk).toBe(true);
      // The fieldless marker keeps the empty field set (no default-fields fallback).
      expect(receipt.fields).toStrictEqual([]);
      expect(receipt.meta).toStrictEqual({
        aggregateRoot: false,
        invariants: [],
        rbac: getDefaultRbacPolicy(),
        contracts: [],
        oasComposition: {
          mode: '', refs: [], externalRefs: [], discriminator: ''
        }
      });
    });

    it('restores relationships from x-relations, dropping rows that resolve to no entity', () => {
      const result = buildDomainsFromOas({
        components: {
          schemas: {
            Billing_Invoice: {
              type: 'object', 'x-domain': 'Billing', 'x-entity': 'Invoice', properties: { id: { type: 'string' } }
            },
            Catalog_Product: {
              type: 'object', 'x-domain': 'Catalog', 'x-entity': 'Product', properties: { id: { type: 'string' } }
            }
          }
        },
        'x-relations': [
          {
            name: 'invoice products',
            fromSchema: 'Billing_Invoice',
            toSchema: 'Catalog_Product',
            fromCardinality: '1',
            toCardinality: 'N'
          },
          { name: 'ghost', fromSchema: 'Billing_Invoice', toSchema: 'RequestCreateBilling_Invoice' },
          { fromSchema: null, toSchema: 'Catalog_Product' }
        ]
      });
      expect(result.ok).toBe(true);
      expect(result.relationships).toHaveLength(1);
      const [relationship] = result.relationships;
      expect(relationship).toMatchObject({
        name: 'invoice products',
        fromEntityId: result.domains[0].entities[0].id,
        toEntityId: result.domains[1].entities[0].id,
        fromCardinality: '1',
        toCardinality: 'N'
      });
    });

    it('recognizes unmarked port objects by the canonical name and description conventions', () => {
      const result = buildDomainsFromOas({
        components: {
          schemas: {
            User: {
              type: 'object',
              description: 'Port output object for User resource.',
              properties: { id: { type: 'string' } }
            },
            RequestCreateUser: { type: 'object', properties: { id: { type: 'string' } } },
            UserArrayOf: { type: 'array', items: { $ref: '#/components/schemas/User' } },
            ResourceDeleteResponse: { type: 'object', properties: { data: { type: 'boolean' } } },
            AuthorizationHeader: {
              type: 'object',
              description: 'Port output object containing authorization header response contract.',
              properties: { Authorization: { type: 'string' } }
            },
            BooleanStringResult: { type: 'string', example: true }
          }
        }
      });
      expect(result.ok).toBe(true);
      // Only the entity contract survives; every port-object convention is skipped.
      expect(result.domains[0].entities.map((entity: { name: string }) => entity.name))
        .toStrictEqual(['User']);
    });

    it('round-trips an exported OAS document back to equivalent fields', () => {
      const state = normalizeStatePayload({
        domains: [{
          id: 'domain-1',
          name: 'Billing',
          entities: [{
            id: 'entity-1',
            name: 'Invoice',
            fields: [
              {
                name: 'id', type: 'uuid', required: true, pk: true, unique: true
              },
              {
                name: 'total', type: 'number', required: true, minimum: 0, maximum: 10
              },
              {
                name: 'tags', type: 'array', itemsType: 'string', nullable: true
              },
              {
                name: 'status', type: 'string', enum: ['open', 'paid'], pattern: '^[a-z]+$'
              }
            ]
          }]
        }],
        relationships: []
      });
      const oas = buildOasDocument(state);
      const result = buildDomainsFromOas(oas);
      expect(result.ok).toBe(true);
      expect(result.domains).toHaveLength(1);
      expect(result.domains[0].name).toBe('Billing');
      expect(result.domains[0].entities).toHaveLength(1);
      // The OAS mapping preserves every field facet the exporter emitted —
      // except `format`: typed fields carry it in OAS (string+format=uuid)
      // and the importer restores it verbatim, so `id` comes back with
      // format 'uuid' where the designer original kept ''. This pins the
      // pre-refactor round-trip asymmetry exactly as it was.
      const expectedFields = state.domains[0].entities[0].fields.map(
        (field: { name: string; format: string }) => ({ ...field })
      );
      expectedFields[0].format = 'uuid';
      expect(result.domains[0].entities[0].fields).toStrictEqual(expectedFields);
    });
  });
});

describe('package identity, graph warnings and importer-level merge (JUM-493)', () => {
  const packageDocument = (
    name: string,
    version: string,
    domain: Record<string, unknown>,
    dependencies: Array<Record<string, string>> = []
  ) => ({
    kind: 'domain-package',
    version: '2.0.0',
    exportedAt: '2026-08-08T00:00:00.000Z',
    package: { name, version, dependencies },
    domain
  });

  const installedDomain = (name: string, version: string, dependencies: string[] = []) => ({
    id: `domain-${name}`,
    name: `Domain_${name}`,
    entities: [] as Array<Record<string, unknown>>,
    context: {
      packageName: name,
      packageVersion: version,
      provenance: { package: name, version },
      packageDependencies: dependencies
    }
  });

  it('rejects a package block whose name is blank', () => {
    const result = buildDomainFromPackage(
      packageDocument('   ', '1.0.0', { name: 'X', entities: [] }),
      []
    );
    expect(result).toStrictEqual({ ok: false, reason: 'invalid-package' });
  });

  it('rejects a package block whose version does not parse', () => {
    const result = buildDomainFromPackage(
      packageDocument('p', 'banana', { name: 'X', entities: [] }),
      []
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('invalid-package-version');
  });

  it('tolerates existing domains with a non-array entities field when collecting taken ids', () => {
    const result = buildDomainFromPackage(
      packageDocument('p', '1.0.0', { name: 'New', entities: [] }),
      [{ id: 'd1', name: 'Old', entities: null }]
    );
    expect(result.ok).toBe(true);
  });

  it('warns about a registry cycle the incoming package is not part of', () => {
    const existing = [
      installedDomain('a', '1.0.0', ['b@*']),
      installedDomain('b', '1.0.0', ['a@*'])
    ];
    const result = buildDomainFromPackage(
      packageDocument('c', '1.0.0', { name: 'C', entities: [] }),
      existing
    );
    expect(result.ok).toBe(true);
    expect(result.warnings.some((warning: string) => warning.includes('Dependency cycle reported'))).toBe(true);
  });

  it('merges a newer version of an installed package, stamping appended entities through the importer callback', () => {
    const userEntity = {
      id: 'entity-user',
      name: 'User',
      fields: [{
        name: 'id', type: 'uuid', pk: true, required: true
      }],
      meta: {}
    };
    const existing = [{
      ...installedDomain('p', '1.0.0'),
      entities: [userEntity]
    }];
    const result = buildDomainFromPackage(
      packageDocument('p', '1.1.0', {
        name: 'Domain_p',
        entities: [
          {
            id: 'entity-user',
            name: 'User',
            fields: [{
              name: 'id', type: 'uuid', pk: true, required: true
            }]
          },
          {
            name: 'Order',
            fields: [{
              name: 'id', type: 'uuid', pk: true, required: true
            }]
          }
        ]
      }),
      existing
    );
    expect(result.ok).toBe(true);
    expect(result.merged).toBe(true);
    const order = result.domain.entities.find((entity: { name: string }) => entity.name === 'Order');
    expect(order).toBeDefined();
    expect(order.meta.provenance).toStrictEqual({ package: 'p', version: '1.1.0' });
    expect(result.preview.some((item: { message: string }) => item.message.includes('Order'))).toBe(true);
  });
});

describe('oAS composition and relation fallbacks (JUM-493)', () => {
  it('imports allOf-only schemas, composition entries without $ref, and unnamed relations', () => {
    const result = buildDomainsFromOas({
      components: {
        schemas: {
          Billing_Invoice: {
            'x-domain': 'Billing',
            type: 'object',
            properties: { id: { type: 'string', format: 'uuid' } },
            required: ['id']
          },
          Billing_Receipt: { 'x-domain': 'Billing', allOf: [{}] },
          Billing_Legacy: { 'x-domain': 'Billing', oneOf: [{}] }
        }
      },
      'x-relations': [
        {
          fromSchema: 'Billing_Invoice', toSchema: 'Billing_Receipt', fromCardinality: '1', toCardinality: 'N'
        }
      ]
    });
    expect(result.ok).toBe(true);
    const domain = result.domains.find((entry: { name: string }) => entry.name === 'Billing');
    expect(domain.entities).toHaveLength(3);
    // The relation row carried no name, so the fallback names it from its endpoints.
    expect(result.relationships[0].name).toBe('Billing_Invoice -> Billing_Receipt');
  });
});

// Keeps this file a module: with no import/export left, TypeScript would
// treat it as a script and its top-level requires would share one global
// scope with every other script-mode suite in ts-jest's program (TS2451).
// eslint-disable-next-line jest/no-export
export {};
