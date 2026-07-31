#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Per-layer Bun watch mode derived from test-map.json (JUM-500).
 * Usage:
 *   bun ci-cd/run-tdd.js                 # infer layer from git diff
 *   bun ci-cd/run-tdd.js domain          # watch domain unit suites
 *   bun ci-cd/run-tdd.js adapters/in
 */
const { spawnSync } = require('child_process');
const path = require('path');
const { readTestMap, suitesForLayers } = require('./lib/test-map');
const { createLayerAwarePlan } = require('./lib/layer-resolver');
const { runBunTestFiles } = require('./lib/suite-runner');

function listLayers(manifest) {
  return Object.keys(manifest.layers || {});
}

function normalizeLayerArg(arg, manifest) {
  if (!arg) return null;
  const layers = listLayers(manifest);
  if (layers.includes(arg)) return arg;
  const aliases = {
    adapters: 'adapters/in',
    adapter: 'adapters/in',
    infra: 'adapters/out+infra',
    out: 'adapters/out+infra',
    interface: 'interface/runtime',
    runtime: 'interface/runtime',
    contract: 'contracts'
  };
  if (aliases[arg] && layers.includes(aliases[arg])) return aliases[arg];
  const partial = layers.find((layer) => layer.endsWith(arg) || layer.includes(arg));
  return partial || null;
}

function readDiffFiles() {
  const result = spawnSync('git', ['diff', '--name-only', '--diff-filter=ACMR', 'HEAD'], {
    encoding: 'utf8'
  });
  if (result.status !== 0) return [];
  return String(result.stdout || '').split('\n').map((l) => l.trim()).filter(Boolean);
}

function unitPathsForLayer(manifest, layer) {
  return suitesForLayers(manifest, [layer], { allowNightly: false })
    .filter((suite) => suite.type === 'unit' && suite.runner !== 'node')
    .map((suite) => suite.path);
}

function main() {
  const root = path.resolve(__dirname, '..');
  const manifest = readTestMap(path.join(root, 'test-map.json'));
  const arg = process.argv[2];
  let layer = normalizeLayerArg(arg, manifest);

  if (!layer) {
    const changed = readDiffFiles();
    if (changed.length > 0) {
      const plan = createLayerAwarePlan(changed, { manifest, root });
      layer = (plan.selectedLayers || [])[0] || null;
    }
  }

  let paths;
  if (layer) {
    paths = unitPathsForLayer(manifest, layer);
    console.log(`[tdd] watching layer=${layer} suites=${paths.length}`);
  } else {
    paths = (manifest.suites || [])
      .filter((suite) => suite.type === 'unit' && suite.runner !== 'node' && suite.tier === 'gate')
      .map((suite) => suite.path);
    console.log(`[tdd] no layer inferred — watching full Bun unit gate suites=${paths.length}`);
  }

  if (paths.length === 0) {
    console.error('[tdd] no Bun unit suites selected');
    process.exit(1);
  }

  const status = runBunTestFiles(paths, { watch: true });
  process.exit(status);
}

if (require.main === module) {
  main();
}

module.exports = { listLayers, normalizeLayerArg, unitPathsForLayer };
