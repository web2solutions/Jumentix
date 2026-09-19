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
} from '../../helpers/serverHarness';
import type { StartedServer } from '../../helpers/serverHarness';

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

function pm2ModuleSource(processes: unknown[], dumpPath: string) {
  return `const fs = require('fs');
const state = {
  processes: ${JSON.stringify(processes)},
  actions: []
};
function record(entry) {
  state.actions.push(entry);
  try {
    fs.writeFileSync(${JSON.stringify(dumpPath)}, JSON.stringify(state.actions), 'utf8');
  } catch (_error) { /* ignore */ }
}
module.exports = {
  connect(callback) { callback(null); },
  list(callback) { callback(null, state.processes); },
  start(target, optsOrCb, maybeCb) {
    const opts = typeof optsOrCb === 'function' ? undefined : optsOrCb;
    const callback = typeof optsOrCb === 'function' ? optsOrCb : maybeCb;
    record({ method: 'start', target, opts: opts || null });
    if (typeof callback === 'function') callback(null);
  },
  stop(target, callback) {
    record({ method: 'stop', target });
    if (typeof callback === 'function') callback(null);
  },
  restart(target, callback) {
    record({ method: 'restart', target });
    if (typeof callback === 'function') callback(null);
  },
  disconnect() {},
  __dumpActions() { return state.actions.slice(); }
};
`;
}

describe('service management PM2 ecosystem preview API (JUM-480)', () => {
  let configDir: string;
  let pm2Dir: string;
  let server: StartedServer | undefined;

  beforeAll(async () => {
    configDir = createTempConfigDir({ '.env.dev': envFileContent('express') });
    pm2Dir = createTempPm2Dir({
      'ecosystem.dev.config.cjs': ecosystemSource([
        { name: 'jumentix-dev-restapi', marker: 'rest-marker' },
        { name: 'jumentix-dev-service-management', marker: 'sm-marker' }
      ]),
      'ecosystem.staging.config.cjs': ecosystemSource([{ name: 'jumentix-staging-restapi', marker: 'staging-marker' }]),
      'ecosystem.production.config.cjs': ecosystemSource([{ name: 'jumentix-prod-restapi', marker: 'prod-marker' }])
      // No ecosystem.ci.cjs on purpose: the missing-file state is an
      // acceptance criterion, asserted below.
    });
    const pm2ModulePath = path.join(pm2Dir, 'pm2-fixture.cjs');
    const pm2ActionsDump = path.join(pm2Dir, 'pm2-actions.json');
    fs.writeFileSync(pm2ModulePath, pm2ModuleSource([
      {
        name: 'jumentix-dev-restapi',
        pm_id: 1,
        monit: { cpu: 3.5, memory: 52428800 },
        pm2_env: {
          name: 'jumentix-dev-restapi',
          namespace: 'default',
          status: 'online',
          restart_time: 2,
          unstable_restarts: 0,
          pm_uptime: Date.now() - 120000,
          pm_exec_path: './apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts',
          exec_interpreter: 'bun',
          watch: true,
          axm_monitor: { latency: { value: '12ms' } }
        }
      }
    ], pm2ActionsDump), 'utf8');
    server = await startServer(configDir, {
      JUMENTIX_SERVICE_MANAGEMENT_PM2_DIR: pm2Dir,
      JUMENTIX_SERVICE_MANAGEMENT_PM2_MODULE: pm2ModulePath
    });
    await waitForServer(server.port);
    (globalThis as any).__pm2ActionsDump = pm2ActionsDump;
  });

  afterAll(() => {
    stopServer(server);
    cleanupTempConfigDir(configDir);
    fs.rmSync(pm2Dir, { recursive: true, force: true });
  });

  it('reads the real ecosystem file — names, env and derived commands, no package-manager string', async () => {
    expect.hasAssertions();
    const { status, body } = await requestJson<Pm2EcosystemPayload>(
      server!.port,
      'GET',
      '/api/runtime/pm2-ecosystem?environment=dev'
    );
    expect(status).toBe(200);
    expect(body.environment).toBe('dev');
    expect(body.fileName).toBe('ecosystem.dev.config.cjs');
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
    expect(restApi.command).toContain('ecosystem.dev.config.cjs');
    // No package-manager invocation may be embedded (JUM-33/JUM-40 hazard).
    expect(restApi.command).not.toContain('pnpm');
    expect(restApi.command).not.toContain('bun run');
    expect(restApi.command).not.toContain('npm run');
  });

  it('collects runtime process metrics through the PM2 API', async () => {
    expect.hasAssertions();
    const { status, body } = await requestJson<any>(
      server!.port,
      'GET',
      '/api/runtime/pm2-metrics?environment=dev'
    );
    expect(status).toBe(200);
    expect(body.source).toBe('pm2');
    expect(body.environment).toBe('dev');
    expect(body.summary.processCount).toBe(1);
    expect(body.summary.onlineCount).toBe(1);
    expect(body.summary.totalCpuPercent).toBe(3.5);
    expect(body.summary.totalMemoryBytes).toBe(52428800);
    expect(body.ecosystem.missingExpected).toContain('jumentix-dev-service-management');
    expect(body.processes[0]).toMatchObject({
      name: 'jumentix-dev-restapi',
      pmId: 1,
      status: 'online',
      cpuPercent: 3.5,
      memoryBytes: 52428800,
      restartCount: 2,
      interpreter: 'bun',
      watching: true,
      customMetrics: { latency: '12ms' }
    });
    expect(body.host).toBeTruthy();
    expect(body.host.cpu).toBeTruthy();
    expect(body.host.memory).toBeTruthy();
    expect(Array.isArray(body.host.disk)).toBe(true);
    expect(typeof body.summary.asyncContextActiveSum).toBe('number');
    expect(body.processes[0].diskIo).toBeTruthy();
    expect(typeof body.processes[0].diskIo.supported).toBe('boolean');
    expect(body.processes[0].diskIo.platform).toBeTruthy();
  });

  it('streams Contract 1c-shaped metrics over WebSocket and accepts process actions', async () => {
    expect.hasAssertions();
    // Node 22+ provides a WHATWG WebSocket global; avoid importing the `ws`
    // package from the backend-template package boundary.
    const result = await new Promise<{ metrics: any; action: any }>((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${server!.port}/api/runtime/pm2-ws`);
      let metricsFrame: any = null;
      const timer = setTimeout(() => {
        socket.close();
        reject(new Error('WebSocket metrics/action timeout'));
      }, 8000);
      socket.addEventListener('open', () => {
        socket.send(JSON.stringify({
          type: 'subscribe',
          environment: 'dev',
          intervalMs: 2000
        }));
      });
      socket.addEventListener('message', (event) => {
        const message = JSON.parse(String((event as MessageEvent).data));
        if (message.type === 'metrics' && !metricsFrame) {
          metricsFrame = message;
          socket.send(JSON.stringify({
            type: 'action',
            action: 'restart',
            scope: 'process',
            name: 'jumentix-dev-restapi',
            pmId: 1
          }));
          return;
        }
        if (message.type === 'action-result' && metricsFrame) {
          clearTimeout(timer);
          socket.close();
          resolve({ metrics: metricsFrame, action: message });
        }
      });
      socket.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new Error('WebSocket connection error'));
      });
    });
    expect(result.metrics.type).toBe('metrics');
    expect(result.metrics.payload.source).toBe('pm2');
    expect(result.metrics.payload.host).toBeTruthy();
    expect(result.action.type).toBe('action-result');
    expect(result.action.ok).toBe(true);
    expect(result.action.action).toBe('restart');
  });

  it('starts a stopped process by name instead of ecosystem --only', async () => {
    expect.hasAssertions();
    const dumpPath = (globalThis as any).__pm2ActionsDump as string;
    if (fs.existsSync(dumpPath)) fs.unlinkSync(dumpPath);
    const result = await new Promise<{ action: any }>((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${server!.port}/api/runtime/pm2-ws`);
      const timer = setTimeout(() => {
        socket.close();
        reject(new Error('WebSocket start-after-stop timeout'));
      }, 8000);
      let subscribed = false;
      socket.addEventListener('open', () => {
        socket.send(JSON.stringify({
          type: 'subscribe',
          environment: 'dev',
          intervalMs: 2000
        }));
      });
      socket.addEventListener('message', (event) => {
        const message = JSON.parse(String((event as MessageEvent).data));
        if (message.type === 'metrics' && !subscribed) {
          subscribed = true;
          socket.send(JSON.stringify({
            type: 'action',
            action: 'start',
            scope: 'process',
            name: 'jumentix-dev-restapi',
            pmId: 1
          }));
          return;
        }
        if (message.type === 'action-result') {
          clearTimeout(timer);
          socket.close();
          resolve({ action: message });
        }
      });
      socket.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new Error('WebSocket connection error'));
      });
    });
    expect(result.action.ok).toBe(true);
    expect(result.action.action).toBe('start');
    const actions = JSON.parse(fs.readFileSync(dumpPath, 'utf8')) as Array<{
      method: string;
      target: string;
      opts: unknown;
    }>;
    const startCalls = actions.filter((entry) => entry.method === 'start');
    expect(startCalls.length).toBeGreaterThan(0);
    expect(startCalls.some((entry) => (
      entry.target === 'jumentix-dev-restapi' && entry.opts === null
    ))).toBe(true);
    expect(startCalls.every((entry) => (
      typeof entry.target === 'string' && !String(entry.target).includes('ecosystem.')
    ))).toBe(true);
  });

  it('reflects an ecosystem edit with no code change and no server restart', async () => {
    expect.hasAssertions();
    fs.writeFileSync(
      path.join(pm2Dir, 'ecosystem.dev.config.cjs'),
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
    expect.hasAssertions();
    const staging = await requestJson<Pm2EcosystemPayload>(
      server!.port,
      'GET',
      '/api/runtime/pm2-ecosystem?environment=staging'
    );
    expect(staging.status).toBe(200);
    expect(staging.body.fileName).toBe('ecosystem.staging.config.cjs');
    expect(staging.body.apps.map((app) => app.name)).toStrictEqual(['jumentix-staging-restapi']);

    const production = await requestJson<Pm2EcosystemPayload>(
      server!.port,
      'GET',
      '/api/runtime/pm2-ecosystem?environment=production'
    );
    expect(production.status).toBe(200);
    expect(production.body.fileName).toBe('ecosystem.production.config.cjs');
    expect(production.body.apps.map((app) => app.name)).toStrictEqual(['jumentix-prod-restapi']);

    const prodAlias = await requestJson<Pm2EcosystemPayload>(
      server!.port,
      'GET',
      '/api/runtime/pm2-ecosystem?environment=prod'
    );
    expect(prodAlias.status).toBe(200);
    expect(prodAlias.body.fileName).toBe('ecosystem.production.config.cjs');
  });

  it('reports a missing ecosystem file as an explicit state, not a silent empty preview or a 500', async () => {
    expect.hasAssertions();
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
    expect.hasAssertions();
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
    expect.hasAssertions();
    fs.writeFileSync(path.join(pm2Dir, 'ecosystem.staging.config.cjs'), 'module.exports = { apps: [', 'utf8');
    const { status, body } = await requestJson<ErrorEnvelope>(
      server!.port,
      'GET',
      '/api/runtime/pm2-ecosystem?environment=staging'
    );
    expect(status).toBe(500);
    expect(body.error).toBe('PM2 ecosystem file operation failed.');
    expect(body.code).toBeTruthy();
    expect(body.path).toContain('ecosystem.staging.config.cjs');
    expect(body.details).toContain('Could not load PM2 ecosystem file');
  });

  it('resolves the repository pm2/ directory by default when the override is unset', async () => {
    expect.hasAssertions();
    // A second server WITHOUT JUMENTIX_SERVICE_MANAGEMENT_PM2_DIR must find the
    // repo's real pm2/ecosystem.dev.config.cjs — the pinned default resolution, same
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
      expect(body.path).toBe('pm2/ecosystem.dev.config.cjs');
      expect(body.apps.map((app) => app.name)).toContain('jumentix-dev-restapi');
      expect(body.apps.map((app) => app.name)).toContain('jumentix-dev-service-management');
    } finally {
      stopServer(defaultServer);
    }
  });
});
