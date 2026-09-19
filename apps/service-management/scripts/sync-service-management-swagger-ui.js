/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { isEntryPoint } = require('../../../ci-cd/lib/entry-point.js');

/**
 * Copy the already-reviewed swagger-ui-dist files from backend-template OASdoc
 * into the Service Management vendor tree (JUM-818).
 */

const SOURCE_DIR = path.join('apps', 'backend-template', 'OASdoc');
const TARGET_DIR = path.join('apps', 'service-management', 'vendor', 'swagger-ui');
const FILES = ['swagger-ui-bundle.js', 'swagger-ui.css', 'swagger-ui-standalone-preset.js'];

function syncServiceManagementSwaggerUi(options = {}) {
  const root = options.root || process.cwd();
  const exists = options.exists || fs.existsSync;
  const readFile = options.readFile || fs.readFileSync;
  const writeFile = options.writeFile || ((target, contents) => {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
  });
  const logger = options.logger || console;
  const sourceDir = path.join(root, SOURCE_DIR);
  for (const file of FILES) {
    const source = path.join(sourceDir, file);
    if (!exists(source)) {
      logger.error(`[ci] swagger-ui sync: missing ${source}`);
      return 1;
    }
    writeFile(path.join(root, TARGET_DIR, file), readFile(source));
  }
  logger.log(`[ci] swagger-ui synced: ${TARGET_DIR} (${FILES.length} files from OASdoc)`);
  return 0;
}

if (isEntryPoint(module)) {
  process.exitCode = syncServiceManagementSwaggerUi();
}

module.exports = { syncServiceManagementSwaggerUi, FILES, SOURCE_DIR, TARGET_DIR };
