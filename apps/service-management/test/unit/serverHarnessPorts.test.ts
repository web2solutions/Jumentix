/* eslint-disable import/no-relative-packages */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects, jest/no-conditional-in-test */
/*
 * JUM-628 — unit contract for the ServiceManagement harness port allocator
 * (`runWithPortRetry`): bounded retry with a fresh random port on EADDRINUSE,
 * a clear error once the attempts are exhausted, no retry for non-bind
 * failures, and no port movement for pinned origins.
 *
 * Importing the harness pulls the WHOLE file into the coverage report (before
 * this suite only the integration runner imported it, and `test:coverage`
 * never loads those), so the second describe below exercises the runtime
 * helpers for real — a genuinely spawned `server.js`, a genuinely occupied
 * port, a genuine connection refusal — exactly as Requirement 115 demands.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {
  DEFAULT_PORT_ATTEMPTS,
  allocatePort,
  cleanupTempConfigDir,
  createTempConfigDir,
  envFileContent,
  firstNonLoopbackAddress,
  isAddrInUseError,
  probeConnection,
  requestJson,
  requestRaw,
  runWithPortRetry,
  startServer,
  stopServer,
  waitForServer
} from '../../../backend-template/test/integration/ServiceManagement/serverHarness';
import type { StartedServer } from '../../../backend-template/test/integration/ServiceManagement/serverHarness';

function addrInUse(port: number): NodeJS.ErrnoException {
  const error: NodeJS.ErrnoException = new Error(
    `port ${String(port)} is already in use (EADDRINUSE)`
  );
  error.code = 'EADDRINUSE';
  return error;
}

describe('serverHarness port allocation (JUM-628)', () => {
  it('retries with a fresh port on EADDRINUSE and succeeds within the bound', async () => {
    expect.hasAssertions();
    const candidates = [3301, 3302, 3303];
    const triedPorts: number[] = [];
    const retries: Array<{ port: number; attempt: number; maxAttempts: number }> = [];

    const result = await runWithPortRetry({
      pickPort: () => candidates[triedPorts.length],
      attempt: (port) => {
        triedPorts.push(port);
        if (triedPorts.length < 3) {
          return Promise.reject(addrInUse(port));
        }
        return Promise.resolve(`ready:${String(port)}`);
      },
      onRetry: (event) => retries.push(event)
    });

    expect(result).toBe('ready:3303');
    // Every retry must have moved to a DIFFERENT port — re-trying the busy
    // one would be the single-shot bug all over again.
    expect(triedPorts).toStrictEqual([3301, 3302, 3303]);
    // The retry is logged (the harness wires this to console.warn).
    expect(retries).toStrictEqual([
      { port: 3301, attempt: 1, maxAttempts: DEFAULT_PORT_ATTEMPTS },
      { port: 3302, attempt: 2, maxAttempts: DEFAULT_PORT_ATTEMPTS }
    ]);
  });

  it('fails with a clear error once the bounded attempts are exhausted', async () => {
    expect.hasAssertions();
    let attempts = 0;

    await expect(
      runWithPortRetry({
        maxAttempts: 3,
        pickPort: () => 4400 + attempts,
        attempt: (port) => {
          attempts += 1;
          return Promise.reject(addrInUse(port));
        }
      })
    ).rejects.toThrow('no free port after 3 attempts');
    await expect(
      runWithPortRetry({
        maxAttempts: 3,
        pickPort: () => 4500,
        attempt: (port) => Promise.reject(addrInUse(port))
      })
    ).rejects.toThrow('last busy port 4500');
    expect(attempts).toBe(3);
  });

  it('propagates a non-EADDRINUSE failure immediately, without retrying', async () => {
    expect.hasAssertions();
    let attempts = 0;

    await expect(
      runWithPortRetry({
        pickPort: () => 4600,
        attempt: () => {
          attempts += 1;
          return Promise.reject(new Error('config dir unreadable'));
        }
      })
    ).rejects.toThrow('config dir unreadable');
    expect(attempts).toBe(1);
  });

  it('never moves a pinned port: a busy pin fails fast and names the port', async () => {
    expect.hasAssertions();
    let pickCalls = 0;

    await expect(
      runWithPortRetry({
        pinnedPort: 4777,
        pickPort: () => {
          pickCalls += 1;
          return 4700;
        },
        attempt: (port) => Promise.reject(addrInUse(port))
      })
    ).rejects.toThrow('pinned port 4777 is already in use');
    // The pinned contract forbids drawing a different port at all.
    expect(pickCalls).toBe(0);
  });

  it('recognises only EADDRINUSE-coded errors as port collisions', () => {
    expect.hasAssertions();
    expect(isAddrInUseError(addrInUse(3200))).toBe(true);
    expect(isAddrInUseError(new Error('boom'))).toBe(false);
    expect(isAddrInUseError(undefined)).toBe(false);
    expect(isAddrInUseError(null)).toBe(false);
  });
});

describe('serverHarness runtime helpers against the real server (JUM-628)', () => {
  it('creates a real temp config dir with the pinned env content, and cleans it up', () => {
    expect.hasAssertions();
    const dir = createTempConfigDir({ '.env.dev': envFileContent('fastify') });
    try {
      expect(fs.readFileSync(path.join(dir, '.env.dev'), 'utf-8'))
        .toContain('JUMENTIX_HTTP_FRAMEWORK=fastify');
    } finally {
      cleanupTempConfigDir(dir);
    }
    expect(fs.existsSync(dir)).toBe(false);
  });

  it('allocates ports inside the JUM-635 20000-49999 range', () => {
    expect.hasAssertions();
    for (let i = 0; i < 50; i += 1) {
      const port = allocatePort();
      expect(port).toBeGreaterThanOrEqual(20000);
      expect(port).toBeLessThan(50000);
    }
  });

  it('boots the real server, serves the runtime env endpoint, probes connected and stops', async () => {
    expect.hasAssertions();
    const dir = createTempConfigDir({ '.env.dev': envFileContent('express') });
    let server: StartedServer | undefined;
    try {
      server = await startServer(dir);
      await waitForServer(server.port);
      const env = await requestJson<{ environment: string }>(
        server.port,
        'GET',
        '/api/runtime/env?environment=dev'
      );
      expect(env.status).toBe(200);
      const raw = await requestRaw(server.port, 'GET', '/api/runtime/env?environment=dev');
      expect(raw.status).toBe(200);
      expect(raw.rawBody).toContain('"environment"');
      // A request carrying a body exercises the write path of requestRaw; an
      // empty values patch is a no-op save against the temp config directory.
      const posted = await requestRaw(
        server.port,
        'POST',
        '/api/runtime/env',
        JSON.stringify({ environment: 'dev', values: {} })
      );
      expect(posted.status).toBe(200);
      await expect(probeConnection('127.0.0.1', server.port)).resolves.toBe('connected');
      // The machine may or may not expose a non-loopback address; both are
      // honest answers — the contract is the shape, not the value.
      const address = firstNonLoopbackAddress();
      expect(address === null || typeof address === 'string').toBe(true);
    } finally {
      stopServer(server);
      cleanupTempConfigDir(dir);
    }
  }, 30000);

  it('reports a genuine connection refusal on a port nothing listens on', async () => {
    expect.hasAssertions();
    // Bind a real listener, learn its port, close it: the port is then
    // guaranteed free, so the refusal below is real, not emulated.
    const blocker = http.createServer();
    const freePort = await new Promise<number>((resolve, reject) => {
      blocker.listen(0, '127.0.0.1', () => {
        const address = blocker.address();
        blocker.close(() => {
          if (address && typeof address === 'object') resolve(address.port);
          else reject(new Error('no address'));
        });
      });
    });
    await expect(probeConnection('127.0.0.1', freePort)).resolves.toBe('refused');
    // waitForServer against the same dead port burns its one retry and then
    // reports the honest failure — both the retry and the reject paths.
    await expect(waitForServer(freePort, 1)).rejects.toThrow('server did not start');
  }, 30000);

  it('boots against the pinned default config dir when none is injected', async () => {
    expect.hasAssertions();
    // startServer(null) exercises the Requirement 126 §2 default resolution
    // branch (no JUMENTIX_SERVICE_MANAGEMENT_CONFIG_DIR in the child env).
    let server: StartedServer | undefined;
    try {
      server = await startServer(null);
      await waitForServer(server.port);
      await expect(probeConnection('127.0.0.1', server.port)).resolves.toBe('connected');
    } finally {
      stopServer(server);
    }
  }, 30000);

  it('a busy pinned port dies on the real EADDRINUSE exit and fails fast, naming the port', async () => {
    expect.hasAssertions();
    const blocker = http.createServer();
    const busyPort = await new Promise<number>((resolve, reject) => {
      blocker.listen(0, '127.0.0.1', () => {
        const address = blocker.address();
        if (address && typeof address === 'object') resolve(address.port);
        else reject(new Error('no address'));
      });
    });
    const dir = createTempConfigDir({ '.env.dev': envFileContent('express') });
    try {
      await expect(startServer(dir, {}, { pinnedPort: busyPort }))
        .rejects.toThrow(`pinned port ${String(busyPort)} is already in use`);
    } finally {
      cleanupTempConfigDir(dir);
      await new Promise<void>((resolve) => { blocker.close(() => resolve()); });
    }
  }, 30000);
});
