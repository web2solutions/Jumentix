/* eslint-disable @typescript-eslint/no-var-requires, global-require */
import path from 'node:path';

/**
 * Branch coverage for the JUM-815 architecture model and its validation —
 * the defensive-input edges the round-trip suites never reach: interface
 * entries without a type, unnamed relationships crossing a service boundary,
 * and adding a service when the caller has no domain list at hand.
 */

const packageRoot = path.resolve(__dirname, '..');

const {
  addArchitectureService,
  buildMonolithArchitecture
} = require(path.join(packageRoot, 'src', 'model', 'architecture.js')) as {
  addArchitectureService: (
    architecture: Record<string, unknown>,
    service: Record<string, unknown>,
    domains: unknown
  ) => { services: Array<{ id: string; name: string }> };
  buildMonolithArchitecture: (domains: unknown) => Record<string, unknown>;
};

const {
  collectArchitectureIssues
} = require(path.join(packageRoot, 'src', 'validation', 'architectureValidation.js')) as {
  collectArchitectureIssues: (state: Record<string, unknown>) => Array<{
    message: string;
    entityId: string | null;
    severity: string;
  }>;
};

describe('architecture model defensive branches', () => {
  it('adds a service when the caller passes no domain list', () => {
    expect.hasAssertions();

    const monolith = buildMonolithArchitecture([]);
    const next = addArchitectureService(monolith, { name: 'Reporting' }, undefined);

    expect(next.services).toHaveLength(2);
    expect(next.services[1].name).toBe('Reporting');
    expect(next.services[1].id).toMatch(/^service-import-/);
  });
});

describe('architecture validation defensive branches', () => {
  const baseState = () => ({
    domains: [{
      id: 'domain-users',
      name: 'Users',
      entities: [{ id: 'entity-user', name: 'User', domain: { id: 'domain-users' } }]
    }, {
      id: 'domain-billing',
      name: 'Billing',
      entities: [{ id: 'entity-invoice', name: 'Invoice', domain: { id: 'domain-billing' } }]
    }],
    relationships: [],
    interfaces: [],
    architecture: {
      services: [
        {
          id: 'core', name: 'Core', kind: 'core', domains: ['domain-users'], url: ''
        },
        {
          id: 'svc-billing', name: 'Billing', kind: 'domain', domains: ['domain-billing'], url: ''
        }
      ],
      links: []
    }
  });

  it('ignores interface entries that declare no type when checking link protocols', () => {
    expect.hasAssertions();

    const state = {
      ...baseState(),
      interfaces: [{}, { type: '   ' }]
    };
    const issues = collectArchitectureIssues(state);

    // The typeless entries are filtered out, so the rest/grpc link reads as
    // unsupported only by protocol vocabulary, not as an adapter miss.
    expect(issues.filter((issue) => issue.message.includes('no declared interface adapter')))
      .toHaveLength(0);
  });

  it('flags an unnamed relationship that crosses the service boundary by id', () => {
    expect.hasAssertions();

    const state = {
      ...baseState(),
      relationships: [{
        id: 'rel-1',
        fromEntityId: 'entity-user',
        toEntityId: 'entity-invoice',
        fromCardinality: '1',
        toCardinality: '*'
      }]
    };
    const issues = collectArchitectureIssues(state);

    const crossing = issues.find((issue) => issue.message.includes('crosses the'));
    expect(crossing).toBeDefined();
    expect(crossing?.message).toContain('x-relation "rel-1" crosses the Core / Billing service boundary.');
    expect(crossing?.severity).toBe('warn');
    expect(crossing?.entityId).toBe('entity-user');
  });
});
