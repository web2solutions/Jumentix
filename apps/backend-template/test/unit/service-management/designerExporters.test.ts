/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */

/**
 * Unit suite for the export builders extracted from
 * `apps/service-management/script.js` by JUM-469
 * (`packages/designer-core/src/exporters/designerExporters.js`).
 *
 * These tests pin the export artifact shapes: for the same input the
 * builders must produce output byte-identical to the pre-refactor
 * exporters — the strongest guarantee that the split changed nothing, and
 * the baseline the contract-parity lane (JUM-474/475/476/478) rewrites from.
 * The AsyncAPI builder moved to `asyncApiExporters.js` under JUM-475
 * (canonical `spec/asyncapi/` targeting) and is pinned by
 * `designerAsyncApiExport.test.ts`. The one deliberate shape change since the
 * extraction is the JSON export: JUM-547 turned it into the versioned
 * full-suite document (`kind`/`version`, all four tabs), pinned here. The
 * domain package followed under JUM-492: the v2 document adds the `package`
 * identity block (name, semantic version, dependency ranges), pinned here.
 */

const {
  buildBoilerplateBundleDocument,
  buildDomainPackageDocument,
  buildJsonExportDocument,
  buildJsonSchemaDocument,
  buildMarkdownExport,
  buildOasDocument
} = require('@jumentix/designer-core/exporters/designerExporters.js');
const { normalizeStatePayload } = require(
  '@jumentix/designer-core/state/designerState.js'
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
  it('builds the JSON export as the versioned full-suite document carrying all four tabs (JUM-547)', () => {
    expect.hasAssertions();
    const state = createState();
    state.interfaces = [
      {
        type: 'grpc', framework: 'bun', entrypoint: 'src/grpc.ts', controller: 'BillingGrpc'
      }
    ];
    state.serviceConfiguration = {
      serviceKind: 'grpc-rest-api',
      runMode: 'container',
      cloudProvider: 'google',
      staticAssetsPath: 'public',
      ports: { rest: 8080, websocket: 8081, grpc: 8082 }
    };
    state.runtimeEnvironment = {
      environment: 'staging',
      fileName: '.env.staging',
      values: { JUMENTIX_HTTP_FRAMEWORK: 'fastify' }
    };
    state.deployments = [{
      name: 'prod-eu',
      region: 'eu-west-1',
      runtime: 'node22',
      serviceType: 'restapi',
      deployTarget: 'ec2',
      runtimeProtocol: 'http',
      databaseDriver: 'Mongo',
      keyValueDriver: 'redis',
      pm2Profile: 'production'
    }];
    const document = buildJsonExportDocument(state);
    expect(document).toStrictEqual({
      kind: 'service-management-suite',
      version: '2.0.0',
      domains: state.domains,
      relationships: state.relationships,
      interfaces: state.interfaces,
      serviceConfiguration: state.serviceConfiguration,
      // JUM-547 decision: the environment selection crosses, values never do.
      runtimeEnvironment: { environment: 'staging', fileName: '.env.staging' },
      deployments: state.deployments,
      view: state.view
    });
    expect(Object.keys(document)).toStrictEqual([
      'kind',
      'version',
      'domains',
      'relationships',
      'interfaces',
      'serviceConfiguration',
      'runtimeEnvironment',
      'deployments',
      'view'
    ]);
    // No runtime environment value — and therefore no secret — leaves in the
    // bundle, even when state carries them.
    const wireText = JSON.stringify(document);
    expect(wireText).not.toContain('JUMENTIX_HTTP_FRAMEWORK');
    expect(wireText).not.toContain('fastify');
  });

  it('defaults the suite sections when the state predates the four-tab shape', () => {
    expect.hasAssertions();
    const document = buildJsonExportDocument({
      domains: [], relationships: [], view: { zoom: 1 }
    });
    expect(document.kind).toBe('service-management-suite');
    expect(document.version).toBe('2.0.0');
    expect(document.interfaces).toStrictEqual([]);
    expect(document.serviceConfiguration).toBeUndefined();
    expect(document.runtimeEnvironment).toStrictEqual({ environment: 'dev', fileName: '.env.dev' });
    expect(document.deployments).toStrictEqual([]);
  });

  it('builds the markdown export verbatim', () => {
    expect.hasAssertions();
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
    expect.hasAssertions();
    expect(buildMarkdownExport({ domains: [], relationships: [] })).toBe('# Domain Designer Model\n');
  });

  it('builds the markdown export for entities without contracts', () => {
    expect.hasAssertions();
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
    expect.hasAssertions();
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
    expect.hasAssertions();
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
    expect.hasAssertions();
    const document = buildBoilerplateBundleDocument(createState());
    expect(document.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('builds the domain package around the selected domain', () => {
    expect.hasAssertions();
    const state = createState();
    const document = buildDomainPackageDocument(state.domains[0], '2026-08-05T00:00:00.000Z');
    expect(document.kind).toBe('domain-package');
    expect(document.version).toBe('2.0.0');
    expect(document.exportedAt).toBe('2026-08-05T00:00:00.000Z');
    expect(document.domain).toBe(state.domains[0]);
    // JUM-492: the v2 document declares the package identity — name and
    // version fall back to the domain name and 1.0.0 for a domain that was
    // never stamped, dependencies parse from context.packageDependencies.
    expect(document.package).toStrictEqual({
      name: 'Billing',
      version: '1.0.0',
      dependencies: [{ name: 'shared-kernel', range: '*' }]
    });
    expect(Object.keys(document)).toStrictEqual(['kind', 'version', 'exportedAt', 'package', 'domain']);
    expect(buildDomainPackageDocument(state.domains[0]).exportedAt)
      .toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('builds the OAS 3.1 document with schemas, paths and x- extensions', () => {
    expect.hasAssertions();
    const document = buildOasDocument(createState());
    expect(document.openapi).toBe('3.1.0');
    expect(document.info).toStrictEqual({
      title: 'Domain Designer Export',
      description: 'REST API designed with the Jumentix Domain Designer',
      version: '1.0.0'
    });
    expect(document.servers).toStrictEqual([{ url: 'http://localhost:3000/api/1.0.0' }]);

    expect(document.components.schemas.Billing_Invoice).toStrictEqual({
      type: 'object',
      description: 'Port output object for Invoice resource.',
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
      // JUM-478 meta carriage: the default RBAC policy is not emitted (an
      // absent x-rbac normalizes back to it), and no field diverges from the
      // importer's name heuristic, so no x-field-flags either.
      'x-aggregate-root': true,
      'x-invariants': ['total must be positive'],
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

    // Port input/output wrappers (Req 036): request bodies and 2xx responses
    // reference described component schemas, never inline schemas.
    expect(document.components.schemas.RequestCreateBilling_Invoice).toStrictEqual({
      type: 'object',
      description: 'Port input object for Invoice creation endpoint.',
      properties: EXPECTED_INVOICE_PROPERTIES,
      required: ['total'],
      'x-port-object': true
    });
    expect(document.components.schemas.RequestUpdateBilling_Invoice).toStrictEqual({
      type: 'object',
      description: 'Port input object for Invoice update endpoint.',
      properties: EXPECTED_INVOICE_PROPERTIES,
      required: ['id'],
      'x-port-object': true
    });
    expect(document.components.schemas.Billing_InvoiceArrayOf).toStrictEqual({
      type: 'array',
      description: 'Port output array of Invoice records.',
      items: { $ref: '#/components/schemas/Billing_Invoice' },
      'x-port-object': true
    });
    expect(document.components.schemas.ResourceDeleteResponse).toStrictEqual({
      description: 'Port output object for delete operations.',
      required: ['data'],
      type: 'object',
      properties: {
        data: {
          type: 'boolean',
          default: false,
          description: 'Result of request to delete resource'
        }
      },
      'x-port-object': true
    });
    expect(document.components.securitySchemes).toStrictEqual({
      bearerAuth: { type: 'http', scheme: 'bearer' }
    });

    const entityRef = { $ref: '#/components/schemas/Billing_Invoice' };
    const idParam = [{
      name: 'id', in: 'path', description: 'ID of Invoice', required: true, schema: { type: 'string' }
    }];
    expect(document.paths['/billing/invoice']).toStrictEqual({
      get: {
        operationId: 'getAllBilling_Invoice',
        responses: {
          200: {
            description: 'successful operation',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Billing_InvoiceArrayOf' } } }
          },
          400: { description: 'Invalid request' },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' }
        }
      },
      post: {
        operationId: 'createBilling_Invoice',
        requestBody: {
          description: 'Create a new Invoice',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RequestCreateBilling_Invoice' } } },
          required: true
        },
        responses: {
          201: { description: 'Invoice created successfully', content: { 'application/json': { schema: entityRef } } },
          400: { description: 'Invalid request' },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' },
          409: { description: 'Conflict' }
        }
      }
    });
    expect(document.paths['/billing/invoice/{id}']).toStrictEqual({
      get: {
        operationId: 'getBilling_InvoiceById',
        parameters: idParam,
        responses: {
          200: { description: 'successful operation', content: { 'application/json': { schema: entityRef } } },
          400: { description: 'Invalid ID supplied' },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' },
          404: { description: 'Invoice not found' }
        }
      },
      put: {
        operationId: 'updateBilling_Invoice',
        parameters: idParam,
        requestBody: {
          description: 'Update an existing Invoice',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RequestUpdateBilling_Invoice' } } },
          required: true
        },
        responses: {
          200: { description: 'successful operation', content: { 'application/json': { schema: entityRef } } },
          400: { description: 'Invalid ID supplied' },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' },
          404: { description: 'Invoice not found' },
          409: { description: 'Conflict' }
        }
      },
      delete: {
        operationId: 'deleteBilling_Invoice',
        parameters: idParam,
        responses: {
          200: {
            description: 'successful operation',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ResourceDeleteResponse' } } }
          },
          400: { description: 'Invalid ID supplied' },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' },
          404: { description: 'Invoice not found' }
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
      // JUM-478: schema names, not model ids — ids are recomputed on import
      // and would break the export → import → export fixed point.
      name: 'self link',
      fromSchema: 'Billing_Invoice',
      toSchema: 'Billing_Invoice',
      fromCardinality: 'N',
      toCardinality: '1'
    }]);
  });

  it('omits composition extensions for entities without OAS composition', () => {
    expect.hasAssertions();
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

  it('carries the JUM-478 meta extensions: x-rbac only when non-default, x-fieldless, x-field-flags', () => {
    expect.hasAssertions();
    const document = buildOasDocument(normalizeStatePayload({
      domains: [{
        id: 'domain-1',
        name: 'Billing',
        entities: [
          {
            id: 'entity-1',
            name: 'Invoice',
            fields: [
              {
                name: 'id', type: 'uuid', required: true, pk: true, unique: true
              },
              { name: 'code', type: 'string', unique: true }
            ],
            meta: {
              rbac: {
                list: { roles: ['superadmin'] }
              }
            }
          },
          {
            id: 'entity-2',
            name: 'Receipt',
            fields: []
          }
        ]
      }],
      relationships: []
    }));
    const invoice = document.components.schemas.Billing_Invoice;
    // A divergent policy crosses verbatim (normalized), with tenantScoped
    // derived from the roles exactly as the runtime derives it.
    expect(invoice['x-rbac']).toStrictEqual({
      list: { roles: ['superadmin'], tenantScoped: false },
      getById: { roles: ['superadmin', 'admin', 'user'], tenantScoped: true },
      create: { roles: ['superadmin', 'admin'], tenantScoped: true },
      update: { roles: ['superadmin', 'admin'], tenantScoped: true },
      delete: { roles: ['superadmin', 'admin'], tenantScoped: true }
    });
    // `code` diverges from the name heuristic; `id` matches it and stays bare.
    expect(invoice.properties.code['x-field-flags']).toStrictEqual({ pk: false, fk: false, unique: true });
    expect(invoice.properties.id['x-field-flags']).toBeUndefined();
    expect(invoice['x-fieldless']).toBeUndefined();
    const receipt = document.components.schemas.Billing_Receipt;
    expect(receipt['x-fieldless']).toBe(true);
    // The default policy is what an absent x-rbac normalizes back to.
    expect(receipt['x-rbac']).toBeUndefined();
    expect(receipt['x-aggregate-root']).toBeUndefined();
    expect(receipt['x-invariants']).toBeUndefined();
  });

  it('emits discriminator mapping only for declared refs', () => {
    expect.hasAssertions();
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
    expect.hasAssertions();
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
    expect.hasAssertions();
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
    expect.hasAssertions();
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
    expect.hasAssertions();
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

describe('sparse-input exporter fallbacks (JUM-493)', () => {
  it('renders dashes for absent domain context fields in markdown', () => {
    expect.hasAssertions();
    const markdown = buildMarkdownExport({
      domains: [{
        name: 'D', color: '#60a5fa', x: 0, y: 0, entities: [], context: {}
      }],
      relationships: []
    });
    expect(markdown).toContain('Ubiquitous Language: -');
    expect(markdown).toContain('Owner Team: -');
    expect(markdown).toContain('Upstream: -');
    expect(markdown).toContain('Integration Channel: -');
  });

  it('derives the package identity from the domain name, then from the default', () => {
    expect.hasAssertions();
    const named = buildDomainPackageDocument({ name: 'Billing', entities: [] });
    expect(named.package.name).toBe('Billing');
    expect(named.package.version).toBe('1.0.0');

    const anonymous = buildDomainPackageDocument({ entities: [] });
    expect(anonymous.package.name).toBe('package');
  });

  it('exports a JSON Schema document for an entity without fields', () => {
    expect.hasAssertions();
    const document = buildJsonSchemaDocument({
      domains: [{ name: 'D', entities: [{ name: 'Empty' }] }],
      relationships: []
    });
    expect(JSON.stringify(document)).toContain('Empty');
  });
});

// Keeps this file a module: with no import/export left, TypeScript would
// treat it as a script and its top-level requires would share one global
// scope with every other script-mode suite in ts-jest's program (TS2451).
// eslint-disable-next-line jest/no-export
export {};
