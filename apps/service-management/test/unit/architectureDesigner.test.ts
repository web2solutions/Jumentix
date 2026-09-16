/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */

const {
  addArchitectureLink,
  addArchitectureService,
  assignDomainToService,
  buildArchitectureFromOas,
  findUsersDomain,
  buildMonolithArchitecture,
  normalizeArchitectureInput,
  normalizeArchitectureLink,
  normalizeArchitectureService,
  protocolInterfaceType,
  removeArchitectureService,
  serviceForDomain
} = require('@jumentix/designer-core/model/architecture.js');
const { collectArchitectureIssues } = require(
  '@jumentix/designer-core/validation/architectureValidation.js'
);
const {
  buildBoilerplateBundleDocument,
  buildOasDocument,
  buildOasDocumentSet,
  filterOasDocumentForService
} = require('@jumentix/designer-core/exporters/designerExporters.js');
const { normalizeStatePayload } = require('@jumentix/designer-core/state/designerState.js');
const { buildDomainsFromOas } = require('@jumentix/designer-core/importers/designerImporters.js');

function usersAndBilling() {
  return [
    { id: 'domain-users', name: 'Users', entities: [] },
    { id: 'domain-billing', name: 'Billing', entities: [] }
  ];
}

describe('architecture model (JUM-815)', () => {
  it('defaults a payload without architecture to the monolith Core preset', () => {
    expect.hasAssertions();
    const parsed = normalizeStatePayload({ domains: usersAndBilling(), relationships: [] });
    expect(parsed.architecture.services).toHaveLength(1);
    expect(parsed.architecture.services[0]).toMatchObject({
      id: 'core',
      kind: 'core'
    });
    expect(parsed.architecture.services[0].domains).toStrictEqual(['domain-users', 'domain-billing']);
  });

  it('rejects missing Core and a Core without Users', () => {
    expect.hasAssertions();
    const domains = usersAndBilling();
    const noCore = {
      domains,
      architecture: {
        services: [{
          id: 'billing-svc', name: 'Billing', kind: 'domain', url: 'http://b', domains: ['domain-users', 'domain-billing']
        }],
        links: []
      }
    };
    const missingUsers = {
      domains,
      architecture: {
        services: [
          {
            id: 'core',
            name: 'Core',
            kind: 'core',
            url: 'http://c',
            domains: []
          },
          {
            id: 'billing-svc',
            name: 'Billing',
            kind: 'domain',
            url: 'http://b',
            domains: ['domain-users', 'domain-billing']
          }
        ],
        links: []
      }
    };
    expect(collectArchitectureIssues(noCore).some((issue: { message: string }) => issue.message.includes('exactly one Core'))).toBe(true);
    expect(collectArchitectureIssues(missingUsers).some((issue: { message: string }) => issue.message.includes('Users domain'))).toBe(true);
  });

  it('warns when an x-relation crosses a service boundary', () => {
    expect.hasAssertions();
    const domains = [
      {
        id: 'domain-users',
        name: 'Users',
        entities: [{ id: 'entity-user', name: 'User', fields: [] }]
      },
      {
        id: 'domain-billing',
        name: 'Billing',
        entities: [{ id: 'entity-invoice', name: 'Invoice', fields: [] }]
      }
    ];
    const state = {
      domains,
      relationships: [{
        id: 'rel-1',
        name: 'Invoice belongs to User',
        fromEntityId: 'entity-invoice',
        toEntityId: 'entity-user',
        fromCardinality: 'N',
        toCardinality: '1'
      }],
      architecture: {
        services: [
          {
            id: 'core', name: 'Core', kind: 'core', url: 'http://localhost:3000/api/1.0.0', domains: ['domain-users']
          },
          {
            id: 'billing-svc', name: 'Billing', kind: 'domain', url: 'http://localhost:3001/api/1.0.0', domains: ['domain-billing']
          }
        ],
        links: []
      }
    };
    const warnings = collectArchitectureIssues(state).filter((issue: { severity: string }) => issue.severity === 'warn');
    expect(warnings.some((issue: { message: string }) => issue.message.includes('crosses'))).toBe(true);
  });

  it('assigns a domain to exactly one service when moved', () => {
    expect.hasAssertions();
    const domains = usersAndBilling();
    let architecture = buildMonolithArchitecture(domains);
    architecture = addArchitectureService(architecture, {
      id: 'billing-svc', name: 'Billing', kind: 'domain', url: 'http://localhost:3001/api/1.0.0'
    }, domains);
    architecture = assignDomainToService(architecture, 'domain-billing', 'billing-svc');
    const billing = architecture.services.find((service: { id: string }) => service.id === 'billing-svc');
    const core = architecture.services.find((service: { kind: string }) => service.kind === 'core');
    expect(billing.domains).toStrictEqual(['domain-billing']);
    expect(core.domains).toStrictEqual(['domain-users']);
  });

  it('normalizes services, links and fallbacks from partial imported payloads', () => {
    expect.hasAssertions();
    const domains = usersAndBilling();
    const knownDomainIds = new Set(domains.map((domain) => domain.id));
    const normalizedService = normalizeArchitectureService({
      kind: 'worker',
      domains: 'domain-users, missing-domain',
      width: 20,
      height: 40,
      x: Number.NaN,
      y: 24,
      deployTargetId: ' pm2-dev '
    }, 1, knownDomainIds);
    expect(normalizedService).toMatchObject({
      id: 'service-import-2',
      name: 'Service_2',
      kind: 'domain',
      url: 'http://localhost:3000/api/1.0.0',
      domains: ['domain-users'],
      deployTargetId: 'pm2-dev',
      x: 400,
      y: 24,
      width: 220,
      height: 140
    });

    const normalizedCore = normalizeArchitectureService({ kind: 'core', domains: ['domain-billing'] }, 0, knownDomainIds);
    expect(normalizedCore).toMatchObject({
      id: 'core',
      name: 'Core',
      domains: ['domain-billing']
    });

    const knownServiceIds = new Set(['core', 'billing-svc']);
    expect(normalizeArchitectureLink({ from: 'core', to: 'missing' }, 0, knownServiceIds)).toBeNull();
    expect(normalizeArchitectureLink({
      from: 'core',
      to: 'billing-svc',
      protocol: 'soap',
      contractRef: '  openapi.yaml#/paths/~1billing  '
    }, 2, knownServiceIds)).toStrictEqual({
      id: 'arch-link-import-3',
      from: 'core',
      to: 'billing-svc',
      protocol: 'rest',
      contractRef: 'openapi.yaml#/paths/~1billing'
    });

    expect(normalizeArchitectureService(null, 0, knownDomainIds)).toMatchObject({
      id: 'service-import-1',
      name: 'Service_1',
      domains: []
    });
    expect(normalizeArchitectureLink(null, 0)).toStrictEqual({
      id: 'arch-link-import-1',
      from: '',
      to: '',
      protocol: 'rest',
      contractRef: ''
    });
    expect(buildMonolithArchitecture(null, { url: '   ', deployTargetId: '   ' }).services[0]).toMatchObject({
      domains: [],
      url: 'http://localhost:3000/api/1.0.0',
      deployTargetId: ''
    });
  });

  it('keeps every domain assigned and reconnects domains when services are removed', () => {
    expect.hasAssertions();
    const domains = [
      ...usersAndBilling(),
      { id: 'domain-catalog', name: 'Catalog', entities: [] }
    ];
    const normalized = normalizeArchitectureInput({
      services: [{
        id: 'billing-svc',
        name: 'Billing',
        kind: 'domain',
        domains: ['domain-billing']
      }],
      links: []
    }, domains);
    expect(normalized.services[0].domains).toStrictEqual(['domain-billing', 'domain-users', 'domain-catalog']);
    expect(findUsersDomain('not-an-array')).toBeNull();
    expect(findUsersDomain(domains)?.id).toBe('domain-users');
    expect(serviceForDomain(normalized, 'domain-catalog')?.id).toBe('billing-svc');
    expect(protocolInterfaceType('message')).toBe('sse');
    expect(protocolInterfaceType('mqtt')).toBe('mqtt');

    const expanded = {
      services: [
        {
          id: 'core',
          name: 'Core',
          kind: 'core',
          domains: ['domain-users']
        },
        {
          id: 'billing-svc',
          name: 'Billing',
          kind: 'domain',
          domains: ['domain-billing']
        }
      ],
      links: [{
        id: 'link-1', from: 'core', to: 'billing-svc', protocol: 'grpc'
      }]
    };
    const removed = removeArchitectureService(expanded, 'billing-svc', domains);
    expect(removed.services).toHaveLength(1);
    expect(removed.services[0].domains.sort()).toStrictEqual(['domain-billing', 'domain-catalog', 'domain-users']);
    expect(removed.links).toStrictEqual([]);
    expect(removeArchitectureService({ services: [{ id: 'core', kind: 'core', domains: [] }], links: [] }, 'core', domains).services[0].id)
      .toBe('core');
    const removedMissing = removeArchitectureService(expanded, 'missing-svc', domains);
    expect(removedMissing.services).toHaveLength(2);
    expect(removeArchitectureService({
      services: [
        {
          id: 'a', name: 'A', kind: 'domain', domains: ['domain-users']
        },
        {
          id: 'b', name: 'B', kind: 'domain', domains: ['domain-billing']
        }
      ],
      links: []
    }, 'b', domains).services[0].domains).toContain('domain-billing');
    const unchangedLinks = addArchitectureLink(expanded, { from: 'core', to: 'missing', protocol: 'rest' }, domains);
    expect(unchangedLinks.links).toStrictEqual([{
      id: 'link-1',
      from: 'core',
      to: 'billing-svc',
      protocol: 'grpc',
      contractRef: ''
    }]);
    expect(serviceForDomain(null, 'domain-users')).toBeNull();
    expect(assignDomainToService(null, 'domain-users', 'missing')).toStrictEqual({ services: [], links: [] });
    expect(addArchitectureService(null, { domains: 'domain-users' }, domains).services).toHaveLength(2);
    expect(normalizeArchitectureInput({ services: [{ id: 'core', kind: 'core', domains: [] }], links: 'bad-links' }, null).links)
      .toStrictEqual([]);
  });

  it('imports architecture services from OAS service, server and schema metadata', () => {
    expect.hasAssertions();
    const domains = usersAndBilling();
    const fallback = buildArchitectureFromOas({ openapi: '3.1.0' }, domains);
    expect(fallback.services).toHaveLength(1);
    expect(fallback.services[0].id).toBe('core');

    const architecture = buildArchitectureFromOas({
      openapi: '3.1.0',
      servers: [
        { url: 'http://core.example/api', 'x-service-id': 'core' },
        { url: 'http://billing.example/api', 'x-service-id': 'billing-svc' },
        { 'x-service-id': 'empty-url' },
        { url: 'http://missing-id.example/api' }
      ],
      'x-services': [
        { id: 'core', name: 'Core', kind: 'core' },
        { id: 'billing-svc', name: 'Billing', kind: 'domain' },
        { name: 'Generated', domains: 'domain-billing' }
      ],
      components: {
        schemas: {
          User: { 'x-service': 'core', 'x-domain': 'Users' },
          Invoice: { 'x-service': 'billing-svc', 'x-domain': 'Billing' },
          Ignored: { 'x-service': '', 'x-domain': 'Billing' }
        }
      },
      'x-architecture-links': [
        {
          id: 'core-to-billing', from: 'core', to: 'billing-svc', protocol: 'grpc'
        },
        {
          id: 'bad-link', from: 'core', to: 'missing-svc', protocol: 'rest'
        }
      ]
    }, domains);
    const core = architecture.services.find((service: { id: string }) => service.id === 'core');
    const billing = architecture.services.find((service: { id: string }) => service.id === 'billing-svc');
    const generated = architecture.services.find((service: { id: string }) => service.id === 'service-import-3');
    expect(core).toMatchObject({ url: 'http://core.example/api', domains: ['domain-users'] });
    expect(billing).toMatchObject({ url: 'http://billing.example/api', domains: ['domain-billing'] });
    expect(generated?.domains).toStrictEqual(['domain-billing']);
    expect(architecture.links).toStrictEqual([{
      id: 'core-to-billing',
      from: 'core',
      to: 'billing-svc',
      protocol: 'grpc',
      contractRef: ''
    }]);
    expect(buildArchitectureFromOas(null, null).services[0].domains).toStrictEqual([]);
  });

  it('reports duplicate assignment, missing Users and unsupported interface coverage gaps', () => {
    expect.hasAssertions();
    const domains = [
      { id: 'domain-billing', name: 'Billing', entities: [] },
      { id: 'domain-catalog', name: 'Catalog', entities: [] }
    ];
    const issues = collectArchitectureIssues({
      domains,
      interfaces: [{ type: 'grpc' }],
      architecture: {
        services: [
          {
            id: 'core',
            name: 'Core',
            kind: 'core',
            domains: ['domain-billing', 'domain-catalog']
          },
          {
            id: 'catalog-svc',
            name: 'Catalog',
            kind: 'domain',
            domains: ['domain-catalog']
          },
          {
            id: 'extra-core',
            name: 'Extra Core',
            kind: 'core',
            domains: []
          }
        ],
        links: [{
          id: 'link-1', from: 'core', to: 'catalog-svc', protocol: 'rest'
        }]
      }
    });
    expect(issues.some((issue: { message: string }) => issue.message.includes('extra Core services'))).toBe(true);
    expect(issues.some((issue: { message: string }) => issue.message.includes('requires a Users domain'))).toBe(true);
    expect(issues.some((issue: { message: string }) => issue.message.includes('more than one service'))).toBe(true);
    expect(issues.some((issue: { message: string }) => issue.message.includes('no declared interface adapter supports'))).toBe(true);
    expect(collectArchitectureIssues({}).some((issue: { severity: string }) => issue.severity === 'error')).toBe(false);
  });
});

describe('per-service OAS (JUM-817)', () => {
  function twoServiceState() {
    const domains = [
      {
        id: 'domain-users',
        name: 'Users',
        entities: [{
          id: 'entity-user',
          name: 'User',
          fields: [{
            name: 'id',
            type: 'uuid',
            required: true,
            pk: true
          }]
        }]
      },
      {
        id: 'domain-billing',
        name: 'Billing',
        entities: [{
          id: 'entity-invoice',
          name: 'Invoice',
          fields: [{
            name: 'id',
            type: 'uuid',
            required: true,
            pk: true
          }]
        }]
      }
    ];
    return normalizeStatePayload({
      domains,
      relationships: [],
      architecture: addArchitectureLink(
        assignDomainToService(
          addArchitectureService(buildMonolithArchitecture(domains), {
            id: 'billing-svc',
            name: 'Billing',
            kind: 'domain',
            url: 'http://localhost:3001/api/1.0.0'
          }, domains),
          'domain-billing',
          'billing-svc'
        ),
        { from: 'core', to: 'billing-svc', protocol: 'rest' },
        domains
      )
    });
  }

  it('emits x-services, servers and x-service on operations', () => {
    expect.hasAssertions();
    const document = buildOasDocument(twoServiceState());
    expect(document['x-services'].map((entry: { id: string }) => entry.id).sort()).toStrictEqual(['billing-svc', 'core']);
    expect(document.servers.map((server: { 'x-service-id': string }) => server['x-service-id']).sort()).toStrictEqual(['billing-svc', 'core']);
    const userList = document.paths['/users/user'].get;
    const invoiceList = document.paths['/billing/invoice'].get;
    expect(userList['x-service']).toBe('core');
    expect(invoiceList['x-service']).toBe('billing-svc');
  });

  it('filters a per-service document and round-trips architecture through OAS', () => {
    expect.hasAssertions();
    const state = twoServiceState();
    const set = buildOasDocumentSet(state);
    const billingOnly = filterOasDocumentForService(set.merged, 'billing-svc');
    expect(billingOnly.paths['/billing/invoice']).toBeDefined();
    expect(billingOnly.paths['/users/user']).toBeUndefined();
    expect(billingOnly.servers).toStrictEqual([{
      url: 'http://localhost:3001/api/1.0.0',
      'x-service-id': 'billing-svc'
    }]);
    const imported = buildDomainsFromOas(JSON.parse(JSON.stringify(set.merged)));
    expect(imported.ok).toBe(true);
    const second = buildOasDocument(normalizeStatePayload({
      domains: imported.domains,
      relationships: imported.relationships,
      architecture: imported.architecture
    }));
    expect(second['x-services'].map((entry: { id: string }) => entry.id).sort()).toStrictEqual(
      set.merged['x-services'].map((entry: { id: string }) => entry.id).sort()
    );
    expect(second['x-architecture-links']).toHaveLength(1);
  });

  it('filters malformed or unknown-service OAS documents without inventing metadata', () => {
    expect.hasAssertions();
    const filteredEmpty = filterOasDocumentForService({ info: { title: 'Empty' } }, '');
    expect(filteredEmpty).toMatchObject({
      info: { title: 'Empty' },
      paths: {},
      components: { schemas: {} },
      'x-services': []
    });

    const oas = {
      info: { title: 'Merged' },
      servers: [{ url: 'http://all.example/api' }],
      paths: {
        '/empty': null,
        '/users': {
          get: {
            'x-service': 'core',
            responses: {
              200: {
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/UserEnvelope' }
                  }
                }
              }
            }
          },
          post: undefined,
          patch: {
            'x-service': 'core',
            responses: {
              200: {
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/MissingRef' }
                  }
                }
              }
            }
          }
        },
        '/billing': { get: { 'x-service': 'billing-svc' } }
      },
      components: {
        schemas: {
          UserEnvelope: {
            type: 'object',
            properties: {
              data: { $ref: '#/components/schemas/User' }
            }
          },
          User: { type: 'object' },
          MissingRef: { $ref: '#/components/schemas/DoesNotExist' },
          ExternalRef: { $ref: 'external.yaml#/User' }
        }
      },
      'x-services': [{ id: 'core', name: '', kind: 'core' }]
    };
    const filteredCore = filterOasDocumentForService(oas, 'core');
    expect(filteredCore.info.title).toBe('Merged');
    expect(filteredCore.servers).toStrictEqual(oas.servers);
    expect(Object.keys(filteredCore.paths)).toStrictEqual(['/users']);
    expect(Object.keys(filteredCore.components.schemas).sort()).toStrictEqual([
      'MissingRef',
      'User',
      'UserEnvelope'
    ]);

    const filteredMissing = filterOasDocumentForService(oas, 'missing');
    expect(filteredMissing.paths).toStrictEqual({});
    expect(filteredMissing['x-services']).toStrictEqual([]);

    const noEntityDocument = buildOasDocument(normalizeStatePayload({
      domains: [{ id: 'domain-empty', name: 'Empty', entities: [] }],
      relationships: []
    }));
    expect(noEntityDocument.components.schemas.ResourceDeleteResponse).toBeUndefined();
  });

  it('applies code workspace overlays while building boilerplate bundles', () => {
    expect.hasAssertions();
    const state = twoServiceState();
    const initial = buildBoilerplateBundleDocument(state, '2026-09-16T00:00:00.000Z');
    const initialFiles = initial.modules.flatMap(
      (module: { files: Record<string, { path: string }> }) => Object.values(module.files)
    );
    const firstFile = initialFiles[0];
    const overlaid = buildBoilerplateBundleDocument({
      ...state,
      codeWorkspace: {
        files: {
          [firstFile.path]: {
            state: 'edited',
            content: '// local edit'
          },
          'ignored.ts': {
            state: 'generated',
            content: '// ignored'
          }
        }
      }
    }, '2026-09-16T00:00:00.000Z');
    const overlaidFiles = new Map(overlaid.modules.flatMap(
      (module: { files: Record<string, { path: string }> }) => Object.values(module.files)
    ).map((file: { path: string }) => [file.path, file]));
    const overlaidFile = overlaidFiles.get(firstFile.path);
    expect(overlaid.generatedAt).toBe('2026-09-16T00:00:00.000Z');
    expect(overlaidFile).toMatchObject({
      content: '// local edit',
      workspaceState: 'edited'
    });
  });
});
