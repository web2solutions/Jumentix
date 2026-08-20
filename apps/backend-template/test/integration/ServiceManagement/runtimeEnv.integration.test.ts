/* eslint-disable jest/prefer-expect-assertions, jest/no-conditional-in-test, jest/max-expects */
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import {
  serverPath,
  cleanupTempConfigDir,
  createTempConfigDir,
  requestJson,
  startServer,
  stopServer
} from './serverHarness';
import type { RuntimeEnvPayload, StartedServer } from './serverHarness';

/**
 * The shared harness rather than a private copy of it (JUM-722).
 *
 * This suite carried its own `startServer`: a `3200 + random*1000` port, no
 * retry on EADDRINUSE, and readiness taken from a probe — the three things
 * JUM-628 replaced everywhere else. Jest runs suite files in parallel, so two
 * servers inside a 1000-port window collide, the loser dies unheard, and the
 * probe is answered by whichever server is actually on that port. That is how
 * "honors environment parameter on POST" once saw a 200 whose body had no
 * `environment` field at all: the answer came from another suite's server.
 *
 * Readiness now comes from the child's own listen line, so a server that did
 * not start cannot be mistaken for one that did.
 */
const ENV_FILE_CONTENT = [
  'JUMENTIX_REDIS_HOST=127.0.0.1',
  'JUMENTIX_REDIS_PORT=6379',
  'JUMENTIX_REDIS_DATABASE=1',
  'JUMENTIX_REDIS_PASSWORD=dev-redis-password',
  'JUMENTIX_JWT_TOKEN_SECRET_KEY=dev-jwt-secret',
  'JUMENTIX_JWT_ISSUER=jumentix',
  'JUMENTIX_JWT_AUDIENCE=jumentix-clients',
  'JUMENTIX_MESSAGE_MEDIATOR_ADAPTER=rabbitmq',
  'JUMENTIX_HTTP_FRAMEWORK=express',
  'JUMENTIX_REALTIME_API=no',
  'JUMENTIX_REALTIME_API_PROTOCOL=websocket',
  '#JUMENTIX_WEBSOCKET_SOCKETIO_ADAPTER=redis-streams',
  '#JUMENTIX_WEBSOCKET_REDIS_URL=redis://127.0.0.1:6379/1',
  'JUMENTIX_REALTIME_API_DATABASE_DRIVER=Mongo',
  'JUMENTIX_DATABASE_DRIVER=InMemory',
  'JUMENTIX_DATABASE_NAME=jumentix',
  'JUMENTIX_ENABLE_BASIC_AUTH=yes',
  'JUMENTIX_AUTH_MAX_LOGIN_ATTEMPTS=5',
  'JUMENTIX_AUTH_LOGIN_WINDOW_SECONDS=300',
  'JUMENTIX_AUTH_LOCKOUT_SECONDS=900',
  'JUMENTIX_CORS_ALLOWED_ORIGINS=http://localhost:3000',
  'JUMENTIX_RABBITMQ_URL=amqp://guest:guest@127.0.0.1:5672',
  'JUMENTIX_RABBITMQ_EXCHANGE=app.events',
  'JUMENTIX_RABBITMQ_REQUEST_QUEUE=app.requests',
  'JUMENTIX_RABBITMQ_PREFETCH=10',
  ''
].join('\n');

const configFiles = () => Object.fromEntries(
  ['.env.dev', '.env.staging', '.env.ci', '.env.dev.example']
    .map((fileName) => [fileName, ENV_FILE_CONTENT])
);

describe('serviceManagement runtime env server', () => {
  let tempDir: string;
  let server: StartedServer | undefined;

  beforeEach(() => {
    tempDir = createTempConfigDir(configFiles());
  });

  afterEach(() => {
    stopServer(server);
    server = undefined;
    cleanupTempConfigDir(tempDir);
  });

  it('rejects unknown environment with 400 and accepted list', async () => {
    expect.hasAssertions();
    server = await startServer(tempDir);
    const res = await requestJson<{ error: string; details: string }>(
      server.port,
      'GET',
      '/api/runtime/env?environment=production'
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid environment request');
    expect(res.body.details).toContain('Unsupported environment');
  });

  it('honors environment parameter on GET', async () => {
    expect.hasAssertions();
    server = await startServer(tempDir);
    const res = await requestJson<RuntimeEnvPayload>(
      server.port,
      'GET',
      '/api/runtime/env?environment=staging'
    );
    expect(res.status).toBe(200);
    expect(res.body.environment).toBe('staging');
    expect(res.body.fileName).toBe('.env.staging');
  });

  it('rejects POST without auth token when configured', async () => {
    expect.hasAssertions();
    server = await startServer(tempDir, { JUMENTIX_SERVICE_MANAGEMENT_AUTH_TOKEN: 'secret' });
    const res = await requestJson<{ error: string }>(
      server.port,
      'POST',
      '/api/runtime/env',
      { values: { JUMENTIX_HTTP_FRAMEWORK: 'fastify' } }
    );
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized.');
  });

  it('accepts POST with valid auth token and writes atomically', async () => {
    expect.hasAssertions();
    server = await startServer(tempDir, { JUMENTIX_SERVICE_MANAGEMENT_AUTH_TOKEN: 'secret' });
    const res = await requestJson<RuntimeEnvPayload>(
      server.port,
      'POST',
      '/api/runtime/env',
      { values: { JUMENTIX_HTTP_FRAMEWORK: 'fastify' } },
      { Authorization: 'Bearer secret' }
    );
    expect(res.status).toBe(200);
    expect(res.body.values.JUMENTIX_HTTP_FRAMEWORK).toBe('fastify');
  });

  it('honors environment parameter on POST', async () => {
    expect.hasAssertions();
    server = await startServer(tempDir, { JUMENTIX_SERVICE_MANAGEMENT_AUTH_TOKEN: 'secret' });
    const res = await requestJson<RuntimeEnvPayload>(
      server.port,
      'POST',
      '/api/runtime/env',
      { environment: 'staging', values: { JUMENTIX_HTTP_FRAMEWORK: 'restify' } },
      { Authorization: 'Bearer secret' }
    );
    expect(res.status).toBe(200);
    expect(res.body.environment).toBe('staging');
    expect(res.body.values.JUMENTIX_HTTP_FRAMEWORK).toBe('restify');
  });

  it('writes the main and realtime database drivers as distinct keys', async () => {
    expect.hasAssertions();
    server = await startServer(tempDir, { JUMENTIX_SERVICE_MANAGEMENT_AUTH_TOKEN: 'secret' });
    const res = await requestJson<RuntimeEnvPayload>(
      server.port,
      'POST',
      '/api/runtime/env',
      {
        values: {
          JUMENTIX_DATABASE_DRIVER: 'PostgreSQL',
          JUMENTIX_REALTIME_API_DATABASE_DRIVER: 'Cassandra'
        }
      },
      { Authorization: 'Bearer secret' }
    );
    expect(res.status).toBe(200);
    expect(res.body.values.JUMENTIX_DATABASE_DRIVER).toBe('PostgreSQL');
    expect(res.body.values.JUMENTIX_REALTIME_API_DATABASE_DRIVER).toBe('Cassandra');
    const written = fs.readFileSync(path.join(tempDir, '.env.dev'), 'utf8');
    expect(written).toContain('JUMENTIX_DATABASE_DRIVER=PostgreSQL');
    expect(written).toContain('JUMENTIX_REALTIME_API_DATABASE_DRIVER=Cassandra');
  });

  it('fails at boot when config directory is missing', async () => {
    expect.hasAssertions();
    const missingDir = path.resolve(process.cwd(), 'apps/nonexistent-config');
    const proc = spawn('node', [serverPath], {
      env: {
        ...process.env,
        JUMENTIX_SERVICE_MANAGEMENT_CONFIG_DIR: missingDir
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stderr = '';
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk;
    });
    await new Promise<void>((resolve) => {
      proc.on('exit', (code: number | null) => {
        expect(code).toBe(1);
        expect(stderr).toContain('config directory not found');
        resolve();
      });
    });
  });

  it('exposes editable and read-only tiers on GET but never secrets', async () => {
    expect.hasAssertions();
    server = await startServer(tempDir);
    const res = await requestJson<RuntimeEnvPayload>(server.port, 'GET', '/api/runtime/env?environment=dev');
    expect(res.status).toBe(200);
    expect(res.body.values.JUMENTIX_DATABASE_DRIVER).toBe('InMemory');
    expect(res.body.values.JUMENTIX_MESSAGE_MEDIATOR_ADAPTER).toBe('rabbitmq');
    expect(res.body.values.JUMENTIX_REDIS_HOST).toBe('127.0.0.1');
    expect(res.body.values.JUMENTIX_CORS_ALLOWED_ORIGINS).toBe('http://localhost:3000');
    expect(res.body.values).not.toHaveProperty('JUMENTIX_JWT_TOKEN_SECRET_KEY');
    expect(res.body.values).not.toHaveProperty('JUMENTIX_REDIS_PASSWORD');
    expect(res.body.values).not.toHaveProperty('JUMENTIX_RABBITMQ_URL');
    expect(res.body.editableKeys ?? []).toStrictEqual(
      expect.arrayContaining([
        'JUMENTIX_HTTP_FRAMEWORK',
        'JUMENTIX_REALTIME_API',
        'JUMENTIX_REALTIME_API_PROTOCOL',
        'JUMENTIX_REALTIME_API_DATABASE_DRIVER',
        'JUMENTIX_DATABASE_DRIVER',
        'JUMENTIX_KEYVALUESTORAGE_DRIVER',
        'JUMENTIX_MESSAGE_MEDIATOR_ADAPTER',
        'JUMENTIX_WEBSOCKET_SOCKETIO_ADAPTER',
        'JUMENTIX_WEBSOCKET_REDIS_URL'
      ])
    );
    expect(res.body.editableKeys ?? []).not.toContain('JUMENTIX_REDIS_HOST');
    expect(res.body.editableKeys ?? []).not.toContain('JUMENTIX_REDIS_PASSWORD');
  });

  it('ignores read-only and never-exposed keys on POST', async () => {
    expect.hasAssertions();
    server = await startServer(tempDir);
    const res = await requestJson<RuntimeEnvPayload>(server.port, 'POST', '/api/runtime/env', {
      values: {
        JUMENTIX_HTTP_FRAMEWORK: 'fastify',
        JUMENTIX_REDIS_HOST: '10.0.0.9',
        JUMENTIX_REDIS_PASSWORD: 'rewritten-secret',
        JUMENTIX_RABBITMQ_URL: 'amqp://attacker:attacker@evil:5672'
      }
    });
    expect(res.status).toBe(200);
    expect(res.body.values.JUMENTIX_HTTP_FRAMEWORK).toBe('fastify');
    const fileContent = fs.readFileSync(path.join(tempDir, '.env.dev'), 'utf8');
    expect(fileContent).toContain('JUMENTIX_HTTP_FRAMEWORK=fastify');
    expect(fileContent).toContain('JUMENTIX_REDIS_HOST=127.0.0.1');
    expect(fileContent).not.toContain('10.0.0.9');
    expect(fileContent).not.toContain('rewritten-secret');
    expect(fileContent).not.toContain('attacker');
  });

  it('rejects out-of-enum values with the accepted list and writes nothing', async () => {
    expect.hasAssertions();
    server = await startServer(tempDir);
    const before = fs.readFileSync(path.join(tempDir, '.env.dev'), 'utf8');
    const res = await requestJson<{ error: string; details: string }>(
      server.port,
      'POST',
      '/api/runtime/env',
      { values: { JUMENTIX_HTTP_FRAMEWORK: 'garbage' } }
    );
    expect(res.status).toBe(400);
    expect(res.body.details).toContain('JUMENTIX_HTTP_FRAMEWORK');
    expect(res.body.details).toContain('Accepted values:');
    expect(res.body.details).toContain('express');
    expect(fs.readFileSync(path.join(tempDir, '.env.dev'), 'utf8')).toBe(before);
  });

  it('rejects credential-bearing JUMENTIX_WEBSOCKET_REDIS_URL values', async () => {
    expect.hasAssertions();
    server = await startServer(tempDir);
    const before = fs.readFileSync(path.join(tempDir, '.env.dev'), 'utf8');
    const res = await requestJson<{ error: string; details: string }>(
      server.port,
      'POST',
      '/api/runtime/env',
      { values: { JUMENTIX_WEBSOCKET_REDIS_URL: 'redis://:secret@127.0.0.1:6379/1' } }
    );
    expect(res.status).toBe(400);
    expect(res.body.details).toContain('JUMENTIX_WEBSOCKET_REDIS_URL');
    expect(res.body.details).toContain('credentials');
    expect(fs.readFileSync(path.join(tempDir, '.env.dev'), 'utf8')).toBe(before);
  });

  it('writes the widened editable set, uncommenting or appending keys as needed', async () => {
    expect.hasAssertions();
    server = await startServer(tempDir);
    const res = await requestJson<RuntimeEnvPayload>(server.port, 'POST', '/api/runtime/env', {
      values: {
        JUMENTIX_DATABASE_DRIVER: 'PostgreSQL',
        JUMENTIX_MESSAGE_MEDIATOR_ADAPTER: 'bullmq',
        JUMENTIX_KEYVALUESTORAGE_DRIVER: 'inmemory',
        JUMENTIX_WEBSOCKET_SOCKETIO_ADAPTER: 'cluster',
        JUMENTIX_WEBSOCKET_REDIS_URL: 'redis://127.0.0.1:6379/2'
      }
    });
    expect(res.status).toBe(200);
    const fileContent = fs.readFileSync(path.join(tempDir, '.env.dev'), 'utf8');
    expect(fileContent).toContain('JUMENTIX_DATABASE_DRIVER=PostgreSQL');
    expect(fileContent).toContain('JUMENTIX_MESSAGE_MEDIATOR_ADAPTER=bullmq');
    expect(fileContent).toContain('JUMENTIX_KEYVALUESTORAGE_DRIVER=inmemory');
    expect(fileContent).toContain('JUMENTIX_WEBSOCKET_SOCKETIO_ADAPTER=cluster');
    expect(fileContent).not.toContain('#JUMENTIX_WEBSOCKET_SOCKETIO_ADAPTER');
    expect(fileContent).toContain('JUMENTIX_WEBSOCKET_REDIS_URL=redis://127.0.0.1:6379/2');
  });
});
