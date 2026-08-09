/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */

/**
 * Unit suite for the Service Configuration validation (JUM-544):
 *
 * - `packages/designer-core/src/validation/serviceConfigurationValidation.js`
 *   (`collectServiceConfigurationIssues` — port range/uniqueness on the active
 *   port set, vocabulary rules, run-mode × provider consistency), and
 * - `packages/designer-core/src/model/deployCapabilityMatrix.js` (the shared
 *   machine-readable reader of the Requirement 059 deploy matrix that both
 *   this validation and JUM-481's deploy targets consume).
 *
 * Both are exercised as pure functions — no DOM, no store.
 */

const { collectServiceConfigurationIssues } = require(
  '@jumentix/designer-core/validation/serviceConfigurationValidation.js'
);
const {
  CLOUD_PROVIDERS,
  RUN_MODES,
  SERVICE_KINDS,
  SERVICE_KIND_ACTIVE_PORTS,
  RUN_MODE_PROVIDER_SUPPORT,
  getActivePortNames,
  getSupportedProviders,
  isRunModeSupportedByProvider
} = require(
  '@jumentix/designer-core/model/deployCapabilityMatrix.js'
);

function createConfig(overrides: Record<string, unknown> = {}): any {
  return {
    serviceKind: 'rest-api',
    runMode: 'dedicated-server',
    cloudProvider: 'self-hosted',
    staticAssetsPath: '',
    ports: { rest: 3000, websocket: 3001, grpc: 3002 },
    ...overrides
  };
}

function messages(issues: Array<{ message: string }>) {
  return issues.map((issue) => issue.message);
}

describe('deploy capability matrix reader (JUM-544, shared with JUM-481)', () => {
  it('pins the Requirement 126 vocabularies', () => {
    expect(SERVICE_KINDS).toStrictEqual(['rest-api', 'websocket-rest-api', 'grpc-rest-api']);
    expect(RUN_MODES).toStrictEqual(['dedicated-server', 'virtual-machine', 'container', 'functions']);
    expect(CLOUD_PROVIDERS).toStrictEqual([
      'aws', 'google', 'azure', 'vercel', 'cloudflare', 'docker', 'self-hosted'
    ]);
  });

  it('maps each service kind to the ports it actually binds', () => {
    expect(SERVICE_KIND_ACTIVE_PORTS).toStrictEqual({
      'rest-api': ['rest'],
      'websocket-rest-api': ['rest', 'websocket'],
      'grpc-rest-api': ['rest', 'grpc']
    });
    expect(getActivePortNames('grpc-rest-api')).toStrictEqual(['rest', 'grpc']);
    expect(getActivePortNames('unknown-kind')).toStrictEqual(['rest']);
  });

  it('transcribes the Requirement 059 deploy target matrix exactly once', () => {
    expect(RUN_MODE_PROVIDER_SUPPORT).toStrictEqual({
      'dedicated-server': ['self-hosted'],
      'virtual-machine': ['aws', 'google', 'azure'],
      container: ['docker', 'self-hosted'],
      functions: ['aws', 'vercel', 'cloudflare']
    });
    expect(isRunModeSupportedByProvider('functions', 'aws')).toBe(true);
    expect(isRunModeSupportedByProvider('functions', 'self-hosted')).toBe(false);
    expect(isRunModeSupportedByProvider('dedicated-server', 'vercel')).toBe(false);
    expect(getSupportedProviders('unknown-mode')).toStrictEqual([]);
  });
});

describe('service configuration validation (JUM-544)', () => {
  it('accepts the default profile unchanged', () => {
    expect(collectServiceConfigurationIssues(createConfig())).toStrictEqual([]);
  });

  it('accepts every valid run-mode × provider combination in the matrix', () => {
    Object.entries(RUN_MODE_PROVIDER_SUPPORT).forEach(([runMode, providers]) => {
      (providers as string[]).forEach((cloudProvider) => {
        const issues = collectServiceConfigurationIssues(createConfig({ runMode, cloudProvider }));
        expect(issues).toStrictEqual([]);
      });
    });
  });

  it('rejects ports outside 1-65535', () => {
    expect(messages(collectServiceConfigurationIssues(createConfig({
      ports: { rest: 0, websocket: 3001, grpc: 3002 }
    })))).toStrictEqual([
      'REST port must be an integer between 1 and 65535 (got "0").'
    ]);
    expect(messages(collectServiceConfigurationIssues(createConfig({
      ports: { rest: 70000, websocket: 3001, grpc: 3002 }
    })))).toStrictEqual([
      'REST port must be an integer between 1 and 65535 (got "70000").'
    ]);
  });

  it('rejects non-integer and missing ports', () => {
    expect(messages(collectServiceConfigurationIssues(createConfig({
      serviceKind: 'websocket-rest-api',
      ports: { rest: 3000.5, websocket: null, grpc: 3002 }
    })))).toStrictEqual([
      'REST port must be an integer between 1 and 65535 (got "3000.5").',
      'WebSocket port must be an integer between 1 and 65535 (got "").'
    ]);
  });

  it('rejects colliding ports on the protocols the service kind binds', () => {
    expect(messages(collectServiceConfigurationIssues(createConfig({
      serviceKind: 'websocket-rest-api',
      ports: { rest: 3001, websocket: 3001, grpc: 3002 }
    })))).toStrictEqual([
      'REST and WebSocket ports both use 3001 — each protocol needs a distinct port.'
    ]);
    expect(messages(collectServiceConfigurationIssues(createConfig({
      serviceKind: 'grpc-rest-api',
      ports: { rest: 3000, websocket: 3001, grpc: 3000 }
    })))).toStrictEqual([
      'REST and gRPC ports both use 3000 — each protocol needs a distinct port.'
    ]);
  });

  it('ignores collisions on ports the selected service kind does not use', () => {
    const config = createConfig({
      serviceKind: 'rest-api',
      ports: { rest: 3000, websocket: 4000, grpc: 4000 }
    });
    expect(collectServiceConfigurationIssues(config)).toStrictEqual([]);
  });

  it('rejects run-mode × provider combinations the Requirement 059 matrix has no target for', () => {
    expect(messages(collectServiceConfigurationIssues(createConfig({
      runMode: 'functions',
      cloudProvider: 'self-hosted'
    })))).toStrictEqual([
      'Run mode "functions" cannot run on provider "self-hosted" — '
      + 'the Requirement 059 deploy matrix supports it on: aws, vercel, cloudflare.'
    ]);
    expect(messages(collectServiceConfigurationIssues(createConfig({
      runMode: 'dedicated-server',
      cloudProvider: 'vercel'
    })))).toStrictEqual([
      'Run mode "dedicated-server" cannot run on provider "vercel" — '
      + 'the Requirement 059 deploy matrix supports it on: self-hosted.'
    ]);
  });

  it('rejects values outside the Requirement 126 vocabularies', () => {
    expect(messages(collectServiceConfigurationIssues(createConfig({
      serviceKind: 'soap-api',
      runMode: 'cluster',
      cloudProvider: 'oracle'
    })))).toStrictEqual([
      'Service kind "soap-api" is not supported — choose one of: rest-api, websocket-rest-api, grpc-rest-api.',
      'Run mode "cluster" is not supported — choose one of: dedicated-server, virtual-machine, container, functions.',
      'Cloud provider "oracle" is not supported — choose one of: aws, google, azure, vercel, cloudflare, docker, self-hosted.'
    ]);
  });

  it('reports issues in the export-gate severity shape (error, no entity)', () => {
    const issues = collectServiceConfigurationIssues(createConfig({
      runMode: 'functions',
      cloudProvider: 'self-hosted'
    }));
    expect(issues.map((issue: { severity: string; entityId: string | null }) => [
      issue.severity,
      issue.entityId
    ])).toStrictEqual([['error', null]]);
  });

  it('does not cross-validate an unknown run mode or provider against the matrix', () => {
    const issues = collectServiceConfigurationIssues(createConfig({
      runMode: 'cluster',
      cloudProvider: 'oracle'
    }));
    expect(messages(issues)).toStrictEqual([
      'Run mode "cluster" is not supported — choose one of: dedicated-server, virtual-machine, container, functions.',
      'Cloud provider "oracle" is not supported — choose one of: aws, google, azure, vercel, cloudflare, docker, self-hosted.'
    ]);
  });
});

describe('nullish config fallbacks (JUM-493)', () => {
  it('reports every selector as unsupported when the config is null', () => {
    const issues = collectServiceConfigurationIssues(null);
    const nullMessages = issues.map((issue: { message: string }) => issue.message);
    expect(nullMessages.some((message: string) => message.includes('Service kind "" is not supported'))).toBe(true);
    expect(nullMessages.some((message: string) => message.includes('Run mode "" is not supported'))).toBe(true);
    expect(nullMessages.some((message: string) => message.includes('Cloud provider "" is not supported'))).toBe(true);
  });
});

// Keeps this file a module: with no import/export left, TypeScript would
// treat it as a script and its top-level requires would share one global
// scope with every other script-mode suite in ts-jest's program (TS2451).
// eslint-disable-next-line jest/no-export
export {};
