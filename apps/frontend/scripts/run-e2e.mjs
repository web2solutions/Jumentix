/**
 * Frontend e2e runner (JUM-776, Requirement 118).
 *
 * 1. `docker compose up --wait` the real REST API (e2e/docker-compose.yml);
 * 2. start Vite with `/api` proxied to the container;
 * 3. `cypress run` against it;
 * 4. tear everything down and exit with Cypress' status.
 *
 * Fails closed: no Docker, an unhealthy container, or a Vite that never
 * listens all exit non-zero. A skipped e2e is not a green one (Req 065/118).
 */
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const composeFile = path.join(appRoot, 'e2e', 'docker-compose.yml');
const backendPort = process.env.FRONTEND_E2E_BACKEND_PORT ?? '3130';
const frontendPort = process.env.FRONTEND_E2E_PORT ?? '3131';
// Cypress' bundled Electron segfaults (exit 139) on macOS while typing into
// the password / datalist inputs of this app; headless Chrome does not. Chrome
// is the default and the browser is overridable for CI images without it.
const browser = process.env.FRONTEND_E2E_BROWSER ?? 'chrome';
const env = { ...process.env, FRONTEND_E2E_BACKEND_PORT: backendPort, FRONTEND_E2E_PORT: frontendPort };
const compose = ['compose', '-f', composeFile];

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { stdio: 'inherit', env, cwd: appRoot, ...options });
  if (result.error) throw result.error;
  return result.status ?? 1;
};

const waitFor = async (url, attempts = 60) => {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${url}`);
};

let vite;
let status = 1;
try {
  if (run('docker', ['version'], { stdio: 'ignore' }) !== 0) {
    throw new Error('Docker is not available; the e2e suite requires the containerised backend (Requirement 118).');
  }
  if (run('docker', [...compose, 'up', '-d', '--build', '--wait']) !== 0) {
    throw new Error('The e2e backend container did not become healthy.');
  }
  await waitFor(`http://127.0.0.1:${backendPort}/`);

  // `--host 127.0.0.1` so the address Cypress and the health probe use is the
  // one Vite binds (a bare `localhost` may resolve to ::1 on this host).
  vite = spawn('bun', ['run', 'dev', '--', '--host', '127.0.0.1'], {
    cwd: appRoot,
    stdio: 'inherit',
    env: { ...env, VITE_DEV_PORT: frontendPort, VITE_API_PROXY_TARGET: `http://127.0.0.1:${backendPort}` }
  });
  await waitFor(`http://127.0.0.1:${frontendPort}/`);

  status = run('bunx', ['cypress', 'run', '--browser', browser, '--config', `baseUrl=http://127.0.0.1:${frontendPort}`, ...process.argv.slice(2)]);
} catch (error) {
  console.error(`[frontend e2e] ${error instanceof Error ? error.message : String(error)}`);
  status = 1;
} finally {
  if (vite) vite.kill('SIGTERM');
  run('docker', [...compose, 'down', '--remove-orphans'], { stdio: 'ignore' });
}
process.exit(status);
