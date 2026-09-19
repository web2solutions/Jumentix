/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { isEntryPoint } = require('../../../ci-cd/lib/entry-point.js');

/**
 * sync-service-management-designer-core — vendor the designer-core module
 * tree into the zero-build Service Management SPA (JUM-493).
 *
 * The designer core's canonical home is `packages/designer-core/src/`. The
 * SPA imports it through bare `@jumentix/designer-core/…` specifiers, which
 * the import map in `index.html` resolves to
 * `apps/service-management/vendor/designer-core/`. That tree is a copy
 * vendored into the app, not a symlink, because server.js
 * containment-validates every served path against the app root — the same
 * reason the Cana bundle is vendored (JUM-484).
 *
 * Unlike Cana there is nothing to compile: the core is plain browser-safe
 * ESM, so the sync is a verbatim copy, and byte-identity is what makes a
 * stale or partial vendor tree detectable. The tree is gitignored; this
 * script regenerates it, and the browser integration suites run it before
 * booting the server — a missing vendored module is a module-resolution
 * failure at boot, so a suite that forgets to sync fails loudly, never
 * silently.
 */

const PACKAGE_SRC = path.join('packages', 'designer-core', 'src');
const VENDORED_DIR = path.join('apps', 'service-management', 'vendor', 'designer-core');

/** Every JavaScript module under `dir`, relative to it, sorted. */
function listModules(dir, readDir, prefix = '') {
  return readDir(dir).flatMap((entry) => {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return listModules(path.join(dir, rel), readDir, rel);
    return entry.name.endsWith('.js') ? [rel] : [];
  }).sort();
}

function syncServiceManagementDesignerCore(options = {}) {
  const root = options.root || process.cwd();
  const exists = options.exists || fs.existsSync;
  const readDir = options.readDir || ((dir) => fs.readdirSync(dir, { withFileTypes: true }));
  const readFile = options.readFile || fs.readFileSync;
  const writeFile = options.writeFile || ((target, contents) => {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
  });
  const removeDir = options.removeDir || ((target) => fs.rmSync(target, { recursive: true, force: true }));
  const logger = options.logger || console;

  const sourceDir = path.join(root, PACKAGE_SRC);
  if (!exists(sourceDir)) {
    logger.error(`[ci] designer-core sync: package source not found: ${sourceDir}`);
    return 1;
  }

  const modules = listModules(sourceDir, readDir);
  if (!modules.includes('index.js') || modules.length < 2) {
    logger.error('[ci] designer-core sync: src/ holds no module tree (index.js missing).');
    return 1;
  }

  // Replace rather than merge: a module removed from the package must stop
  // being served, and merge-only sync would keep serving it forever.
  const targetDir = path.join(root, VENDORED_DIR);
  removeDir(targetDir);
  for (const rel of modules) {
    writeFile(path.join(targetDir, rel), readFile(path.join(sourceDir, rel)));
  }

  logger.log(`[ci] designer-core synced: ${VENDORED_DIR} (${modules.length} modules)`);
  return 0;
}

if (isEntryPoint(module)) {
  process.exitCode = syncServiceManagementDesignerCore();
}

module.exports = {
  PACKAGE_SRC,
  VENDORED_DIR,
  syncServiceManagementDesignerCore
};
