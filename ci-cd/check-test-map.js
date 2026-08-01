/* eslint-disable no-console */
const path = require('path');
const { readTestMap, validateTestMap } = require('./lib/test-map');
const { isEntryPoint } = require('./lib/entry-point.js');

function main() {
  const root = path.resolve(__dirname, '..');
  const manifestPath = path.join(root, 'test-map.json');
  const manifest = readTestMap(manifestPath);
  const result = validateTestMap(manifest, { root });

  if (!result.ok) {
    console.error('[ci] test-map validation failed:');
    for (const error of result.errors) {
      console.error(` - ${error}`);
    }
    process.exit(1);
  }

  console.log(
    `[ci] test-map OK — layers=${Object.keys(manifest.layers).length} suites=${manifest.suites.length} quarantine=${(manifest.quarantine || []).length}`
  );
}

if (isEntryPoint(module)) {
  main();
}

module.exports = {
  main
};
