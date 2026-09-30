/* eslint-disable no-console */
/**
 * Launcher for the repository-level entry point (`bin/jumentix-bootstrap.js`,
 * reached through `bun x github:web2solutions/Jumentix#dev`) — JUM-901.
 *
 * A git-sourced install gets the repository without any build output:
 * `packages/cli-init/dist` is gitignored and nothing builds it on install, so
 * requiring it crashed with MODULE_NOT_FOUND. The launcher runs the local build
 * only when it and every runtime dependency resolve; otherwise it delegates to
 * the published `@jumentix/cli-init` at the same version, forwarding argv and
 * the exit code.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PACKAGE_ROOT = path.resolve(__dirname, '..');

function readManifest(packageRoot) {
  return JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
}

/** True when `dist/cli.js` exists and every runtime dependency resolves from here. */
function localCliReady(packageRoot = PACKAGE_ROOT, deps = {}) {
  const exists = deps.exists || fs.existsSync;
  const resolve = deps.resolve || ((id) => require.resolve(id, { paths: [packageRoot] }));
  if (!exists(path.join(packageRoot, 'dist', 'cli.js'))) return false;
  const manifest = deps.manifest || readManifest(packageRoot);
  try {
    for (const name of Object.keys(manifest.dependencies || {})) resolve(name);
    return true;
  } catch {
    return false;
  }
}

function planLaunch(argv, packageRoot = PACKAGE_ROOT, deps = {}) {
  if (localCliReady(packageRoot, deps)) {
    return { kind: 'local', cliPath: path.join(packageRoot, 'dist', 'cli.js') };
  }
  const manifest = deps.manifest || readManifest(packageRoot);
  const spec = `${manifest.name}@${manifest.version}`;
  return {
    kind: 'published',
    spec,
    command: 'npx',
    args: ['--yes', `--package=${spec}`, 'jumentix', ...argv]
  };
}

function launch(argv = process.argv.slice(2), deps = {}) {
  const plan = planLaunch(argv, PACKAGE_ROOT, deps);
  if (plan.kind === 'local') {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(plan.cliPath).runAsCli(argv).catch((error) => {
      console.error(`\nBootstrap failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    });
  }
  console.error(`[jumentix] no local build in this checkout; running published ${plan.spec}`);
  const run = deps.spawn || spawnSync;
  const result = run(plan.command, plan.args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) {
    console.error(`[jumentix] could not start ${plan.command}: ${result.error.message}`);
    process.exitCode = 2;
  } else {
    process.exitCode = typeof result.status === 'number' ? result.status : 2;
  }
  return Promise.resolve();
}

module.exports = { PACKAGE_ROOT, launch, localCliReady, planLaunch };
