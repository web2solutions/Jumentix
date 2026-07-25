import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const sitePort = Number(process.env.JUMENTIX_WEBSITE_PORT ?? '3010');
const baseUrl = `http://127.0.0.1:${sitePort}`;
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const runCommand = (command, args, extraEnv = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: { ...process.env, ...extraEnv }
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} failed with code ${code}`));
    });
  });

const startServer = () =>
  spawn(npmCommand, ['run', 'start'], {
    stdio: 'inherit',
    env: { ...process.env, PORT: String(sitePort) }
  });

const assertRoute = async ({
  path,
  expectedStatus = 200,
  includes = [],
  excludes = [],
  headers = {}
}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    signal: AbortSignal.timeout(15_000),
    headers: { Accept: 'text/html,application/json', ...headers }
  });

  if (response.status !== expectedStatus) {
    throw new Error(`Route ${path} expected ${expectedStatus}, received ${response.status}`);
  }

  const body = await response.text();

  for (const content of includes) {
    if (!body.includes(content)) {
      throw new Error(`Route ${path} did not include expected content: ${content}`);
    }
  }

  for (const content of excludes) {
    if (body.includes(content)) {
      throw new Error(`Route ${path} included forbidden content: ${content}`);
    }
  }
};

const waitForServer = async () => {
  const deadline = Date.now() + 90_000;
  const errors = [];

  while (Date.now() < deadline) {
    try {
      await assertRoute({
        path: '/',
        expectedStatus: 200,
        includes: ['Jumentix']
      });
      return;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      await delay(1000);
    }
  }

  throw new Error(`Website did not become ready on ${baseUrl}. Last errors: ${errors.slice(-3).join(' | ')}`);
};

const smokeRoutes = async () => {
  const invalidMarkers = [
    'Missing ConfigContext.Provider',
    'Cannot find module',
    'Element type is invalid',
    'Internal Server Error'
  ];

  await assertRoute({ path: '/', includes: ['Jumentix'], excludes: invalidMarkers });
  await assertRoute({ path: '/product', includes: ['Jumentix Product Capabilities'], excludes: invalidMarkers });
  await assertRoute({ path: '/changelog?page=1', includes: ['Jumentix Changelog'], excludes: invalidMarkers });
  await assertRoute({ path: '/docs/jumentix', includes: ['Jumentix'], excludes: invalidMarkers });
  await assertRoute({ path: '/docs/overview', excludes: invalidMarkers });
  await assertRoute({ path: '/docs/realtime-api-guide', excludes: invalidMarkers });
  await assertRoute({ path: '/api/version', expectedStatus: 200 });
  await assertRoute({
    path: '/api/github-releases',
    expectedStatus: 403,
    headers: { 'user-agent': 'googlebot' }
  });
};

const run = async () => {
  await runCommand(npmCommand, ['run', 'typecheck']);
  await runCommand(npmCommand, ['run', 'build']);

  const serverProcess = startServer();

  try {
    await waitForServer();
    await smokeRoutes();
  } finally {
    serverProcess.kill('SIGTERM');
    await delay(1500);
    if (!serverProcess.killed) {
      serverProcess.kill('SIGKILL');
    }
  }
};

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[website prepublish checks] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
