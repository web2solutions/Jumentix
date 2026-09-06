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
  /** Keys the endpoint admits for editing; absent keys are read-only by policy. */
  editableKeys?: string[];
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
    // Live reload is a development affordance and not what any of these
    // suites exercise (JUM-747). Left on, its client opens an EventSource the
    // offline suites then watch fail, and its file watcher would reload the
    // page under a test that is mid-interaction. A suite that wants it can
    // turn it back on through `envOverrides`.
    JUMENTIX_SERVICE_MANAGEMENT_LIVE_RELOAD: '0',
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

function loopbackPortAcceptsConnection(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${String(port)}/`, () => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(250, () => {
      req.destroy();
      resolve(false);
    });
  });
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
    server.proc.on('exit', async (code, signal) => {
      const stderr = server.stderr();
      if (stderr.includes('EADDRINUSE')) {
        const error: NodeJS.ErrnoException = new Error(
          `port ${String(server.port)} is already in use (EADDRINUSE)`
        );
        error.code = 'EADDRINUSE';
        finish(error);
        return;
      }
      if (await loopbackPortAcceptsConnection(server.port)) {
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

/**
 * Open the Domain Designer's panel drawer (JUM-737).
 *
 * The panels used to be a permanent column; they are now an overlay that the
 * canvas gets back when it is closed, and closed is the default. Every suite
 * that reaches for a sidebar control — the export buttons, the domain and
 * entity forms, the model check — has to open it first, the same way a person
 * does.
 *
 * Idempotent, and it waits for the drawer to actually be open: the drawer
 * animates, and clicking a control mid-transition is the kind of flake that
 * only shows up on a loaded CI runner.
 */
/** The slice of a Playwright page these helpers drive. */
type DrawerPage = {
  click: (target: string) => Promise<void>;
  waitForSelector: (target: string, options?: Record<string, unknown>) => Promise<unknown>;
  $: (target: string) => Promise<unknown>;
  evaluate: <T>(fn: (target: string) => T, arg: string) => Promise<T>;
};

export async function openDesignerPanels(
  page: DrawerPage,
  target?: string
): Promise<void> {
  // Wait for the app to finish booting before touching the drawer: the state
  // load is async and re-renders the view when it lands, so a click between
  // `load` and that render is undone — a window a person cannot hit and an
  // automated click hits every time.
  await page.waitForSelector('body[data-designer-ready="true"]');

  /** Open the drawer and select the group holding `target`, once. */
  const reveal = async (): Promise<string> => page.evaluate((selector) => {
    // The drawer lives inside the Domain Designer tab section, and an
    // inactive section is `display: none` — its contents then have no box at
    // all, so a control can be "not hidden" and still unclickable. Bring the
    // tab forward first.
    const designerSection = document.getElementById('tab-domain-designer');
    if (designerSection && !designerSection.classList.contains('active')) {
      (document.getElementById('tab-domain-designer-btn') as HTMLElement | null)?.click();
    }

    const drawer = document.getElementById('designer-sidebar');
    const toggle = document.getElementById('toggle-sidebar-btn');
    if (drawer && !drawer.classList.contains('open')) toggle?.click();

    const element = selector ? document.querySelector(selector) : null;
    const panel = element?.closest('[data-sidebar-group]') as HTMLElement | null;
    const group = panel?.dataset.sidebarGroup;
    if (group) {
      const tab = document.querySelector(`[data-sidebar-tab="${group}"]`) as HTMLElement | null;
      if (tab?.getAttribute('aria-selected') !== 'true') tab?.click();
    }

    const designerActive = Boolean(designerSection?.classList.contains('active'));
    // The box is the only thing that decides clickability: an element can be
    // in an unhidden panel and still have no area, which is what every
    // "resolved the locator, element is not visible" timeout comes down to.
    const rect = (element as HTMLElement | null)?.getBoundingClientRect();
    const hasArea = Boolean(rect && rect.width > 0 && rect.height > 0);
    const chain: string[] = [];
    for (let node = element as HTMLElement | null; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') {
        chain.push(`${node.tagName}#${node.id || ''}.${node.className || ''}:${style.display}/${style.visibility}`);
      }
      if (node === document.body) break;
    }
    const reachable = hasArea
      && designerActive
      && Boolean(element)
      && panel?.hidden === false
      && Boolean(drawer?.classList.contains('open'));
    return JSON.stringify({
      reachable: selector
        ? reachable
        : designerActive && Boolean(drawer?.classList.contains('open')),
      designerActive,
      hasArea,
      hiddenAncestors: chain.slice(0, 4),
      found: Boolean(element),
      panelGroup: group ?? null,
      panelHidden: panel?.hidden ?? null,
      drawerOpen: drawer?.classList.contains('open') ?? null,
      activeTab: document.querySelector('.sidebar-tab.active')?.getAttribute('data-sidebar-tab')
        ?? null
    });
  }, target || '');

  // Retried rather than done once: a save result landing after the click
  // re-renders the view from the stored payload, which can still be the one
  // written before the group changed, and reverts it. Driving the DOM through
  // one evaluate keeps each attempt atomic.
  let last = '';
  /* eslint-disable no-await-in-loop -- each attempt must observe the result of
     the previous one; that is the point of the retry. */
  for (let attempt = 0; attempt < 20; attempt += 1) {
    last = await reveal() as string;
    if (JSON.parse(last).reachable) {
      // Held for two frames: a revert that arrives immediately after would
      // otherwise be handed to the caller as success.
      await new Promise((resolve) => { setTimeout(resolve, 120); });
      last = await reveal() as string;
      if (JSON.parse(last).reachable) return;
    }
    await new Promise((resolve) => { setTimeout(resolve, 150); });
  }
  /* eslint-enable no-await-in-loop */

  throw new Error(`openDesignerPanels could not reveal ${target ?? 'the drawer'}: ${last}`);
}

/**
 * Click a control inside the panel drawer.
 *
 * `page.click` waits for its own actionability model to agree the element is
 * clickable, and inside an overlay that animates on `transform` and
 * `visibility` it can keep reporting "element is not visible" for a control
 * that the page itself reports as visible, with a real box, in an open drawer.
 * The reachability that matters is asserted by `openDesignerPanels` — drawer
 * open, panel not hidden, non-empty box, designer tab active — so the click
 * itself is dispatched in the page.
 */
export async function clickInPanels(
  page: DrawerPage,
  selector: string
): Promise<void> {
  await openDesignerPanels(page, selector);
  const clicked = await page.evaluate((wanted) => {
    const element = document.querySelector(wanted) as HTMLElement | null;
    element?.click();
    return Boolean(element);
  }, selector);
  if (!clicked) throw new Error(`clickInPanels found no element for ${selector}`);
}
