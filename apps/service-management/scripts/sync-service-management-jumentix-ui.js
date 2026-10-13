/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { isEntryPoint } = require('../../../ci-cd/lib/entry-point.js');

/**
 * Vendor `@jumentix/jumentix-ui` CSS into the Service Management SPA.
 *
 * server.js containment-validates every static path against
 * `apps/service-management/` — `../../packages/...` from index.html 404s
 * (path escapes the static root). Same reason designer-core / Cana / D3 /
 * swagger-ui are vendored, not linked across the monorepo boundary.
 */

const SOURCE_DIR = path.join('packages', 'jumentix-ui', 'src', 'css');
const TARGET_DIR = path.join('apps', 'service-management', 'vendor', 'jumentix-ui');
const FILES = ['jumentix-ui.css', 'tokens.css', 'primitives.css'];

function syncServiceManagementJumentixUi(options = {}) {
  const root = options.root || process.cwd();
  const exists = options.exists || fs.existsSync;
  const readFile = options.readFile || fs.readFileSync;
  const writeFile = options.writeFile || ((target, contents) => {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
  });
  const removeDir = options.removeDir || ((target) => fs.rmSync(target, { recursive: true, force: true }));
  const logger = options.logger || console;
  const sourceDir = path.join(root, SOURCE_DIR);
  if (!exists(sourceDir)) {
    logger.error(`[ci] jumentix-ui sync: package CSS not found: ${sourceDir}`);
    return 1;
  }
  for (const file of FILES) {
    const source = path.join(sourceDir, file);
    if (!exists(source)) {
      logger.error(`[ci] jumentix-ui sync: missing ${source}`);
      return 1;
    }
  }
  const targetDir = path.join(root, TARGET_DIR);
  removeDir(targetDir);
  for (const file of FILES) {
    writeFile(path.join(targetDir, file), readFile(path.join(sourceDir, file)));
  }
  logger.log(`[ci] jumentix-ui synced: ${TARGET_DIR} (${FILES.length} CSS files)`);
  return 0;
}

if (isEntryPoint(module)) {
  process.exitCode = syncServiceManagementJumentixUi();
}

module.exports = {
  syncServiceManagementJumentixUi,
  FILES,
  SOURCE_DIR,
  TARGET_DIR
};
