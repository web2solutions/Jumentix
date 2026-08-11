/* eslint-disable jest/prefer-expect-assertions, jest/no-conditional-in-test, jest/max-expects */
/*
 * JUM-480 — Contract assertions for `GET /api/runtime/pm2-ecosystem`.
 *
 * The PM2 preview must read reality: the real `pm2/ecosystem.*.cjs` files, not
 * a hardcoded command map. Each assertion pins one acceptance criterion:
 *  - the preview reflects the ecosystem file (an edit changes the response
 *    with no code change — proven by rewriting the file mid-suite);
 *  - every environment the ecosystems define is covered (dev, staging,
 *    production), not only dev;
 *  - the reported command derives from the ecosystem definition (file path +
 *    app name), never an embedded package-manager string;
 *  - a missing ecosystem file is an explicit `exists: false` state, and an
 *    unreadable/broken one is the honest 500 envelope (JUM-543 discipline);
 *  - unknown environments are rejected, never silently coerced (JUM-558).
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  createTempConfigDir,
  cleanupTempConfigDir,
  envFileContent,
  requestJson,
  startServer,
  stopServer,
  waitForServer
} from './serverHarness';
import type { StartedServer } from './serverHarness';

type Pm2EcosystemApp = {
  name: string;
  script: string;
  interpreter: string;
  interpreterArgs: string;
  env: Record<string, string>;
  command: string;
};

type Pm2EcosystemPayload = {
  environment: string;
  fileName: string;
  path: string;
  exists: boolean;
  apps: Pm2EcosystemApp[];
};

type ErrorEnvelope = {
  error: string;
  code?: string;
  path?: string;
  details?: string;
};

function createTempPm2Dir(files: Record<string, string>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jumentix-pm2-ecosystem-'));
  Object.entries(files).forEach(([fileName, content]) => {
    fs.writeFileSync(path.join(dir, fileName), content, 'utf8');
  });
  return dir;
}

function ecosystemSource(apps: Array<{ name: string; marker: string }>) {
  const entries = apps
    .map(
      (app) => `    {
      name: '${app.name}',
      script: './apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts',
      interpreter: 'bun',
      interpreter_args: '--env-file=./apps/backend-template/src/config/.env.dev',
      env: { NODE_ENV: 'dev', MARKER: '${app.marker}' }
    }`
    )
    .join(',\n');
  return `module.exports = {\n  apps: [\n${entries}\n  ]\n};\n`;
}

describe('service management PM2 ecosystem preview API (JUM-480)', () => {
  let configDir: string;
  let pm2Dir: string;
  let server: StartedServer | undefined;

  beforeAll(async () => {
    configDir = createTempConfigDir({ '.env.dev': envFileContent('express') });
    pm2Dir = createTempPm2Dir({
      'ecosystem.dev.cjs': ecosystemSource([
        { name: 'jumentix-dev-restapi', marker: 'rest-marker' },
        { name: 'jumentix-dev-service-management', marker: 'sm-marker' }
      ]),
      'ecosystem.staging.cjs': ecosystemSource([{ name: 'jumentix-staging-restapi', marker: 'staging-marker' }]),
      'ecosystem.production.cjs': ecosystemSource([{ name: 'jumentix-prod-restapi', marker: 'prod-marker' }])
      // No ecosystem.ci.cjs on purpose: the missing-file state is an
      // acceptance criterion, asserted below.
    });
    server = await startServer(configDir, { JUMENTIX_SERVICE_MANAGEMENT_PM2_DIR: pm2Dir });
    await waitForServer(server.port);
  });

  afterAll(() => {
    stopServer(server);
    cleanupTempConfigDir(configDir);
    fs.rmSync(pm2Dir, { recursive: true, force: true });
  });

  it('reads the real ecosystem file — names, env and derived commands, no package-manager string', async () => {
    const { status, body } = await requestJson<Pm2EcosystemPayload>(
      server!.port,
      'GET',
      '/api/runtime/pm2-ecosystem?environment=dev'
    );
    expect(status).toBe(200);
    expect(body.environment).toBe('dev');
    expect(body.fileName).toBe('ecosystem.dev.cjs');
    expect(body.exists).toBe(true);
    expect(body.apps.map((app) => app.name)).toStrictEqual([
      'jumentix-dev-restapi',
      'jumentix-dev-service-management'
    ]);
    const restApi = body.apps[0];
    expect(restApi.env.MARKER).toBe('rest-marker');
    expect(restApi.interpreter).toBe('bun');
    // The command derives from the ecosystem definition (file + app name).
    expect(restApi.command).toContain('pm2 start ');
    expect(restApi.command).toContain('--only jumentix-dev-restapi --update-env');
    expect(restApi.command).toContain('ecosystem.dev.cjs');
    // No package-manager invocation may be embedded (JUM-33/JUM-40 hazard).
    expect(restApi.command).not.toContain('pnpm');
    expect(restApi.command).not.toContain('bun run');
    expect(restApi.command).not.toContain('npm run');
  });

  it('reflects an ecosystem edit with no code change and no server restart', async () => {
    fs.writeFileSync(
      path.join(pm2Dir, 'ecosystem.dev.cjs'),
      ecosystemSource([
        { name: 'jumentix-dev-restapi', marker: 'rest-marker' },
        { name: 'jumentix-dev-service-management', marker: 'sm-marker' },
        { name: 'jumentix-dev-added-app', marker: 'added-marker' }
      ]),
      'utf8'
    );
    const { status, body } = await requestJson<Pm2EcosystemPayload>(
      server!.port,
      'GET',
      '/api/runtime/pm2-ecosystem?environment=dev'
    );
    expect(status).toBe(200);
    expect(body.apps.map((app) => app.name)).toContain('jumentix-dev-added-app');
  });

  it('covers every environment the ecosystems define, not only dev', async () => {
    const staging = await requestJson<Pm2EcosystemPayload>(
      server!.port,
      'GET',
      '/api/runtime/pm2-ecosystem?environment=staging'
    );
    expect(staging.status).toBe(200);
    expect(staging.body.fileName).toBe('ecosystem.staging.cjs');
    expect(staging.body.apps.map((app) => app.name)).toStrictEqual(['jumentix-staging-restapi']);

    const production = await requestJson<Pm2EcosystemPayload>(
      server!.port,
      'GET',
      '/api/runtime/pm2-ecosystem?environment=production'
    );
    expect(production.status).toBe(200);
    expect(production.body.fileName).toBe('ecosystem.production.cjs');
    expect(production.body.apps.map((app) => app.name)).toStrictEqual(['jumentix-prod-restapi']);

    const prodAlias = await requestJson<Pm2EcosystemPayload>(
      server!.port,
      'GET',
      '/api/runtime/pm2-ecosystem?environment=prod'
    );
    expect(prodAlias.status).toBe(200);
    expect(prodAlias.body.fileName).toBe('ecosystem.production.cjs');
  });

  it('reports a missing ecosystem file as an explicit state, not a silent empty preview or a 500', async () => {
    const { status, body } = await requestJson<Pm2EcosystemPayload>(
      server!.port,
      'GET',
      '/api/runtime/pm2-ecosystem?environment=ci'
    );
    expect(status).toBe(200);
    expect(body.environment).toBe('ci');
    expect(body.fileName).toBe('ecosystem.ci.cjs');
    expect(body.exists).toBe(false);
    expect(body.apps).toStrictEqual([]);
    expect(body.path).toContain('ecosystem.ci.cjs');
  });

  it('rejects an unknown environment explicitly, never coercing to dev', async () => {
    const { status, body } = await requestJson<ErrorEnvelope>(
      server!.port,
      'GET',
      '/api/runtime/pm2-ecosystem?environment=qa'
    );
    expect(status).toBe(400);
    expect(body.error).toBe('Invalid environment request.');
    expect(body.details).toContain('qa');
    expect(body.details).toContain('production');
  });

  it('surfaces a broken ecosystem file as the honest 500 envelope with code and path', async () => {
    fs.writeFileSync(path.join(pm2Dir, 'ecosystem.staging.cjs'), 'module.exports = { apps: [', 'utf8');
    const { status, body } = await requestJson<ErrorEnvelope>(
      server!.port,
      'GET',
      '/api/runtime/pm2-ecosystem?environment=staging'
    );
    expect(status).toBe(500);
    expect(body.error).toBe('PM2 ecosystem file operation failed.');
    expect(body.code).toBeTruthy();
    expect(body.path).toContain('ecosystem.staging.cjs');
    expect(body.details).toContain('Could not load PM2 ecosystem file');
  });

  it('resolves the repository pm2/ directory by default when the override is unset', async () => {
    // A second server WITHOUT JUMENTIX_SERVICE_MANAGEMENT_PM2_DIR must find the
    // repo's real pm2/ecosystem.dev.cjs — the pinned default resolution, same
    // discipline as the config directory (Requirement 126 §2).
    const defaultServer = await startServer(configDir);
    try {
      await waitForServer(defaultServer.port);
      const { status, body } = await requestJson<Pm2EcosystemPayload>(
        defaultServer.port,
        'GET',
        '/api/runtime/pm2-ecosystem?environment=dev'
      );
      expect(status).toBe(200);
      expect(body.exists).toBe(true);
      expect(body.path).toBe('pm2/ecosystem.dev.cjs');
      expect(body.apps.map((app) => app.name)).toContain('jumentix-dev-restapi');
      expect(body.apps.map((app) => app.name)).toContain('jumentix-dev-service-management');
    } finally {
      stopServer(defaultServer);
    }
  });
});
