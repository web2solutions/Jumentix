/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */

const {
  addArchitectureLink,
  addArchitectureService,
  assignDomainToService,
  buildMonolithArchitecture
} = require('@jumentix/designer-core/model/architecture.js');
const { collectArchitectureIssues } = require(
  '@jumentix/designer-core/validation/architectureValidation.js'
);
const {
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
});
