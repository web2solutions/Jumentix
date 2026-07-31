/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const DEFAULT_MANIFEST_PATH = path.resolve(__dirname, '../../test-map.json');
const VALID_TIERS = new Set(['gate', 'nightly']);
const VALID_RUNNERS = new Set(['bun', 'node']);
const VALID_TYPES = new Set(['unit', 'integration', 'smoke', 'contract', 'platform']);
const VALID_CI_RUNNERS = new Set(['bun', 'node']);

function readTestMap(manifestPath = DEFAULT_MANIFEST_PATH) {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing test map manifest: ${manifestPath}`);
  }
  const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!parsed || parsed.schemaVersion !== 1) {
    throw new Error('test-map.json must declare schemaVersion: 1');
  }
  return parsed;
}

function layerNames(manifest) {
  return Object.keys(manifest.layers || {});
}

function assertAcyclic(manifest) {
  const layers = manifest.layers || {};
  const visiting = new Set();
  const visited = new Set();

  function visit(name, stack) {
    if (visited.has(name)) return;
    if (visiting.has(name)) {
      throw new Error(`test-map dependsOn cycle detected: ${[...stack, name].join(' -> ')}`);
    }
    visiting.add(name);
    for (const dep of layers[name]?.dependsOn || []) {
      if (!layers[dep]) {
        throw new Error(`Layer "${name}" dependsOn unknown layer "${dep}"`);
      }
      visit(dep, [...stack, name]);
    }
    visiting.delete(name);
    visited.add(name);
  }

  for (const name of Object.keys(layers)) {
    visit(name, []);
  }
}

function outwardClosure(manifest, seedLayers) {
  const layers = manifest.layers || {};
  const reverse = new Map();
  for (const [name, meta] of Object.entries(layers)) {
    for (const dep of meta.dependsOn || []) {
      if (!reverse.has(dep)) reverse.set(dep, new Set());
      reverse.get(dep).add(name);
    }
  }

  const out = new Set(seedLayers);
  const queue = [...seedLayers];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const dependent of reverse.get(current) || []) {
      if (!out.has(dependent)) {
        out.add(dependent);
        queue.push(dependent);
      }
    }
  }
  return [...out];
}

function suitesForLayers(manifest, layers, options = {}) {
  const allowNightly = Boolean(options.allowNightly);
  const layerSet = new Set(layers);
  return (manifest.suites || []).filter((suite) => {
    if (!layerSet.has(suite.layer)) return false;
    if (suite.tier === 'nightly' && !allowNightly) return false;
    return true;
  });
}

function isQuarantined(manifest, suitePath) {
  const entries = manifest.quarantine || [];
  return entries.find((entry) => suitePath === entry.path || suitePath.startsWith(entry.path));
}

function validateTestMap(manifest, options = {}) {
  const root = options.root || path.resolve(__dirname, '../..');
  const errors = [];

  if (!manifest.layers || Object.keys(manifest.layers).length === 0) {
    errors.push('manifest.layers must declare at least one layer');
  }

  try {
    assertAcyclic(manifest);
  } catch (error) {
    errors.push(error.message);
  }

  const ownership = new Map();
  for (const suite of manifest.suites || []) {
    if (!suite.path || !suite.layer || !suite.type || !suite.runner || !suite.tier) {
      errors.push(`Suite missing required fields: ${JSON.stringify(suite)}`);
      continue;
    }
    if (!manifest.layers[suite.layer]) {
      errors.push(`Suite ${suite.path} references unknown layer ${suite.layer}`);
    }
    if (!VALID_TIERS.has(suite.tier)) {
      errors.push(`Suite ${suite.path} has invalid tier ${suite.tier}`);
    }
    if (!VALID_RUNNERS.has(suite.runner)) {
      errors.push(`Suite ${suite.path} has invalid runner ${suite.runner}`);
    }
    if (suite.ciRunner && !VALID_CI_RUNNERS.has(suite.ciRunner)) {
      errors.push(`Suite ${suite.path} has invalid ciRunner ${suite.ciRunner}`);
    }
    // Req 106: local default must be bun; Node is CI-only via ciRunner.
    if (suite.runner === 'node') {
      errors.push(
        `Suite ${suite.path} uses runner:"node" — local runner must be "bun"; use ciRunner:"node" for CI (Req 106)`
      );
    }
    if (!VALID_TYPES.has(suite.type)) {
      errors.push(`Suite ${suite.path} has invalid type ${suite.type}`);
    }
    const absolute = path.join(root, suite.path);
    if (!fs.existsSync(absolute)) {
      errors.push(`Suite path does not exist: ${suite.path}`);
    }
    if (ownership.has(suite.path)) {
      errors.push(`Suite owned by multiple layers: ${suite.path}`);
    }
    ownership.set(suite.path, suite.layer);
  }

  for (const entry of manifest.quarantine || []) {
    if (!entry.path || !entry.reason || !entry.issue) {
      errors.push(`Quarantine entry missing path/reason/issue: ${JSON.stringify(entry)}`);
      continue;
    }
    if (!/^JUM-\d+$/.test(entry.issue)) {
      errors.push(`Quarantine entry must reference a Linear issue: ${entry.path}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

module.exports = {
  DEFAULT_MANIFEST_PATH,
  assertAcyclic,
  isQuarantined,
  layerNames,
  outwardClosure,
  readTestMap,
  suitesForLayers,
  validateTestMap
};
