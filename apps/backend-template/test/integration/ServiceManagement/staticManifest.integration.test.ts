/* eslint-disable jest/prefer-expect-assertions, jest/no-conditional-in-test */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  cleanupTempConfigDir,
  createTempConfigDir,
  envFileContent,
  requestRaw,
  startServer,
  staticRoot,
  stopServer
} from './serverHarness';
import type { StartedServer } from './serverHarness';

/**
 * The shared harness rather than a private copy of it (JUM-722).
 *
 * This suite carried its own `startServer`: a `3200 + random*1000` port, no
 * retry on EADDRINUSE, and readiness taken from a probe. Jest runs suite files
 * in parallel, so two servers inside a 1000-port window collide; the loser dies
 * unheard and the probe is answered by the OTHER suite's server, which was
 * started with a different `NODE_ENV` and a different refresh setting. That is
 * how "does not serve a file added after boot in production mode" saw a 200 on
 * CI while passing everywhere else — the answer came from the dev-mode server,
 * which re-scans on miss.
 *
 * `serverHarness` fixed all three in JUM-628; this file simply was not using
 * it. Readiness now comes from the child's own listen line, so a server that
 * did not start cannot be mistaken for one that did.
 */
const configFiles = () => Object.fromEntries(
  ['.env.dev', '.env.staging', '.env.ci', '.env.dev.example']
    .map((fileName) => [fileName, envFileContent('express')])
);

describe('serviceManagement static manifest refresh strategy (JUM-463)', () => {
  const fixtureName = `jum463-post-boot-${process.pid}-${Date.now()}.txt`;
  const fixtureMarker = `jum463-fixture-${process.pid}-${Date.now()}`;
  const fixturePath = path.join(staticRoot, fixtureName);
  const secretMarker = `jum463-secret-${process.pid}-${Date.now()}`;
  let tempDir: string;
  let secretDir: string;
  let server: StartedServer | undefined;

  beforeEach(() => {
    tempDir = createTempConfigDir(configFiles());
    secretDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jumentix-jum463-secret-'));
    fs.writeFileSync(path.join(secretDir, 'secret.txt'), secretMarker, 'utf8');
  });

  afterEach(() => {
    stopServer(server);
    server = undefined;
    fs.rmSync(fixturePath, { force: true });
    cleanupTempConfigDir(tempDir);
    fs.rmSync(secretDir, { recursive: true, force: true });
  });

  it('serves a file added after boot in dev mode (NODE_ENV-derived default)', async () => {
    expect.hasAssertions();
    server = await startServer(tempDir, { NODE_ENV: 'dev' });

    const beforeCreate = await requestRaw(server.port, 'GET', `/${fixtureName}`);
    expect(beforeCreate.status).toBe(404);

    fs.writeFileSync(fixturePath, fixtureMarker, 'utf8');
    const afterCreate = await requestRaw(server.port, 'GET', `/${fixtureName}`);
    expect(afterCreate.status).toBe(200);
    expect(afterCreate.rawBody).toBe(fixtureMarker);
  });

  it('serves a file added after boot when refresh is explicitly enabled, even with NODE_ENV=production', async () => {
    expect.hasAssertions();
    server = await startServer(tempDir, {
      NODE_ENV: 'production',
      JUMENTIX_SERVICE_MANAGEMENT_STATIC_MANIFEST_REFRESH: 'on-miss'
    });

    fs.writeFileSync(fixturePath, fixtureMarker, 'utf8');
    const res = await requestRaw(server.port, 'GET', `/${fixtureName}`);
    expect(res.status).toBe(200);
    expect(res.rawBody).toBe(fixtureMarker);
  });

  it('does not serve a file added after boot in production mode (boot manifest only)', async () => {
    expect.hasAssertions();
    server = await startServer(tempDir, { NODE_ENV: 'production' });

    fs.writeFileSync(fixturePath, fixtureMarker, 'utf8');
    const res = await requestRaw(server.port, 'GET', `/${fixtureName}`);
    expect(res.status).toBe(404);
    expect(res.rawBody).not.toContain(fixtureMarker);

    const bootFile = await requestRaw(server.port, 'GET', '/index.html');
    expect(bootFile.status).toBe(200);
  });

  it('does not serve a file added after boot when refresh is explicitly disabled, even with NODE_ENV=dev', async () => {
    expect.hasAssertions();
    server = await startServer(tempDir, {
      NODE_ENV: 'dev',
      JUMENTIX_SERVICE_MANAGEMENT_STATIC_MANIFEST_REFRESH: 'boot-only'
    });

    fs.writeFileSync(fixturePath, fixtureMarker, 'utf8');
    const res = await requestRaw(server.port, 'GET', `/${fixtureName}`);
    expect(res.status).toBe(404);
    expect(res.rawBody).not.toContain(fixtureMarker);
  });

  it('still 404s in dev mode for a genuinely absent file after the re-scan', async () => {
    expect.hasAssertions();
    server = await startServer(tempDir, { NODE_ENV: 'dev' });

    const res = await requestRaw(server.port, 'GET', '/definitely-not-on-disk-jum463.txt');
    expect(res.status).toBe(404);
  });

  it('rejects traversal attempts in dev mode, including immediately after a re-scan', async () => {
    expect.hasAssertions();
    server = await startServer(tempDir, { NODE_ENV: 'dev' });

    // Trigger the dev re-scan with a miss, then attack the refreshed manifest.
    await requestRaw(server.port, 'GET', '/definitely-not-on-disk-jum463.txt');

    const traversal = await requestRaw(server.port, 'GET', '/x/../../secret.txt');
    expect([403, 404]).toContain(traversal.status);
    expect(traversal.rawBody).not.toContain(secretMarker);

    const encoded = await requestRaw(server.port, 'GET', '/..%2f..%2fsecret.txt');
    expect([403, 404]).toContain(encoded.status);
    expect(encoded.rawBody).not.toContain(secretMarker);
  });

  it('rejects traversal attempts in production mode', async () => {
    expect.hasAssertions();
    server = await startServer(tempDir, { NODE_ENV: 'production' });

    const traversal = await requestRaw(server.port, 'GET', '/x/../../secret.txt');
    expect([403, 404]).toContain(traversal.status);
    expect(traversal.rawBody).not.toContain(secretMarker);
  });
});
