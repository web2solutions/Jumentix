/* eslint-disable jest/prefer-expect-assertions, jest/no-conditional-in-test */
import { spawn } from 'node:child_process';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';

const serverPath = path.resolve(process.cwd(), 'apps/service-management/server.js');
const staticRoot = path.resolve(process.cwd(), 'apps/service-management');

function createTempConfigDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jumentix-service-management-'));
  const envContent = [
    'JUMENTIX_HTTP_FRAMEWORK=express',
    'JUMENTIX_REALTIME_API=no',
    'JUMENTIX_REALTIME_API_PROTOCOL=websocket',
    'JUMENTIX_REALTIME_API_DATABASE_DRIVER=Mongo',
    ''
  ].join('\n');
  ['.env.dev', '.env.staging', '.env.ci', '.env.dev.example'].forEach((fileName) => {
    fs.writeFileSync(path.join(dir, fileName), envContent, 'utf8');
  });
  return dir;
}

function cleanupTempConfigDir(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function startServer(configDir: string, envOverrides: Record<string, string> = {}) {
  const port = 3200 + Math.floor(Math.random() * 1000);
  const env = {
    ...process.env,
    ...envOverrides,
    JUMENTIX_SERVICE_MANAGEMENT_PORT: String(port),
    JUMENTIX_SERVICE_MANAGEMENT_CONFIG_DIR: configDir
  };
  const proc = spawn('node', [serverPath], {
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return { proc, port };
}

function waitForServer(port: number, maxAttempts = 30): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = maxAttempts;
    const tryConnect = () => {
      const req = http.get(`http://127.0.0.1:${port}/api/runtime/env`, () => {
        resolve();
      });
      req.on('error', () => {
        if (attempts <= 0) {
          reject(new Error('server did not start'));
          return;
        }
        attempts -= 1;
        setTimeout(tryConnect, 200);
      });
      req.end();
    };
    tryConnect();
  });
}

function requestRaw(
  port: number,
  pathname: string
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: pathname,
        method: 'GET'
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          resolve({ status: res.statusCode || 0, body: raw });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

describe('serviceManagement static manifest refresh strategy (JUM-463)', () => {
  const fixtureName = `jum463-post-boot-${process.pid}-${Date.now()}.txt`;
  const fixtureMarker = `jum463-fixture-${process.pid}-${Date.now()}`;
  const fixturePath = path.join(staticRoot, fixtureName);
  const secretMarker = `jum463-secret-${process.pid}-${Date.now()}`;
  let tempDir: string;
  let secretDir: string;
  let server: ReturnType<typeof startServer> | undefined;

  beforeEach(() => {
    tempDir = createTempConfigDir();
    secretDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jumentix-jum463-secret-'));
    fs.writeFileSync(path.join(secretDir, 'secret.txt'), secretMarker, 'utf8');
  });

  afterEach(() => {
    if (server?.proc) {
      server.proc.kill();
    }
    server = undefined;
    fs.rmSync(fixturePath, { force: true });
    cleanupTempConfigDir(tempDir);
    fs.rmSync(secretDir, { recursive: true, force: true });
  });

  it('serves a file added after boot in dev mode (NODE_ENV-derived default)', async () => {
    expect.hasAssertions();
    server = startServer(tempDir, { NODE_ENV: 'dev' });
    await waitForServer(server.port);

    const beforeCreate = await requestRaw(server.port, `/${fixtureName}`);
    expect(beforeCreate.status).toBe(404);

    fs.writeFileSync(fixturePath, fixtureMarker, 'utf8');
    const afterCreate = await requestRaw(server.port, `/${fixtureName}`);
    expect(afterCreate.status).toBe(200);
    expect(afterCreate.body).toBe(fixtureMarker);
  });

  it('serves a file added after boot when refresh is explicitly enabled, even with NODE_ENV=production', async () => {
    expect.hasAssertions();
    server = startServer(tempDir, {
      NODE_ENV: 'production',
      JUMENTIX_SERVICE_MANAGEMENT_STATIC_MANIFEST_REFRESH: 'on-miss'
    });
    await waitForServer(server.port);

    fs.writeFileSync(fixturePath, fixtureMarker, 'utf8');
    const res = await requestRaw(server.port, `/${fixtureName}`);
    expect(res.status).toBe(200);
    expect(res.body).toBe(fixtureMarker);
  });

  it('does not serve a file added after boot in production mode (boot manifest only)', async () => {
    expect.hasAssertions();
    server = startServer(tempDir, { NODE_ENV: 'production' });
    await waitForServer(server.port);

    fs.writeFileSync(fixturePath, fixtureMarker, 'utf8');
    const res = await requestRaw(server.port, `/${fixtureName}`);
    expect(res.status).toBe(404);
    expect(res.body).not.toContain(fixtureMarker);

    const bootFile = await requestRaw(server.port, '/index.html');
    expect(bootFile.status).toBe(200);
  });

  it('does not serve a file added after boot when refresh is explicitly disabled, even with NODE_ENV=dev', async () => {
    expect.hasAssertions();
    server = startServer(tempDir, {
      NODE_ENV: 'dev',
      JUMENTIX_SERVICE_MANAGEMENT_STATIC_MANIFEST_REFRESH: 'boot-only'
    });
    await waitForServer(server.port);

    fs.writeFileSync(fixturePath, fixtureMarker, 'utf8');
    const res = await requestRaw(server.port, `/${fixtureName}`);
    expect(res.status).toBe(404);
    expect(res.body).not.toContain(fixtureMarker);
  });

  it('still 404s in dev mode for a genuinely absent file after the re-scan', async () => {
    expect.hasAssertions();
    server = startServer(tempDir, { NODE_ENV: 'dev' });
    await waitForServer(server.port);

    const res = await requestRaw(server.port, '/definitely-not-on-disk-jum463.txt');
    expect(res.status).toBe(404);
  });

  it('rejects traversal attempts in dev mode, including immediately after a re-scan', async () => {
    expect.hasAssertions();
    server = startServer(tempDir, { NODE_ENV: 'dev' });
    await waitForServer(server.port);

    // Trigger the dev re-scan with a miss, then attack the refreshed manifest.
    await requestRaw(server.port, '/definitely-not-on-disk-jum463.txt');

    const traversal = await requestRaw(server.port, '/x/../../secret.txt');
    expect([403, 404]).toContain(traversal.status);
    expect(traversal.body).not.toContain(secretMarker);

    const encoded = await requestRaw(server.port, '/..%2f..%2fsecret.txt');
    expect([403, 404]).toContain(encoded.status);
    expect(encoded.body).not.toContain(secretMarker);
  });

  it('rejects traversal attempts in production mode', async () => {
    expect.hasAssertions();
    server = startServer(tempDir, { NODE_ENV: 'production' });
    await waitForServer(server.port);

    const traversal = await requestRaw(server.port, '/x/../../secret.txt');
    expect([403, 404]).toContain(traversal.status);
    expect(traversal.body).not.toContain(secretMarker);
  });
});
