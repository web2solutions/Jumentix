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

/**
 * JUM-628 — port allocation used to be a single `3200 + random*1000` shot:
 * under parallel agent sessions or stale `server.js` processes the port
 * collided, the child died on EADDRINUSE, and `waitForServer` burned 20-120s
 * of timeouts before the suite failed (the recurring 2026-08-05..08 flake).
 * The port must be known BEFORE listen (server.js reads it from
 * `JUMENTIX_SERVICE_MANAGEMENT_PORT`), so OS-assigned port 0 is not an option —
 * the harness retries with a fresh random port, bounded by
 * `DEFAULT_PORT_ATTEMPTS`. The range follows JUM-635's wider
 * `20000 + random*30000` window; retry handles the residual collisions that
 * a wider range alone cannot.
 */
export const DEFAULT_PORT_ATTEMPTS = 10;

/** How long one boot attempt may take before it counts as failed. */
const LISTEN_TIMEOUT_MS = 15000;

export function allocatePort(): number {
  return 20000 + Math.floor(Math.random() * 30000);
}

export function isAddrInUseError(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === 'EADDRINUSE';
}

export type PortRetryOptions<T> = {
  /**
   * Forced port. Pinned origins (offline matrix cells restarting a server on
   * the SAME origin for IDB/SW) cannot move to another port, so a busy pinned
   * port fails immediately with a clear error instead of retrying.
   */
  pinnedPort?: number;
  maxAttempts?: number;
  pickPort?: () => number;
  /** One bind attempt; rejects with an EADDRINUSE-coded error when the port is busy. */
  attempt: (port: number) => Promise<T>;
  /** Called before each retry — the harness logs here so flakes are diagnosable. */
  onRetry?: (event: {
    port: number;
    attempt: number;
    maxAttempts: number;
  }) => void;
};

/**
 * Runs `attempt(port)` until it succeeds, retrying with a fresh random port on
 * EADDRINUSE. Any other failure propagates immediately; exhausting the
 * attempts raises an error that says so (and names the last busy port) instead
 * of surfacing as a generic 'server did not start' timeout.
 */
export async function runWithPortRetry<T>(options: PortRetryOptions<T>): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_PORT_ATTEMPTS;
  const pickPort = options.pickPort ?? allocatePort;
  let lastBusyPort: number | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const port = options.pinnedPort ?? pickPort();
    try {
      // eslint-disable-next-line no-await-in-loop
      return await options.attempt(port);
    } catch (error) {
      if (!isAddrInUseError(error)) {
        throw error;
      }
      lastBusyPort = port;
      if (options.pinnedPort !== undefined) {
        throw new Error(
          `[serverHarness] pinned port ${String(port)} is already in use (EADDRINUSE); `
            + 'a pinned origin cannot move — free the stale process holding it and re-run.'
        );
      }
      if (attempt < maxAttempts) {
        options.onRetry?.({ port, attempt, maxAttempts });
      }
    }
  }
  throw new Error(
    `[serverHarness] no free port after ${String(maxAttempts)} attempts `
      + `(last busy port ${String(lastBusyPort)}); stale server.js processes are `
      + 'likely holding the range — kill them and re-run.'
  );
}

type SpawnedServer = StartedServer & { stdout: () => string };

function spawnServerProcess(
  configDir: string | null,
  envOverrides: Record<string, string>,
  port: number
): SpawnedServer {
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
  let capturedStdout = '';
  let capturedStderr = '';
  const proc = spawn('node', [serverPath], {
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  proc.stdout?.on('data', (chunk) => {
    capturedStdout += chunk;
  });
  proc.stderr?.on('data', (chunk) => {
    capturedStderr += chunk;
  });
  return {
    proc,
    port,
    stdout: () => capturedStdout,
    stderr: () => capturedStderr
  };
}

/**
 * Settles one boot attempt: resolves once THIS child reports its listen line
 * (a probe would be answered just as happily by the stale server we are
 * trying to avoid), rejects with an EADDRINUSE-coded error when the child dies
 * on a busy port, and rejects plainly on any other early exit or timeout.
 */
function waitForListening(server: SpawnedServer): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };
    timer = setTimeout(() => {
      finish(
        new Error(
          `[serverHarness] server on port ${String(server.port)} printed no listen line `
            + `within ${String(LISTEN_TIMEOUT_MS)}ms; stderr so far:\n${server.stderr()}`
        )
      );
    }, LISTEN_TIMEOUT_MS);
    server.proc.on('exit', (code, signal) => {
      const stderr = server.stderr();
      if (stderr.includes('EADDRINUSE')) {
        const error: NodeJS.ErrnoException = new Error(
          `port ${String(server.port)} is already in use (EADDRINUSE)`
        );
        error.code = 'EADDRINUSE';
        finish(error);
        return;
      }
      finish(
        new Error(
          `[serverHarness] server on port ${String(server.port)} exited before listening `
            + `(code ${String(code)}, signal ${String(signal)}); stderr:\n${stderr}`
        )
      );
    });
    server.proc.on('error', (error) => {
      finish(error);
    });
    server.proc.stdout?.on('data', () => {
      if (server.stdout().includes('Service Management listening on http://')) {
        finish();
      }
    });
  });
}

export function stopServer(server: StartedServer | undefined) {
  if (server?.proc) {
    server.proc.kill();
  }
}

export async function startServer(
  configDir: string | null,
  envOverrides: Record<string, string> = {},
  options: { pinnedPort?: number; maxAttempts?: number } = {}
): Promise<StartedServer> {
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
  return runWithPortRetry({
    pinnedPort: options.pinnedPort,
    maxAttempts: options.maxAttempts,
    onRetry: ({ port, attempt, maxAttempts }) => {
      // eslint-disable-next-line no-console
      console.warn(
        `[serverHarness] port ${String(port)} busy (EADDRINUSE); `
          + `retrying with a fresh port (attempt ${String(attempt)}/${String(maxAttempts)})`
      );
    },
    attempt: async (port) => {
      const server = spawnServerProcess(configDir, envOverrides, port);
      try {
        await waitForListening(server);
      } catch (error) {
        stopServer(server);
        throw error;
      }
      return server;
    }
  });
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
