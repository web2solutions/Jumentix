/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
import fs from 'node:fs';
import path from 'node:path';

/**
 * Unit suite for the Deploy Management matrix alignment (JUM-481):
 *
 * - `packages/designer-core/src/model/deployCapabilityMatrix.js` — the
 *   deploy-target half of the shared Requirement 059 reader (metadata
 *   vocabularies, service-type × deploy-target support, PM2-managed targets,
 *   per-service-type protocols), and
 * - `packages/designer-core/src/validation/deployTargetValidation.js`
 *   (`collectDeployTargetIssues` — vocabulary rules, matrix combinations,
 *   protocol exposure, PM2-profile applicability), and
 * - `normalizeDeploymentInput` in `src/state/designerState.js` — the lossless
 *   migration of legacy `{ name, type, region, runtime }` entries.
 *
 * All three are exercised as pure functions — no DOM, no store.
 */

const repoRoot = path.resolve(__dirname, '../../../..');
const { collectDeployTargetIssues } = require(
  '@jumentix/designer-core/validation/deployTargetValidation.js'
);
const {
  DATABASE_DRIVERS,
  DEPLOY_TARGET_SERVICE_TYPES,
  DEPLOY_TARGETS,
  KEY_VALUE_DRIVERS,
  PM2_MANAGED_DEPLOY_TARGETS,
  PM2_PROFILES,
  RUNTIME_PROTOCOLS,
  SERVICE_TYPES,
  SERVICE_TYPE_PROTOCOLS,
  getSupportedProtocols,
  getSupportedServiceTypes,
  isPm2ManagedDeployTarget,
  isProtocolSupportedByServiceType,
  isServiceTypeSupportedByDeployTarget
} = require(
  '@jumentix/designer-core/model/deployCapabilityMatrix.js'
);
const { normalizeDeploymentInput, normalizeStatePayload } = require(
  '@jumentix/designer-core/state/designerState.js'
);

const enumValuesFor = (scriptSource: string, key: string): string[] => {
  const match = scriptSource.match(new RegExp(`${key}: \\[([\\s\\S]*?)\\]`));
  if (!match) throw new Error(`enum for ${key} not found`);
  return Array.from(match[1].matchAll(/'([^']*)'/g), (m) => m[1]);
};

function createTarget(overrides: Record<string, unknown> = {}): any {
  return {
    name: 'prod-us-east-1',
    region: 'us-east-1',
    runtime: 'nodejs22.x',
    serviceType: 'restapi',
    deployTarget: 'dedicated-server',
    runtimeProtocol: 'http',
    databaseDriver: 'Mongo',
    keyValueDriver: 'redis',
    pm2Profile: 'dev',
    ...overrides
  };
}

function messages(issues: Array<{ message: string }>) {
  return issues.map((issue) => issue.message);
}

describe('deploy capability matrix reader — deploy-target half (JUM-481)', () => {
  it('pins the Requirement 059 metadata contract vocabularies', () => {
    expect.hasAssertions();
    expect(SERVICE_TYPES).toStrictEqual(['restapi', 'websocket+restapi', 'grpc+restapi', 'functions']);
    expect(DEPLOY_TARGETS).toStrictEqual([
      'dedicated-server', 'vm', 'ec2', 'lambda', 'vercel-functions', 'cloudflare-workers'
    ]);
    expect(RUNTIME_PROTOCOLS).toStrictEqual(['http', 'websocket', 'grpc']);
    expect(PM2_PROFILES).toStrictEqual(['dev', 'staging', 'production']);
  });

  it('keeps the driver vocabularies in parity with the runtime env contract enums', () => {
    expect.hasAssertions();
    // The matrix defines databaseDriver/keyValueDriver by reference to the
    // JUMENTIX_DATABASE_DRIVER / JUMENTIX_KEYVALUESTORAGE_DRIVER enums — this
    // is the drift guard between the reader and both declared mirrors
    // (server.js write allowlist and script.js RUNTIME_ENV_ENUM_OPTIONS).
    const script = fs.readFileSync(path.join(repoRoot, 'apps', 'service-management', 'script.js'), 'utf-8');
    const server = fs.readFileSync(path.join(repoRoot, 'apps', 'service-management', 'server.js'), 'utf-8');
    [script, server].forEach((source) => {
      expect(enumValuesFor(source, 'JUMENTIX_DATABASE_DRIVER').sort()).toStrictEqual([...DATABASE_DRIVERS].sort());
      expect(enumValuesFor(source, 'JUMENTIX_KEYVALUESTORAGE_DRIVER').sort()).toStrictEqual([...KEY_VALUE_DRIVERS].sort());
    });
  });

  it('maps every matrix row to its service types, PM2 management and protocols', () => {
    expect.hasAssertions();
    expect(DEPLOY_TARGET_SERVICE_TYPES).toStrictEqual({
      'dedicated-server': ['restapi', 'websocket+restapi', 'grpc+restapi'],
      vm: ['restapi', 'websocket+restapi', 'grpc+restapi'],
      ec2: ['restapi', 'websocket+restapi', 'grpc+restapi'],
      lambda: ['functions'],
      'vercel-functions': ['functions'],
      'cloudflare-workers': ['functions']
    });
    expect(PM2_MANAGED_DEPLOY_TARGETS).toStrictEqual(['dedicated-server', 'vm', 'ec2']);
    expect(SERVICE_TYPE_PROTOCOLS).toStrictEqual({
      restapi: ['http'],
      'websocket+restapi': ['http', 'websocket'],
      'grpc+restapi': ['http', 'grpc'],
      functions: ['http']
    });
  });

  it('lookups fall back to empty/false for unknown values', () => {
    expect.hasAssertions();
    expect(getSupportedServiceTypes('azure-functions')).toStrictEqual([]);
    expect(isServiceTypeSupportedByDeployTarget('functions', 'dedicated-server')).toBe(false);
    expect(isServiceTypeSupportedByDeployTarget('grpc+restapi', 'ec2')).toBe(true);
    expect(isPm2ManagedDeployTarget('lambda')).toBe(false);
    expect(isPm2ManagedDeployTarget('vm')).toBe(true);
    expect(getSupportedProtocols('unknown')).toStrictEqual([]);
    expect(isProtocolSupportedByServiceType('restapi', 'websocket')).toBe(false);
    expect(isProtocolSupportedByServiceType('grpc+restapi', 'grpc')).toBe(true);
  });
});

describe('collectDeployTargetIssues (JUM-481)', () => {
  it('accepts a valid PM2-managed target', () => {
    expect.hasAssertions();
    expect(collectDeployTargetIssues(createTarget())).toStrictEqual([]);
  });

  it('accepts every PM2-managed row with each non-function service type', () => {
    expect.hasAssertions();
    ['dedicated-server', 'vm', 'ec2'].forEach((deployTarget) => {
      expect(collectDeployTargetIssues(createTarget({ deployTarget }))).toStrictEqual([]);
      expect(collectDeployTargetIssues(createTarget({
        deployTarget, serviceType: 'websocket+restapi', runtimeProtocol: 'websocket'
      }))).toStrictEqual([]);
      expect(collectDeployTargetIssues(createTarget({
        deployTarget, serviceType: 'grpc+restapi', runtimeProtocol: 'grpc'
      }))).toStrictEqual([]);
    });
  });

  it('accepts every function row with an empty PM2 profile', () => {
    expect.hasAssertions();
    ['lambda', 'vercel-functions', 'cloudflare-workers'].forEach((deployTarget) => {
      expect(collectDeployTargetIssues(createTarget({
        deployTarget, serviceType: 'functions', runtimeProtocol: 'http', pm2Profile: ''
      }))).toStrictEqual([]);
    });
  });

  it('rejects a functions service on a PM2-managed target, naming the supported rows', () => {
    expect.hasAssertions();
    const issues = collectDeployTargetIssues(createTarget({ serviceType: 'functions' }));
    expect(messages(issues)).toStrictEqual([
      'Deploy target "dedicated-server" cannot run service type "functions" — the Requirement 059 deploy matrix supports it on: lambda, vercel-functions, cloudflare-workers.'
    ]);
  });

  it('rejects a REST service on a function target, naming the supported rows', () => {
    expect.hasAssertions();
    const issues = collectDeployTargetIssues(createTarget({
      deployTarget: 'lambda', serviceType: 'restapi', pm2Profile: ''
    }));
    expect(messages(issues)).toStrictEqual([
      'Deploy target "lambda" cannot run service type "restapi" — the Requirement 059 deploy matrix supports it on: dedicated-server, vm, ec2.'
    ]);
  });

  it('rejects a protocol the service type does not expose', () => {
    expect.hasAssertions();
    const issues = collectDeployTargetIssues(createTarget({ runtimeProtocol: 'websocket' }));
    expect(messages(issues)).toStrictEqual([
      'Service type "restapi" does not expose protocol "websocket" — the Requirement 059 deploy matrix gives it: http.'
    ]);
  });

  it('rejects a functions deploy target with a PM2 profile', () => {
    expect.hasAssertions();
    const issues = collectDeployTargetIssues(createTarget({
      deployTarget: 'cloudflare-workers', serviceType: 'functions', pm2Profile: 'production'
    }));
    expect(messages(issues)).toStrictEqual([
      'Deploy target "cloudflare-workers" is provider-managed (serverless), not PM2-managed — a PM2 profile does not apply; leave it empty.'
    ]);
  });

  it('rejects a PM2-managed target without a PM2 profile', () => {
    expect.hasAssertions();
    const issues = collectDeployTargetIssues(createTarget({ deployTarget: 'ec2', pm2Profile: '' }));
    expect(messages(issues)).toStrictEqual([
      'Deploy target "ec2" is PM2-managed and requires a PM2 profile — choose one of: dev, staging, production.'
    ]);
  });

  it('rejects unknown vocabulary values without running the combination rules', () => {
    expect.hasAssertions();
    const issues = collectDeployTargetIssues(createTarget({
      serviceType: 'soap',
      deployTarget: 'azure-functions',
      runtimeProtocol: 'amqp',
      databaseDriver: 'MS SQL',
      keyValueDriver: 'memcached',
      pm2Profile: ''
    }));
    const found = messages(issues);
    expect(found).toHaveLength(5);
    expect(found[0]).toContain('Service type "soap" is not supported');
    expect(found[1]).toContain('Deploy target "azure-functions" is not supported');
    expect(found[2]).toContain('Runtime protocol "amqp" is not supported');
    expect(found[3]).toContain('Database driver "MS SQL" is not a supported JUMENTIX_DATABASE_DRIVER value');
    expect(found[4]).toContain('Key-value driver "memcached" is not a supported JUMENTIX_KEYVALUESTORAGE_DRIVER value');
  });

  it('treats a missing candidate as all-vocabulary errors', () => {
    expect.hasAssertions();
    expect(collectDeployTargetIssues(null)).toHaveLength(5);
    expect(collectDeployTargetIssues({})).toHaveLength(5);
  });
});

describe('normalizeDeploymentInput (JUM-481 migration)', () => {
  it('migrates a legacy dedicated entry forward without loss', () => {
    expect.hasAssertions();
    expect(normalizeDeploymentInput({
      name: 'prod', type: 'dedicated', region: 'us-east-1', runtime: 'nodejs22.x'
    })).toStrictEqual({
      name: 'prod',
      region: 'us-east-1',
      runtime: 'nodejs22.x',
      serviceType: 'restapi',
      deployTarget: 'dedicated-server',
      runtimeProtocol: 'http',
      databaseDriver: 'InMemory',
      keyValueDriver: 'redis',
      pm2Profile: 'dev'
    });
  });

  it('migrates a legacy lambda entry to a functions target with no PM2 profile', () => {
    expect.hasAssertions();
    const migrated = normalizeDeploymentInput({
      name: 'fn', type: 'lambda', region: 'us-east-1', runtime: 'nodejs22.x'
    });
    expect(migrated.deployTarget).toBe('lambda');
    expect(migrated.serviceType).toBe('functions');
    expect(migrated.runtimeProtocol).toBe('http');
    expect(migrated.pm2Profile).toBe('');
    expect(collectDeployTargetIssues(migrated)).toStrictEqual([]);
  });

  it('keeps legacy values with no matrix counterpart verbatim (lossless)', () => {
    expect.hasAssertions();
    const migrated = normalizeDeploymentInput({
      name: 'legacy', type: 'azure-functions', region: 'eastus', runtime: 'node20'
    });
    expect(migrated.deployTarget).toBe('azure-functions');
    expect(migrated.serviceType).toBe('');
    expect(migrated.pm2Profile).toBe('');
    // ...and the validation vocabulary rule flags exactly that value.
    expect(messages(collectDeployTargetIssues(migrated)).join(' ')).toContain('"azure-functions" is not supported');
  });

  it('keeps an explicit Requirement 059 entry unchanged', () => {
    expect.hasAssertions();
    const entry = createTarget({
      deployTarget: 'vm', serviceType: 'grpc+restapi', runtimeProtocol: 'grpc', pm2Profile: 'production'
    });
    expect(normalizeDeploymentInput(entry)).toStrictEqual(entry);
  });

  it('normalizes garbage input to the default shape', () => {
    expect.hasAssertions();
    expect(normalizeDeploymentInput(null)).toStrictEqual({
      name: '',
      region: '',
      runtime: '',
      serviceType: '',
      deployTarget: '',
      runtimeProtocol: '',
      databaseDriver: 'InMemory',
      keyValueDriver: 'redis',
      pm2Profile: ''
    });
  });
});

describe('normalizeStatePayload deployments (JUM-481)', () => {
  it('returns migrated deployments from a stored payload', () => {
    expect.hasAssertions();
    const normalized = normalizeStatePayload({
      deployments: [{
        name: 'prod', type: 'dedicated', region: 'us-east-1', runtime: 'nodejs22.x'
      }]
    });
    expect(normalized.deployments).toHaveLength(1);
    expect(normalized.deployments[0].deployTarget).toBe('dedicated-server');
    expect(normalized.deployments[0].serviceType).toBe('restapi');
  });

  it('defaults a missing or non-array deployments section to empty', () => {
    expect.hasAssertions();
    expect(normalizeStatePayload({}).deployments).toStrictEqual([]);
    expect(normalizeStatePayload({ deployments: 'junk' }).deployments).toStrictEqual([]);
  });
});
