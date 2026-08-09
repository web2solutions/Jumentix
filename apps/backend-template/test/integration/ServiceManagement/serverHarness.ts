/*
 * Shared harness for the ServiceManagement integration smoke (JUM-466).
 *
 * Every suite here boots the REAL `apps/service-management/server.js` on an
 * ephemeral loopback port against a REAL temporary config directory — no fakes,
 * per Requirement 115. Helpers are shared so each contract suite stays focused
 * on assertions rather than process plumbing.
 */
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { syncServiceManagementDesignerCore } = require(
  path.resolve(process.cwd(), 'ci-cd', 'sync-service-management-designer-core.js')
) as { syncServiceManagementDesignerCore: (options: { root: string }) => number };

export const serverPath = path.resolve(process.cwd(), 'apps/service-management/server.js');
export const staticRoot = path.resolve(process.cwd(), 'apps/service-management');
// Pinned by Requirement 126 §2: the runtime env files live here. A future
// re-homing that moves them must fail the smoke, not silently serve defaults.
export const pinnedDefaultConfigDir = path.resolve(
  process.cwd(),
  'apps/backend-template/src/config'
);

export type RuntimeEnvPayload = {
  environment: string;
  fileName: string;
  values: Record<string, string>;
};

export type StartedServer = {
  proc: ChildProcess;
  port: number;
  stderr: () => string;
};

export const EDITABLE_FRAMEWORK_VALUES = [
  'express',
  'fastify',
  'restify',
  'cloudflare-workers',
  'vercel-functions',
  'loopback',
  'sails-js',
  'feathers',
  'derby-js',
  'adonis-js',
  'total-js'
];

/**
 * Creates a temp config directory. `files` maps file name to full content;
 * callers pick per-file marker values so a test can prove WHICH file a request
 * reached instead of trusting the response's self-report.
 */
export function createTempConfigDir(files: Record<string, string>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jumentix-service-management-'));
  Object.entries(files).forEach(([fileName, content]) => {
    fs.writeFileSync(path.join(dir, fileName), content, 'utf8');
  });
  return dir;
}

export function envFileContent(framework: string) {
  return [
    `JUMENTIX_HTTP_FRAMEWORK=${framework}`,
    'JUMENTIX_REALTIME_API=no',
    'JUMENTIX_REALTIME_API_PROTOCOL=websocket',
    'JUMENTIX_REALTIME_API_DATABASE_DRIVER=Mongo',
    ''
  ].join('\n');
}

export function cleanupTempConfigDir(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

export function startServer(
  configDir: string | null,
  envOverrides: Record<string, string> = {}
): StartedServer {
  // The SPA statically imports the designer core through the import map's
  // `@jumentix/designer-core/` prefix (JUM-493), which resolves to the
  // vendored, gitignored module tree. Booting without it is a module-load
  // failure, so the harness regenerates the tree for every boot — one sync
  // point, impossible for a suite to forget. It is a verbatim file copy from
  // the canonical `packages/designer-core/src/` (nothing to compile, unlike
  // the Cana bundle), cheap enough to run per server start.
  const syncResult = syncServiceManagementDesignerCore({ root: process.cwd() });
  if (syncResult !== 0) {
    throw new Error('designer-core vendor sync failed; the SPA cannot boot without it.');
  }
  const port = 3200 + Math.floor(Math.random() * 1000);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...envOverrides,
    JUMENTIX_SERVICE_MANAGEMENT_PORT: String(port)
  };
  if (configDir) {
    env.JUMENTIX_SERVICE_MANAGEMENT_CONFIG_DIR = configDir;
  } else {
    // Exercise the pinned default resolution from Requirement 126 §2.
    delete env.JUMENTIX_SERVICE_MANAGEMENT_CONFIG_DIR;
  }
  let capturedStderr = '';
  const proc = spawn('node', [serverPath], {
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  proc.stderr?.on('data', (chunk) => {
    capturedStderr += chunk;
  });
  return { proc, port, stderr: () => capturedStderr };
}

export function stopServer(server: StartedServer | undefined) {
  if (server?.proc) {
    server.proc.kill();
  }
}

export function waitForServer(port: number, maxAttempts = 50): Promise<void> {
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

export type RawResponse = {
  status: number;
  headers: http.IncomingHttpHeaders;
  rawBody: string;
};

/**
 * Low-level request that never pre-parses the body and sends `path` verbatim —
 * required for the path-traversal assertions, where a normalizing client would
 * hide the very attack being tested. `rawBody` allows deliberately malformed
 * JSON for the error-contract assertions.
 */
export function requestRaw(
  port: number,
  method: string,
  pathname: string,
  rawBody?: string,
  headers: Record<string, string> = {}
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const payload = rawBody || '';
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
          resolve({ status: res.statusCode || 0, headers: res.headers, rawBody: raw });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

export async function requestJson<T>(
  port: number,
  method: string,
  pathname: string,
  body?: unknown,
  headers: Record<string, string> = {}
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: T }> {
  const res = await requestRaw(
    port,
    method,
    pathname,
    body === undefined ? undefined : JSON.stringify(body),
    headers
  );
  return {
    status: res.status,
    headers: res.headers,
    body: (res.rawBody ? JSON.parse(res.rawBody) : {}) as T
  };
}

/** First non-loopback IPv4 address of this machine, if any. */
export function firstNonLoopbackAddress(): string | null {
  const candidates = Object.values(os.networkInterfaces())
    .flat()
    .filter((entry): entry is os.NetworkInterfaceInfo => Boolean(entry));
  const external = candidates.find((entry) => entry.family === 'IPv4' && !entry.internal);
  return external ? external.address : null;
}

export type ProbeResult = 'connected' | 'refused';

/** Attempts a TCP/HTTP connection; 'refused' means nothing listened for us. */
export function probeConnection(
  address: string,
  port: number,
  timeoutMs = 2000
): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const req = http.get(`http://${address}:${port}/`, () => {
      resolve('connected');
    });
    req.on('error', () => resolve('refused'));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve('refused');
    });
  });
}
