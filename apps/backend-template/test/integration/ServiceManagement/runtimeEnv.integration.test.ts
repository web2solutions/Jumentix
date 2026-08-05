/* eslint-disable jest/prefer-expect-assertions, jest/no-conditional-in-test, jest/max-expects */
import { spawn } from 'node:child_process';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';

const serverPath = path.resolve(process.cwd(), 'apps/service-management/server.js');

type RuntimeEnvPayload = {
  environment: string;
  fileName: string;
  editableKeys: string[];
  values: Record<string, string>;
};

function createTempConfigDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jumentix-service-management-'));
  const envContent = [
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

function requestJson<T>(
  port: number,
  method: string,
  pathname: string,
  body?: unknown,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: T }> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: pathname,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': payload ? Buffer.byteLength(payload) : 0,
          ...headers
        }
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          resolve({
            status: res.statusCode || 0,
            body: raw ? JSON.parse(raw) : ({} as T)
          });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe('serviceManagement runtime env server', () => {
  let tempDir: string;
  let server: ReturnType<typeof startServer>;

  beforeEach(() => {
    tempDir = createTempConfigDir();
  });

  afterEach(() => {
    if (server?.proc) {
      server.proc.kill();
    }
    cleanupTempConfigDir(tempDir);
  });

  it('rejects unknown environment with 400 and accepted list', async () => {
    expect.hasAssertions();
    server = startServer(tempDir);
    await waitForServer(server.port);
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
    server = startServer(tempDir);
    await waitForServer(server.port);
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
    server = startServer(tempDir, { JUMENTIX_SERVICE_MANAGEMENT_AUTH_TOKEN: 'secret' });
    await waitForServer(server.port);
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
    server = startServer(tempDir, { JUMENTIX_SERVICE_MANAGEMENT_AUTH_TOKEN: 'secret' });
    await waitForServer(server.port);
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
    server = startServer(tempDir, { JUMENTIX_SERVICE_MANAGEMENT_AUTH_TOKEN: 'secret' });
    await waitForServer(server.port);
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
    server = startServer(tempDir, { JUMENTIX_SERVICE_MANAGEMENT_AUTH_TOKEN: 'secret' });
    await waitForServer(server.port);
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
    proc.stderr?.on('data', (chunk) => {
      stderr += chunk;
    });
    await new Promise<void>((resolve) => {
      proc.on('exit', (code) => {
        expect(code).toBe(1);
        expect(stderr).toContain('config directory not found');
        resolve();
      });
    });
  });

  it('exposes editable and read-only tiers on GET but never secrets', async () => {
    expect.hasAssertions();
    server = startServer(tempDir);
    await waitForServer(server.port);
    const res = await requestJson<RuntimeEnvPayload>(server.port, 'GET', '/api/runtime/env?environment=dev');
    expect(res.status).toBe(200);
    expect(res.body.values.JUMENTIX_DATABASE_DRIVER).toBe('InMemory');
    expect(res.body.values.JUMENTIX_MESSAGE_MEDIATOR_ADAPTER).toBe('rabbitmq');
    expect(res.body.values.JUMENTIX_REDIS_HOST).toBe('127.0.0.1');
    expect(res.body.values.JUMENTIX_CORS_ALLOWED_ORIGINS).toBe('http://localhost:3000');
    expect(res.body.values).not.toHaveProperty('JUMENTIX_JWT_TOKEN_SECRET_KEY');
    expect(res.body.values).not.toHaveProperty('JUMENTIX_REDIS_PASSWORD');
    expect(res.body.values).not.toHaveProperty('JUMENTIX_RABBITMQ_URL');
    expect(res.body.editableKeys).toStrictEqual(
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
    expect(res.body.editableKeys).not.toContain('JUMENTIX_REDIS_HOST');
    expect(res.body.editableKeys).not.toContain('JUMENTIX_REDIS_PASSWORD');
  });

  it('ignores read-only and never-exposed keys on POST', async () => {
    expect.hasAssertions();
    server = startServer(tempDir);
    await waitForServer(server.port);
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
    server = startServer(tempDir);
    await waitForServer(server.port);
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
    server = startServer(tempDir);
    await waitForServer(server.port);
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
    server = startServer(tempDir);
    await waitForServer(server.port);
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
