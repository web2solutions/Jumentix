#!/usr/bin/env bun
/**
 * JUM-396 — start the production website, run Cypress, tear down.
 *
 * Uses Bun for process orchestration. Cypress itself is the browser runner
 * (Req: no Playwright for the website app). ELECTRON_RUN_AS_NODE is scrubbed
 * so Cypress does not inherit a Node-as-Electron misconfiguration from CI.
 */
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const websiteRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(websiteRoot, '../..');
const sitePort = Number(process.env.JUMENTIX_WEBSITE_PORT ?? '3010');
const baseUrl = process.env.JUMENTIX_WEBSITE_BASE_URL || `http://127.0.0.1:${sitePort}`;
const bunCommand = process.platform === 'win32' ? 'bun.exe' : 'bun';
const browser = process.env.JUMENTIX_WEBSITE_CYPRESS_BROWSER || 'chrome';

const run = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd: options.cwd || websiteRoot,
      env: options.env || process.env
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} failed with code ${code}`));
    });
  });

const waitForServer = async () => {
  const deadline = Date.now() + 90_000;
  let lastError = 'not started';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl, {
        signal: AbortSignal.timeout(5_000),
        headers: { Accept: 'text/html' }
      });
      if (response.ok) return;
      lastError = `status ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(1000);
  }
  throw new Error(`Website not ready at ${baseUrl}: ${lastError}`);
};

const cypressEnv = () => {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  env.JUMENTIX_WEBSITE_BASE_URL = baseUrl;
  return env;
};

const main = async () => {
  const skipBuild = process.env.JUMENTIX_WEBSITE_CYPRESS_SKIP_BUILD === '1';
  if (!skipBuild) {
    await run(bunCommand, ['run', 'build']);
  }

  const server = spawn(bunCommand, ['run', 'start'], {
    stdio: 'inherit',
    cwd: websiteRoot,
    env: { ...process.env, PORT: String(sitePort) }
  });

  let exitCode = 0;
  try {
    await waitForServer();
    await run(
      path.join(repoRoot, 'node_modules', '.bin', 'cypress'),
      [
        'run',
        '--project',
        websiteRoot,
        '--config-file',
        'cypress.config.cjs',
        '--spec',
        'cypress/e2e/**/*.cy.js',
        '--browser',
        browser,
        '--e2e'
      ],
      { cwd: websiteRoot, env: cypressEnv() }
    );
  } catch (error) {
    exitCode = 1;
    console.error('[website cypress]', error instanceof Error ? error.message : error);
  } finally {
    server.kill('SIGTERM');
    await delay(1500);
    if (!server.killed) server.kill('SIGKILL');
  }

  process.exit(exitCode);
};

main();
