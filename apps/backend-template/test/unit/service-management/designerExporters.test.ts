/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
import path from 'node:path';

/**
 * Unit suite for the export builders extracted from
 * `apps/service-management/script.js` by JUM-469
 * (`apps/service-management/src/exporters/designerExporters.js`).
 *
 * These tests pin the export artifact shapes: for the same input the
 * builders must produce output byte-identical to the pre-refactor
 * exporters — the strongest guarantee that the split changed nothing, and
 * the baseline the contract-parity lane (JUM-474/475/476/478) rewrites from.
 * The AsyncAPI builder moved to `asyncApiExporters.js` under JUM-475
 * (canonical `spec/asyncapi/` targeting) and is pinned by
 * `designerAsyncApiExport.test.ts`.
 */

const repoRoot = path.resolve(__dirname, '../../../../..');
const {
  buildBoilerplateBundleDocument,
  buildDomainPackageDocument,
  buildJsonExportDocument,
  buildJsonSchemaDocument,
  buildMarkdownExport,
  buildOasDocument
} = require(path.join(repoRoot, 'apps', 'service-management', 'src', 'exporters', 'designerExporters.js'));
const { normalizeStatePayload } = require(
  path.join(repoRoot, 'apps', 'service-management', 'src', 'state', 'designerState.js')
);

function createState() {
  return normalizeStatePayload({
    domains: [{
      id: 'domain-1',
      name: 'Billing',
      color: '#86efac',
      x: 1,
      y: 2,
      context: {
        ubiquitousLanguage: 'en',
        upstreamDependencies: ['erp'],
        packageDependencies: ['shared-kernel']
      },
      entities: [{
        id: 'entity-1',
        name: 'Invoice',
        x: 0,
        y: 0,
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
        ],
        meta: {
          aggregateRoot: true,
          invariants: ['total must be positive'],
          contracts: [{
            id: 'contract-1',
            name: 'issued',
            type: 'event',
            channel: 'billing.issued',
            version: '1.0.0',
            payloadSchema: { type: 'object' }
          }],
          oasComposition: {
            mode: 'oneOf', refs: ['Base', 'Audited'], externalRefs: ['common.yaml#Money'], discriminator: 'kind'
          }
        }
      }]
    }],
    relationships: [{
      id: 'rel-1',
      fromEntityId: 'entity-1',
      toEntityId: 'entity-1',
      name: 'self link',
      fromCardinality: 'N',
      toCardinality: '1'
    }],
    view: { zoom: 1.2 }
  });
}

const EXPECTED_INVOICE_PROPERTIES = {
  id: { type: 'string', format: 'uuid' },
  total: { type: 'number', minimum: 0, maximum: 10 },
  tags: { type: 'array', items: { type: 'string' }, nullable: true },
  status: { type: 'string', enum: ['open', 'paid'], pattern: '^[a-z]+$' }
};

describe('designer exporters (JUM-469)', () => {
  it('builds the JSON export document with domains, relationships and view', () => {
    const state = createState();
    const document = buildJsonExportDocument(state);
    expect(document).toStrictEqual({
      domains: state.domains,
      relationships: state.relationships,
      view: state.view
    });
    expect(Object.keys(document)).toStrictEqual(['domains', 'relationships', 'view']);
  });

  it('builds the markdown export verbatim', () => {
    const markdown = buildMarkdownExport(createState());
    const expected = [
      '# Domain Designer Model',
      '',
      '## Domain: Billing',
      '',
      '- Ubiquitous Language: en',
      '- Owner Team: -',
      '- Upstream: erp',
      '- Downstream: -',
      '- Integration Channel: -',
      '- Package Dependencies: shared-kernel',
      '- Shared Value Objects: -',
      '',
      '### Entity: Invoice',
      '',
      '- Aggregate Root: true',
      '- Invariants: total must be positive',
      '',
      '| Field | Type | Required | PK | FK | Unique | Nullable |',
      '|---|---|---:|---:|---:|---:|---:|',
      '| id | uuid | true | true | false | true | false |',
      '| total | number | true | false | false | false | false |',
      '| tags | array | false | false | false | false | true |',
      '| status | string | false | false | false | false | false |',
      '',
      'RBAC:',
      '- list: [superadmin, admin], tenantScoped=true',
      '- getById: [superadmin, admin, user], tenantScoped=true',
      '- create: [superadmin, admin], tenantScoped=true',
      '- update: [superadmin, admin], tenantScoped=true',
      '- delete: [superadmin, admin], tenantScoped=true',
      '',
      'Message Contracts:',
      '- event:issued | channel=billing.issued | version=1.0.0',
      '',
      '## Relationships',
      '',
      '- self link: Billing/Invoice (N) -> (1) Billing/Invoice'
    ].join('\n');
    expect(markdown).toBe(expected);
  });

  it('builds the markdown export for an empty model', () => {
    expect(buildMarkdownExport({ domains: [], relationships: [] })).toBe('# Domain Designer Model\n');
  });

  it('builds the markdown export for entities without contracts', () => {
    const markdown = buildMarkdownExport(normalizeStatePayload({
      domains: [{
        id: 'domain-1',
        name: 'Solo',
        entities: [{ id: 'entity-1', name: 'Thing', fields: [{ name: 'id', type: 'uuid', pk: true }] }]
      }],
      relationships: []
    }));
    expect(markdown).toContain('Message Contracts:\n- none');
    expect(markdown).not.toContain('## Relationships');
  });

  it('builds the JSON Schema document with draft 2020-12 definitions', () => {
    const document = buildJsonSchemaDocument(createState());
    expect(document).toStrictEqual({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      title: 'Domain Designer JSON Schemas',
      type: 'object',
      definitions: {
        Billing_Invoice: {
          $id: 'Billing_Invoice',
          type: 'object',
          properties: EXPECTED_INVOICE_PROPERTIES,
          required: ['id', 'total'],
          additionalProperties: false
        }
      }
    });
  });

  it('builds the boilerplate bundle with the hexagonal file layout', () => {
    const document = buildBoilerplateBundleDocument(createState(), '2026-08-05T00:00:00.000Z');
    expect(Object.keys(document)).toStrictEqual(['kind', 'version', 'generatedAt', 'modules']);
    expect(document.kind).toBe('boilerplate-bundle');
    expect(document.version).toBe('2.0.0');
    expect(document.generatedAt).toBe('2026-08-05T00:00:00.000Z');
    // One module per domain, files carry path + content (JUM-476).
    expect(document.modules).toHaveLength(1);
    const [module] = document.modules;
    expect(module.module).toBe('Billing');
    expect(module.path).toBe('src/modules/Billing');
    expect(Object.keys(module.files)).toStrictEqual(['composition', 'eventChannels']);
    expect(module.files.composition.path)
      .toBe('src/modules/Billing/composition/composeBillingServices.ts');
    expect(module.files.eventChannels.path)
      .toBe('src/modules/Billing/events/contracts/BillingEventChannels.ts');
    expect(module.entities).toHaveLength(1);
    const [entity] = module.entities;
    expect(entity.entity).toBe('Invoice');
    expect(Object.keys(entity.files)).toStrictEqual([
      'entityInterface',
      'model',
      'security',
      'repositoryPort',
      'useCasesPort',
      'useCases',
      'persistenceAdapter',
      'controller'
    ]);
    expect(entity.files.entityInterface.path).toBe('src/modules/Billing/domain/Entity/IInvoice.ts');
    expect(entity.files.model.path).toBe('src/modules/Billing/domain/Model/Invoice.ts');
    expect(entity.files.security.path).toBe('src/modules/Billing/domain/security/InvoiceRbac.ts');
    expect(entity.files.repositoryPort.path)
      .toBe('src/modules/Billing/application/ports/IInvoiceRepository.ts');
    expect(entity.files.useCasesPort.path)
      .toBe('src/modules/Billing/application/ports/IInvoiceUseCases.ts');
    expect(entity.files.useCases.path)
      .toBe('src/modules/Billing/application/use-cases/InvoiceUseCases.ts');
    expect(entity.files.persistenceAdapter.path)
      .toBe('src/modules/Billing/adapters/out/persistence/InvoiceDataRepository.ts');
    expect(entity.files.controller.path)
      .toBe('src/modules/Billing/adapters/in/http/controllers/InvoiceController.ts');
    const moduleFiles = module.files as Record<string, { path: string; content: string }>;
    const entityFiles = entity.files as Record<string, { path: string; content: string }>;
    Object.values(moduleFiles).forEach((file) => {
      expect(typeof file.content).toBe('string');
      expect(file.content.length).toBeGreaterThan(0);
    });
    Object.values(entityFiles).forEach((file) => {
      expect(typeof file.content).toBe('string');
      expect(file.content.length).toBeGreaterThan(0);
    });
  });

  it('defaults the bundle timestamp to the current ISO time', () => {
    const document = buildBoilerplateBundleDocument(createState());
    expect(document.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('builds the domain package around the selected domain', () => {
    const state = createState();
    const document = buildDomainPackageDocument(state.domains[0], '2026-08-05T00:00:00.000Z');
    expect(document.kind).toBe('domain-package');
    expect(document.version).toBe('1.0.0');
    expect(document.exportedAt).toBe('2026-08-05T00:00:00.000Z');
    expect(document.domain).toBe(state.domains[0]);
    expect(Object.keys(document)).toStrictEqual(['kind', 'version', 'exportedAt', 'domain']);
    expect(buildDomainPackageDocument(state.domains[0]).exportedAt)
      .toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('builds the OAS 3.1 document with schemas, paths and x- extensions', () => {
    const document = buildOasDocument(createState());
    expect(document.openapi).toBe('3.1.0');
    expect(document.info).toStrictEqual({ title: 'Domain Designer Export', version: '1.0.0' });

    expect(document.components.schemas.Billing_Invoice).toStrictEqual({
      type: 'object',
      properties: EXPECTED_INVOICE_PROPERTIES,
      required: ['id', 'total'],
      'x-domain': 'Billing',
      'x-entity': 'Invoice',
      'x-message-contracts': [{
        id: 'contract-1',
        name: 'issued',
        type: 'event',
        channel: 'billing.issued',
        version: '1.0.0',
        payloadSchema: { type: 'object' }
      }],
      oneOf: [
        { $ref: '#/components/schemas/Base' },
        { $ref: '#/components/schemas/Audited' }
      ],
      'x-external-refs': ['common.yaml#Money'],
      discriminator: {
        propertyName: 'kind',
        mapping: {
          Base: '#/components/schemas/Base',
          Audited: '#/components/schemas/Audited'
        }
      }
    });

    const schemaRef = { $ref: '#/components/schemas/Billing_Invoice' };
    const idParam = [{
      name: 'id', in: 'path', required: true, schema: { type: 'string' }
    }];
    expect(document.paths['/billing/invoice']).toStrictEqual({
      get: {
        operationId: 'listBilling_Invoice',
        responses: {
          200: {
            description: 'Success',
            content: { 'application/json': { schema: { type: 'array', items: schemaRef } } }
          }
        }
      },
      post: {
        operationId: 'createBilling_Invoice',
        requestBody: { required: true, content: { 'application/json': { schema: schemaRef } } },
        responses: {
          201: { description: 'Created', content: { 'application/json': { schema: schemaRef } } }
        }
      }
    });
    expect(document.paths['/billing/invoice/{id}']).toStrictEqual({
      get: {
        operationId: 'getBilling_InvoiceById',
        parameters: idParam,
        responses: {
          200: { description: 'Success', content: { 'application/json': { schema: schemaRef } } },
          404: { description: 'Not found' }
        }
      },
      patch: {
        operationId: 'updateBilling_Invoice',
        parameters: idParam,
        requestBody: { required: true, content: { 'application/json': { schema: schemaRef } } },
        responses: {
          200: { description: 'Updated', content: { 'application/json': { schema: schemaRef } } },
          404: { description: 'Not found' }
        }
      },
      delete: {
        operationId: 'deleteBilling_Invoice',
        parameters: idParam,
        responses: {
          204: { description: 'Deleted' },
          404: { description: 'Not found' }
        }
      }
    });

    expect(document['x-message-contracts']).toStrictEqual([{
      id: 'contract-1',
      name: 'issued',
      type: 'event',
      channel: 'billing.issued',
      version: '1.0.0',
      payloadSchema: { type: 'object' },
      domain: 'Billing',
      entity: 'Invoice'
    }]);
    expect(document['x-relations']).toStrictEqual([{
      name: 'self link',
      fromEntityId: 'entity-1',
      toEntityId: 'entity-1',
      fromSchema: 'Billing_Invoice',
      toSchema: 'Billing_Invoice',
      fromCardinality: 'N',
      toCardinality: '1'
    }]);
  });

  it('omits composition extensions for entities without OAS composition', () => {
    // Literal state (not normalizeStatePayload, which drops dangling
    // relationships) so the x-relations null-schema branch is reachable.
    const state = {
      domains: [{
        id: 'domain-1',
        name: 'Solo',
        entities: [{
          id: 'entity-1',
          name: 'Thing',
          fields: [{
            name: 'id', type: 'uuid', required: true, pk: true
          }],
          meta: {
            contracts: [],
            oasComposition: {
              mode: '', refs: [], externalRefs: [], discriminator: ''
            }
          }
        }]
      }],
      relationships: [{
        id: 'rel-9',
        name: 'ghost link',
        fromEntityId: 'ghost-a',
        toEntityId: 'ghost-b',
        fromCardinality: '1',
        toCardinality: 'N'
      }]
    };
    const document = buildOasDocument(state);
    const schema = document.components.schemas.Solo_Thing;
    expect(schema.oneOf).toBeUndefined();
    expect(schema.allOf).toBeUndefined();
    expect(schema.anyOf).toBeUndefined();
    expect(schema['x-external-refs']).toBeUndefined();
    expect(schema.discriminator).toBeUndefined();
    expect(schema['x-message-contracts']).toStrictEqual([]);
    expect(document['x-relations'][0].fromSchema).toBeNull();
    expect(document['x-relations'][0].toSchema).toBeNull();
  });

  it('emits discriminator mapping only for declared refs', () => {
    const document = buildOasDocument(normalizeStatePayload({
      domains: [{
        id: 'domain-1',
        name: 'Billing',
        entities: [{
          id: 'entity-1',
          name: 'Invoice',
          fields: [],
          meta: {
            oasComposition: {
              mode: 'allOf', refs: [], externalRefs: [], discriminator: 'kind'
            }
          }
        }]
      }],
      relationships: []
    }));
    const schema = document.components.schemas.Billing_Invoice;
    expect(schema.allOf).toBeUndefined();
    expect(schema.discriminator).toStrictEqual({ propertyName: 'kind', mapping: {} });
  });

  it('renders markdown for sparse entities: no context, partial meta, fallbacks', () => {
    const markdown = buildMarkdownExport({
      domains: [{
        id: 'domain-1',
        name: 'Sparse',
        context: null,
        entities: [{
          id: 'entity-1',
          name: 'Shell',
          fields: [{ name: 'email', type: 'string', format: 'email' }],
          meta: {
            rbac: { list: { roles: ['admin'], tenantScoped: false } },
            contracts: [{
              type: 'event', name: 'ping', channel: '', version: '1.0.0', payloadSchema: null
            }]
          }
        }]
      }],
      relationships: [{
        id: 'rel-7', fromEntityId: 'entity-1', toEntityId: 'entity-1', fromCardinality: '1', toCardinality: 'N'
      }]
    });
    // No context block between the domain header and the entity.
    expect(markdown).toContain('## Domain: Sparse\n\n### Entity: Shell');
    expect(markdown).toContain('| email | string(email) | false | false | false | false | false |');
    expect(markdown).toContain('- Aggregate Root: false');
    expect(markdown).toContain('- Invariants: -');
    expect(markdown).toContain('- list: [admin], tenantScoped=false');
    expect(markdown).toContain('- getById: [], tenantScoped=true');
    expect(markdown).toContain('- event:ping | channel=- | version=1.0.0');
    expect(markdown).toContain('- rel-7: Sparse/Shell (1) -> (N) Sparse/Shell');
  });

  it('ignores unknown composition modes and parses string refs in OAS export', () => {
    const document = buildOasDocument({
      domains: [{
        id: 'domain-1',
        name: 'Billing',
        entities: [
          {
            id: 'entity-1',
            name: 'Invoice',
            fields: [],
            meta: {
              oasComposition: {
                mode: 'bogus', refs: 'A, B', externalRefs: 'x.yaml#T', discriminator: ''
              }
            }
          },
          {
            id: 'entity-2',
            name: 'Receipt',
            fields: [],
            meta: { oasComposition: {} }
          }
        ]
      }],
      relationships: []
    });
    const invoice = document.components.schemas.Billing_Invoice;
    expect(invoice.oneOf).toBeUndefined();
    expect(invoice.allOf).toBeUndefined();
    expect(invoice.anyOf).toBeUndefined();
    expect(invoice['x-external-refs']).toStrictEqual(['x.yaml#T']);
    expect(invoice.discriminator).toBeUndefined();
    const receipt = document.components.schemas.Billing_Receipt;
    expect(receipt['x-external-refs']).toBeUndefined();
    expect(receipt.discriminator).toBeUndefined();
  });

  it('tolerates entities without meta in the jsonschema and OAS builders', () => {
    const state = {
      domains: [{
        id: 'domain-1',
        name: 'Sparse',
        entities: [{ id: 'entity-1', name: 'Bare', fields: [] }]
      }],
      relationships: []
    };
    expect(buildJsonSchemaDocument(state).definitions.Sparse_Bare.properties).toStrictEqual({});
    const oas = buildOasDocument(state);
    expect(oas.components.schemas.Sparse_Bare['x-message-contracts']).toStrictEqual([]);
    expect(oas.components.schemas.Sparse_Bare.discriminator).toBeUndefined();
  });

  it('renders markdown context lines and partial RBAC rules verbatim', () => {
    const markdown = buildMarkdownExport({
      domains: [{
        id: 'domain-1',
        name: 'Sparse',
        context: {
          ubiquitousLanguage: 'en',
          ownerTeam: 'payments',
          upstreamDependencies: [],
          downstreamDependencies: ['crm'],
          integrationChannel: 'events',
          packageDependencies: [],
          sharedValueObjects: ['money']
        },
        entities: [{
          id: 'entity-1',
          name: 'RbacOnly',
          fields: [],
          meta: { rbac: { list: { tenantScoped: false } } }
        }]
      }],
      relationships: []
    });
    expect(markdown).toContain('- Owner Team: payments');
    expect(markdown).toContain('- Upstream: -');
    expect(markdown).toContain('- Downstream: crm');
    expect(markdown).toContain('- Integration Channel: events');
    expect(markdown).toContain('- Package Dependencies: -');
    expect(markdown).toContain('- Shared Value Objects: money');
    expect(markdown).toContain('- list: [], tenantScoped=false');
  });
});
