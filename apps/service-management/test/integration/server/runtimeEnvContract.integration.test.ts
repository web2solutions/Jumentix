/* eslint-disable
  jest/prefer-expect-assertions,
  jest/no-conditional-in-test,
  jest/no-conditional-expect,
  jest/max-expects
*/
/*
 * JUM-466 — Contract assertions for `GET`/`POST /api/runtime/env`.
 *
 * Each group names the H1 fix it pins so a regression re-breaks a named test:
 *  - JUM-459: the environment parameter is honored (the Wave-5 defect).
 *  - JUM-558: unknown environments are rejected, never silently coerced to dev.
 *  - JUM-543: filesystem failures are distinguishable from malformed payloads
 *    (500 with code and resolved path, never the 400 payload envelope).
 *  - JUM-462: loopback-by-default bind and token-gated mutation.
 *  - JUM-465/JUM-458: the pinned default config directory resolves.
 *
 * The contract asserted here is Requirement 126 §3, landed in full: the
 * JUM-543 error-surface split is no longer in flight, so the filesystem
 * failure class is asserted strictly.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  createTempConfigDir,
  cleanupTempConfigDir,
  envFileContent,
  firstNonLoopbackAddress,
  pinnedDefaultConfigDir,
  probeConnection,
  requestJson,
  requestRaw,
  startServer,
  stopServer,
  waitForServer
} from '../../helpers/serverHarness';
import type { RuntimeEnvPayload, StartedServer } from '../../helpers/serverHarness';

// Requirement 126 §3: accepted environments and their file mapping.
const ACCEPTED_ENVIRONMENTS = [
  { requested: 'dev', fileName: '.env.dev' },
  { requested: 'development', fileName: '.env.dev' },
  { requested: 'staging', fileName: '.env.staging' },
  { requested: 'ci', fileName: '.env.ci' },
  { requested: 'test', fileName: '.env.ci' }
];

// Distinct marker per file: the response could lie, the filesystem cannot.
const INITIAL_MARKERS: Record<string, string> = {
  '.env.dev': 'express',
  '.env.staging': 'fastify',
  '.env.ci': 'restify'
};

// Every POST uses enum-valid values only, so the suite stays green when
// JUM-460 lands enum validation on top of this contract.
const POST_VALUES: Record<string, string> = {
  dev: 'fastify',
  development: 'restify',
  staging: 'loopback',
  ci: 'sails-js',
  test: 'express'
};

function createStandardConfigDir() {
  return createTempConfigDir({
    '.env.dev': envFileContent(INITIAL_MARKERS['.env.dev']),
    '.env.staging': envFileContent(INITIAL_MARKERS['.env.staging']),
    '.env.ci': envFileContent(INITIAL_MARKERS['.env.ci']),
    '.env.dev.example': envFileContent('express')
  });
}

// The regression this pins: a write addressed at one environment landing in
// another environment's file. Verifies every file, not only the target.
function expectFilesToMatch(dir: string, expectedByFile: Record<string, string>) {
  Object.entries(expectedByFile).forEach(([target, expectedFramework]) => {
    const onDisk = fs.readFileSync(path.join(dir, target), 'utf8');
    expect(onDisk).toContain(`JUMENTIX_HTTP_FRAMEWORK=${expectedFramework}`);
  });
}

describe('serviceManagement runtime env contract (JUM-466)', () => {
  let tempDir: string;
  let server: StartedServer | undefined;

  beforeEach(() => {
    tempDir = createStandardConfigDir();
  });

  afterEach(() => {
    stopServer(server);
    server = undefined;
    cleanupTempConfigDir(tempDir);
  });

  it('honors the environment parameter on GET for every accepted environment (JUM-459)', async () => {
    expect.hasAssertions();
    server = await startServer(tempDir);
    await waitForServer(server.port);

    for (const { requested, fileName } of ACCEPTED_ENVIRONMENTS) {
      // eslint-disable-next-line no-await-in-loop
      const res = await requestJson<RuntimeEnvPayload>(
        server.port,
        'GET',
        `/api/runtime/env?environment=${requested}`
      );
      expect(res.status).toBe(200);
      expect(res.body.environment).toBe(requested);
      expect(res.body.fileName).toBe(fileName);
      // The marker proves the named file — not some other file — was read.
      expect(res.body.values.JUMENTIX_HTTP_FRAMEWORK).toBe(INITIAL_MARKERS[fileName]);
      // Response hygiene pinned by Requirement 126 §3.
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['content-type']).toContain('application/json');
    }
  });

  it('trims and case-folds the environment parameter (Requirement 126 §3)', async () => {
    expect.hasAssertions();
    server = await startServer(tempDir);
    await waitForServer(server.port);

    const res = await requestJson<RuntimeEnvPayload>(
      server.port,
      'GET',
      `/api/runtime/env?environment=${encodeURIComponent(' Staging ')}`
    );
    expect(res.status).toBe(200);
    expect(res.body.environment).toBe('staging');
    expect(res.body.fileName).toBe('.env.staging');
  });

  it('honors the environment parameter on POST and writes the correct file (JUM-459)', async () => {
    expect.hasAssertions();
    server = await startServer(tempDir);
    await waitForServer(server.port);

    const expectedByFile = { ...INITIAL_MARKERS };
    for (const { requested, fileName } of ACCEPTED_ENVIRONMENTS) {
      // eslint-disable-next-line no-await-in-loop
      const res = await requestJson<RuntimeEnvPayload>(
        server.port,
        'POST',
        '/api/runtime/env',
        { environment: requested, values: { JUMENTIX_HTTP_FRAMEWORK: POST_VALUES[requested] } }
      );
      expect(res.status).toBe(200);
      expect(res.body.environment).toBe(requested);
      expect(res.body.fileName).toBe(fileName);
      expect(res.body.values.JUMENTIX_HTTP_FRAMEWORK).toBe(POST_VALUES[requested]);

      expectedByFile[fileName] = POST_VALUES[requested];
      expectFilesToMatch(tempDir, expectedByFile);
    }
  });

  it('rejects an unknown environment on GET instead of redirecting to dev (JUM-558)', async () => {
    expect.hasAssertions();
    server = await startServer(tempDir);
    await waitForServer(server.port);

    const res = await requestJson<{ error: string; details: string }>(
      server.port,
      'GET',
      '/api/runtime/env?environment=production'
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid environment request');
    // The details must name the offending value and the accepted list.
    expect(res.body.details).toContain('production');
    expect(res.body.details).toContain('dev');
    expect(res.body.details).toContain('staging');
    expect(res.body.details).toContain('ci');
  });

  it('rejects an unknown environment on POST and leaves every file untouched (JUM-558)', async () => {
    expect.hasAssertions();
    server = await startServer(tempDir);
    await waitForServer(server.port);

    const res = await requestJson<{ error: string; details: string }>(
      server.port,
      'POST',
      '/api/runtime/env',
      { environment: 'production', values: { JUMENTIX_HTTP_FRAMEWORK: 'fastify' } }
    );
    expect(res.status).toBe(400);
    expect(res.body.details).toContain('Unsupported environment');

    // The Wave-5 failure mode was a silent redirect to dev: prove no file moved.
    Object.entries(INITIAL_MARKERS).forEach(([fileName, marker]) => {
      const onDisk = fs.readFileSync(path.join(tempDir, fileName), 'utf8');
      expect(onDisk).toContain(`JUMENTIX_HTTP_FRAMEWORK=${marker}`);
    });
  });

  it('returns 400 Invalid payload for a malformed JSON body (JUM-543)', async () => {
    expect.hasAssertions();
    server = await startServer(tempDir);
    await waitForServer(server.port);

    const res = await requestRaw(
      server.port,
      'POST',
      '/api/runtime/env',
      '{ this is not json'
    );
    expect(res.status).toBe(400);
    const parsed = JSON.parse(res.rawBody);
    expect(parsed.error).toBe('Invalid payload.');
  });

  it('surfaces a filesystem failure distinctly from a payload error (JUM-543)', async () => {
    expect.hasAssertions();
    // A config dir without .env.ci: reading or writing the ci environment is a
    // filesystem failure, not a client error, and must not be reported as
    // "Invalid payload."
    cleanupTempConfigDir(tempDir);
    tempDir = createTempConfigDir({
      '.env.dev': envFileContent('express'),
      '.env.staging': envFileContent('fastify')
    });
    server = await startServer(tempDir);
    await waitForServer(server.port);

    // Strict contract, landed by JUM-543: filesystem failures are a 500 class
    // carrying the error code and the resolved env-file path — read path…
    const res = await requestRaw(server.port, 'GET', '/api/runtime/env?environment=ci');
    expect(res.status).toBe(500);
    expect(res.rawBody).not.toContain('Invalid payload.');
    const parsed = JSON.parse(res.rawBody);
    expect(parsed.error).toBe('Environment file operation failed.');
    expect(parsed.code).toBe('ENV_FILE_NOT_FOUND');
    expect(parsed.path).toContain('.env.ci');

    // …and write path alike.
    const write = await requestJson<{ error: string; code: string; path: string }>(
      server.port,
      'POST',
      '/api/runtime/env',
      { environment: 'ci', values: { JUMENTIX_HTTP_FRAMEWORK: 'fastify' } }
    );
    expect(write.status).toBe(500);
    expect(write.body.error).toBe('Environment file operation failed.');
    expect(write.body.code).toBe('ENV_FILE_NOT_FOUND');
    expect(write.body.path).toContain('.env.ci');
  });

  it('binds loopback by default and refuses non-loopback connections (JUM-462)', async () => {
    expect.hasAssertions();
    server = await startServer(tempDir); // no JUMENTIX_SERVICE_MANAGEMENT_HOST override
    await waitForServer(server.port);

    const local = await requestJson<RuntimeEnvPayload>(server.port, 'GET', '/api/runtime/env');
    expect(local.status).toBe(200);

    const externalAddress = firstNonLoopbackAddress();
    if (!externalAddress) {
      // eslint-disable-next-line no-console
      console.warn('[JUM-466] no non-loopback interface on this machine; loopback probe skipped.');
      return;
    }
    const probe = await probeConnection(externalAddress, server.port);
    expect(probe).toBe('refused');
  });

  it('rejects a mutating request with a missing or wrong token, never gates reads (JUM-462)', async () => {
    expect.hasAssertions();
    server = await startServer(tempDir, { JUMENTIX_SERVICE_MANAGEMENT_AUTH_TOKEN: 'secret' });
    await waitForServer(server.port);

    const read = await requestJson<RuntimeEnvPayload>(server.port, 'GET', '/api/runtime/env');
    expect(read.status).toBe(200);

    const missing = await requestJson<{ error: string }>(
      server.port,
      'POST',
      '/api/runtime/env',
      { values: { JUMENTIX_HTTP_FRAMEWORK: 'fastify' } }
    );
    expect(missing.status).toBe(401);
    expect(missing.body.error).toBe('Unauthorized.');

    const wrong = await requestJson<{ error: string }>(
      server.port,
      'POST',
      '/api/runtime/env',
      { values: { JUMENTIX_HTTP_FRAMEWORK: 'fastify' } },
      { Authorization: 'Bearer wrong' }
    );
    expect(wrong.status).toBe(401);
    expect(wrong.body.error).toBe('Unauthorized.');
  });

  it('resolves the pinned default config directory when no override is set (JUM-465/JUM-458)', async () => {
    expect.hasAssertions();
    // Requirement 126 §2 pins this location; a future re-homing breaks here first.
    expect(fs.existsSync(pinnedDefaultConfigDir)).toBe(true);
    ['.env.dev', '.env.staging', '.env.ci'].forEach((fileName) => {
      expect(fs.existsSync(path.join(pinnedDefaultConfigDir, fileName))).toBe(true);
    });

    server = await startServer(null); // no JUMENTIX_SERVICE_MANAGEMENT_CONFIG_DIR
    await waitForServer(server.port);

    // Read-only on purpose: this boots against the real repository env files.
    const res = await requestJson<RuntimeEnvPayload>(
      server.port,
      'GET',
      '/api/runtime/env?environment=dev'
    );
    expect(res.status).toBe(200);
    expect(res.body.fileName).toBe('.env.dev');
  });
});
