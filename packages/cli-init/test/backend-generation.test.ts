/* eslint-disable @typescript-eslint/no-var-requires, jest/require-hook */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

require('./ensure-built');

const {
  computeUnusedPaths,
  shouldKeepRelativePath,
  renderEnvDev,
  mapDbChoiceToDriver,
  mapRealtimeToEnv,
  buildServicePackageJson,
  generateBackend,
  domainsForService,
  renderCompositionRoot,
  HTTP_INTEGRATION_SUITES,
  resolveJumentixPin
} = require('../dist/generators');

const { resolveSources } = require('../dist/sources');
const { main } = require('../dist/cli');

const fixturesDir = path.join(__dirname, '..', 'fixtures');
const templateRoot = path.join(__dirname, '..', 'templates', 'backend');

function fixture(...parts: string[]): string {
  return path.join(fixturesDir, ...parts);
}

describe('backend generation — slicing rules (JUM-847)', () => {
  it('drops unused HTTP integration suites and keeps the chosen one', () => {
    expect.hasAssertions();
    const unused = computeUnusedPaths({
      http: 'fastify',
      realtime: 'none',
      db: 'sqlite'
    });
    expect(unused).toContain('test/integration/Express');
    expect(unused).toContain('test/integration/Restify');
    expect(unused).not.toContain('test/integration/Fastify');
    expect(unused).toContain('test/integration/realtime');
  });

  it('keeps postgres compose and drops other db compose files', () => {
    expect.hasAssertions();
    const unused = computeUnusedPaths({
      http: 'express',
      realtime: 'websocket',
      db: 'postgres'
    });
    expect(unused).toContain('docker-compose-mysql.yml');
    expect(unused).toContain('docker-compose-mongodb.yml');
    expect(unused).not.toContain('docker-compose-postgresql.yml');
    expect(unused).not.toContain('docker-compose-redis.yml');
    expect(unused).not.toContain('test/integration/realtime');
  });

  it('shouldKeepRelativePath keeps runtime adapter paths', () => {
    expect.hasAssertions();
    const slice = { http: 'express' as const, realtime: 'none' as const, db: 'inmemory' as const };
    expect(shouldKeepRelativePath('src/interface/HTTP/adapters/fastify/fastify.ts', slice)).toBe(true);
    expect(shouldKeepRelativePath('src/interface/HTTP/adapters/express/express.ts', slice)).toBe(true);
    expect(shouldKeepRelativePath('test/integration/Fastify/foo.test.ts', slice)).toBe(false);
    expect(shouldKeepRelativePath('docker-compose-oracle.yml', slice)).toBe(false);
  });

  it('maps each http interface to its seed suite folder', () => {
    expect.hasAssertions();
    expect(HTTP_INTEGRATION_SUITES.express).toBe('Express');
    expect(HTTP_INTEGRATION_SUITES.fastify).toBe('Fastify');
    expect(HTTP_INTEGRATION_SUITES.restify).toBe('Restify');
  });
});

describe('backend generation — env rendering (JUM-847)', () => {
  it('maps plan db/http/realtime onto seed env keys', () => {
    expect.hasAssertions();
    expect(mapDbChoiceToDriver('sqlite')).toBe('SQLite');
    expect(mapDbChoiceToDriver('postgres')).toBe('PostgreSQL');
    expect(mapDbChoiceToDriver('inmemory')).toBe('InMemory');
    expect(mapRealtimeToEnv('none')).toStrictEqual({ enabled: 'no', protocol: 'websocket' });
    expect(mapRealtimeToEnv('grpc')).toStrictEqual({ enabled: 'yes', protocol: 'grpc' });
  });

  it('renders .env.dev from a seed template body', () => {
    expect.hasAssertions();
    const template = [
      'JUMENTIX_HTTP_FRAMEWORK=express',
      'JUMENTIX_REALTIME_API=no',
      'JUMENTIX_REALTIME_API_PROTOCOL=websocket',
      'JUMENTIX_DATABASE_DRIVER=InMemory',
      'JUMENTIX_DATABASE_NAME=jumentix',
      ''
    ].join('\n');
    const rendered = renderEnvDev({
      http: 'fastify',
      realtime: 'websocket',
      db: 'postgres'
    }, template);
    expect(rendered).toContain('JUMENTIX_HTTP_FRAMEWORK=fastify');
    expect(rendered).toContain('JUMENTIX_REALTIME_API=yes');
    expect(rendered).toContain('JUMENTIX_REALTIME_API_PROTOCOL=websocket');
    expect(rendered).toContain('JUMENTIX_DATABASE_DRIVER=PostgreSQL');
  });

  it('renders a minimal env when no template is provided', () => {
    expect.hasAssertions();
    const rendered = renderEnvDev({
      http: 'restify',
      realtime: 'none',
      db: 'mysql'
    });
    expect(rendered).toContain('JUMENTIX_HTTP_FRAMEWORK=restify');
    expect(rendered).toContain('JUMENTIX_DATABASE_DRIVER=MySQL');
    expect(rendered).toContain('JUMENTIX_REALTIME_API=no');
  });
});

describe('backend generation — package rename (JUM-847)', () => {
  it('builds @<project>/<service> with pinned @jumentix/* deps', () => {
    expect.hasAssertions();
    const pkg = buildServicePackageJson({
      projectName: 'Acme Apps',
      serviceId: 'core',
      pin: () => '1.2.3',
      http: 'express',
      realtime: 'none',
      db: 'sqlite'
    });
    expect(pkg.name).toBe('@acme-apps/core');
    expect(pkg.scripts).toStrictEqual(expect.objectContaining({
      dev: expect.any(String),
      test: expect.any(String),
      build: expect.any(String),
      lint: expect.any(String)
    }));
    expect(pkg.dependencies['@jumentix/database-client-factory']).toBe('1.2.3');
  });
});

describe('backend generation — domain selection (JUM-847)', () => {
  it('excludes Users from hexagonal injection (seed owns Users + auth)', () => {
    expect.hasAssertions();
    const plan = {
      mode: 'monolith' as const,
      services: [{
        id: 'core',
        kind: 'core' as const,
        domains: ['users', 'billing'],
        interfaces: { http: 'express' as const, realtime: 'none' as const },
        db: 'sqlite' as const
      }],
      domains: [
        {
          id: 'users',
          name: 'Users',
          entities: [{
            name: 'User',
            schema: { type: 'object' },
            primaryKey: 'id',
            relations: [],
            operations: []
          }]
        },
        {
          id: 'billing',
          name: 'Billing',
          entities: [{
            name: 'Invoice',
            schema: { type: 'object', properties: { id: { type: 'string' } } },
            primaryKey: 'id',
            relations: [],
            operations: []
          }]
        }
      ],
      contracts: { oasPerService: { core: {} } }
    };
    const selected = domainsForService(plan, plan.services[0]);
    expect(selected.map((domain: { id: string }) => domain.id)).toStrictEqual(['billing']);
  });

  it('renderCompositionRoot always imports Users and generated modules', () => {
    expect.hasAssertions();
    const source = renderCompositionRoot(['Billing']);
    expect(source).toContain('composeUsersAuthServices');
    expect(source).toContain('composeBillingServices');
    expect(source).toContain('GENERATED_DOMAIN_MODULES = ["Billing"]');
  });
});

describe('backend generation — generateBackend (JUM-847)', () => {
  it('copies template slice into apps/core', async () => {
    expect.hasAssertions();
    expect(fs.existsSync(templateRoot)).toBe(true);

    const plan = await resolveSources({
      preset: 'users',
      presetPath: fixture('users-oas.yml'),
      http: 'express',
      realtime: 'none',
      db: 'sqlite'
    });

    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-init-backend-gen-'));
    try {
      const result = await generateBackend({
        plan,
        outputDir: out,
        projectName: 'demo',
        templateRoot,
        jumentixVersion: '0.0.0'
      });
      expect(result.services).toHaveLength(1);
      const service = result.services[0];
      expect(service.packageName).toBe('@demo/core');
      expect(fs.existsSync(path.join(service.root, 'package.json'))).toBe(true);
      expect(fs.existsSync(path.join(service.root, 'src', 'modules', 'Users'))).toBe(true);
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });

  it('writes package name and pinned @jumentix deps', async () => {
    expect.hasAssertions();

    const plan = await resolveSources({
      preset: 'users',
      presetPath: fixture('users-oas.yml'),
      http: 'express',
      realtime: 'none',
      db: 'sqlite'
    });

    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-init-backend-pkg-'));
    try {
      const result = await generateBackend({
        plan,
        outputDir: out,
        projectName: 'demo',
        templateRoot,
        jumentixVersion: '0.0.0'
      });
      const pkg = JSON.parse(fs.readFileSync(path.join(result.services[0].root, 'package.json'), 'utf8'));
      expect(pkg.name).toBe('@demo/core');
      expect(pkg.dependencies['@jumentix/mutex-service']).toBe('0.0.0');
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });

  it('writes env and drops unused compose files', async () => {
    expect.hasAssertions();

    const plan = await resolveSources({
      preset: 'users',
      presetPath: fixture('users-oas.yml'),
      http: 'express',
      realtime: 'none',
      db: 'sqlite'
    });

    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-init-backend-env-'));
    try {
      const result = await generateBackend({
        plan,
        outputDir: out,
        projectName: 'demo',
        templateRoot,
        jumentixVersion: '0.0.0'
      });
      const service = result.services[0];
      expect(fs.existsSync(path.join(service.root, 'src', 'modules', 'compositionRoot.ts'))).toBe(true);
      expect(fs.existsSync(path.join(service.root, 'src', 'config', '.env.dev'))).toBe(true);
      expect(fs.existsSync(path.join(service.root, 'docker-compose-oracle.yml'))).toBe(false);
      expect(fs.existsSync(path.join(service.root, 'docker-compose-redis.yml'))).toBe(true);

      const env = fs.readFileSync(path.join(service.root, 'src', 'config', '.env.dev'), 'utf8');
      expect(env).toContain('JUMENTIX_HTTP_FRAMEWORK=express');
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });

  it('maps db and realtime onto generated .env.dev', async () => {
    expect.hasAssertions();

    const plan = await resolveSources({
      preset: 'users',
      presetPath: fixture('users-oas.yml'),
      http: 'express',
      realtime: 'none',
      db: 'sqlite'
    });

    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-init-backend-env2-'));
    try {
      const result = await generateBackend({
        plan,
        outputDir: out,
        projectName: 'demo',
        templateRoot,
        jumentixVersion: '0.0.0'
      });
      const env = fs.readFileSync(
        path.join(result.services[0].root, 'src', 'config', '.env.dev'),
        'utf8'
      );
      expect(env).toContain('JUMENTIX_DATABASE_DRIVER=SQLite');
      expect(env).toContain('JUMENTIX_REALTIME_API=no');
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });

  it('init --preset users --project-name writes apps/core', async () => {
    expect.hasAssertions();
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-init-backend-cli-'));
    const project = path.join(out, 'my-app');
    try {
      const messages: string[] = [];
      const code = await main(
        [
          'init',
          '--non-interactive',
          '--preset=users',
          '--mode=monolith',
          '--http=express',
          '--db=sqlite',
          `--project-name=${project}`
        ],
        (message = '') => {
          messages.push(message);
        }
      );
      expect(code).toBe(0);
      const text = messages.join('\n');
      expect(text).toContain('GenerationPlan resolved:');
      expect(text).toContain('Backend generation wrote');
      expect(fs.existsSync(path.join(project, 'apps', 'core', 'package.json'))).toBe(true);
      expect(fs.existsSync(path.join(project, 'apps', 'core', 'src', 'modules', 'Users'))).toBe(true);
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });
});

/**
/* dependency was pinned to the CLI's own version
 * (0.0.0), which no package publishes. Pins now come from the per-package
 * versions recorded in templates.manifest.json.
 */
describe('backend generation — per-package @jumentix/* pins (JUM-902)', () => {
  const packageRoot = path.resolve(__dirname, '..');
  const repoRoot = path.resolve(packageRoot, '..', '..');

  function sourceVersion(name: string): string {
    const dir = name.replace('@jumentix/', '');
    return JSON.parse(fs.readFileSync(path.join(repoRoot, 'packages', dir, 'package.json'), 'utf8')).version;
  }

  it('pins each runtime dependency to its own source package version', () => {
    expect.hasAssertions();
    const pin = resolveJumentixPin(packageRoot);
    const pkg = buildServicePackageJson({
      projectName: 'demo', serviceId: 'core', pin, http: 'express', realtime: 'none', db: 'sqlite'
    });
    const deps = pkg.dependencies as Record<string, string>;

    expect(Object.keys(deps).map((name) => [name, deps[name]])).toStrictEqual(
      Object.keys(deps).map((name) => [name, sourceVersion(name)])
    );
    expect(deps['@jumentix/database-client-factory']).not.toBe(deps['@jumentix/key-value-storage']);
  });

  it('fails closed for a package the manifest does not record', () => {
    expect.hasAssertions();
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-init-pins-'));
    try {
      fs.writeFileSync(path.join(empty, 'templates.manifest.json'), JSON.stringify({ packageVersions: {} }));

      expect(() => resolveJumentixPin(empty)('@jumentix/cana')).toThrow('No published version recorded for @jumentix/cana');
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });

  it('lets an explicit override pin every package to one version', () => {
    expect.hasAssertions();

    expect(resolveJumentixPin(packageRoot, '9.9.9')('@jumentix/cana')).toBe('9.9.9');
  });
});
