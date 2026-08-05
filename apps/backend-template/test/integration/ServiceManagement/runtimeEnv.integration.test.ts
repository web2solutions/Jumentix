/* eslint-disable jest/prefer-expect-assertions, jest/no-conditional-in-test */
import { spawn } from 'node:child_process';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';

const serverPath = path.resolve(process.cwd(), 'apps/service-management/server.js');

type RuntimeEnvPayload = {
  environment: string;
  fileName: string;
  values: Record<string, string>;
};

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
});
