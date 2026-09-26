const fs = require('fs');
const path = require('path');
const { outwardClosure, readTestMap, suitesForLayers, isQuarantined } = require('./test-map');

const IMPORT_RE = /(?:import|export)\s+(?:type\s+)?(?:[^'"\n]+from\s+)?['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/g;

function normalizeFiles(files) {
  return [...new Set((files || [])
    .map((file) => String(file || '').trim().replace(/\\/g, '/'))
    .filter(Boolean))];
}

function matchGlob(filePath, globPattern) {
  const escaped = String(globPattern)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DOUBLE::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DOUBLE::/g, '.*');
  return new RegExp(`^${escaped}$`).test(filePath);
}

function resolveAlias(specifier, aliases) {
  for (const [alias, target] of Object.entries(aliases || {})) {
    if (specifier === alias) return target;
    if (specifier.startsWith(`${alias}/`)) {
      return path.posix.join(target, specifier.slice(alias.length + 1));
    }
  }
  return null;
}

function extractSpecifiers(sourceText) {
  const specs = [];
  IMPORT_RE.lastIndex = 0;
  let match = IMPORT_RE.exec(sourceText);
  while (match) {
    specs.push(match[1] || match[2]);
    match = IMPORT_RE.exec(sourceText);
  }
  return specs;
}

function resolveSpecifier(fromFile, specifier, aliases, root) {
  if (!specifier) return null;
  if (specifier.startsWith('.')) {
    const base = path.posix.join(path.posix.dirname(fromFile), specifier);
    return resolveExisting(base, root);
  }
  const aliased = resolveAlias(specifier, aliases);
  if (aliased) return resolveExisting(aliased, root);
  if (specifier.startsWith('@jumentix/')) {
    const pkg = specifier.replace('@jumentix/', '').split('/')[0];
    return resolveExisting(`packages/${pkg}/src`, root);
  }
  return null;
}

function resolveExisting(candidate, root) {
  const abs = path.join(root, candidate);
  const tries = [
    candidate,
    `${candidate}.ts`,
    `${candidate}.js`,
    `${candidate}.tsx`,
    `${candidate}.jsx`,
    path.posix.join(candidate, 'index.ts'),
    path.posix.join(candidate, 'index.js')
  ];
  for (const rel of tries) {
    if (fs.existsSync(path.join(root, rel))) return rel.replace(/\\/g, '/');
  }
  if (fs.existsSync(abs)) return candidate.replace(/\\/g, '/');
  return candidate.replace(/\\/g, '/');
}

function buildDependencyGraph(manifest, options = {}) {
  const root = options.root || path.resolve(__dirname, '../..');
  const aliases = manifest.pathAliases || {};
  const files = [];
  for (const sourceRoot of manifest.sourceRoots || []) {
    collectSourceFiles(path.join(root, sourceRoot), root, files);
  }

  const graph = new Map();
  for (const file of files) {
    const abs = path.join(root, file);
    let text = '';
    try {
      text = fs.readFileSync(abs, 'utf8');
    } catch {
      graph.set(file, []);
      continue;
    }
    const deps = [];
    for (const specifier of extractSpecifiers(text)) {
      const resolved = resolveSpecifier(file, specifier, aliases, root);
      if (resolved && resolved !== file) deps.push(resolved);
    }
    graph.set(file, [...new Set(deps)]);
  }
  return graph;
}

function collectSourceFiles(dir, root, out) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (['node_modules', 'dist', '.build', 'coverage'].includes(ent.name)) continue;
      collectSourceFiles(abs, root, out);
      continue;
    }
    if (/\.[cm]?[jt]sx?$/.test(ent.name)) {
      out.push(path.relative(root, abs).replace(/\\/g, '/'));
    }
  }
}

/** Docs under a source tree must not select that layer (GUI README placeholders). */
const SOURCE_GLOB_SKIP = /\.(md|mdx|txt)$/i;

function layersForFile(manifest, filePath) {
  const matched = new Set();
  for (const [layer, meta] of Object.entries(manifest.layers || {})) {
    for (const glob of meta.sourceGlobs || []) {
      // `src/interface/**` must not treat README.md as an interface/runtime change
      // (Requirements 087/088 — task gates stay change-focused).
      if (SOURCE_GLOB_SKIP.test(filePath)) continue;
      if (matchGlob(filePath, glob)) matched.add(layer);
    }
  }

  // Test files map through suite ownership.
  for (const suite of manifest.suites || []) {
    if (suite.path === filePath || filePath.startsWith(`${path.posix.dirname(suite.path)}/`)) {
      if (suite.path === filePath) matched.add(suite.layer);
    }
  }
  const exactSuite = (manifest.suites || []).find((suite) => suite.path === filePath);
  if (exactSuite) matched.add(exactSuite.layer);

  if (filePath.startsWith('ci-cd/')
    || filePath.startsWith('tooling/')
    || filePath.startsWith('apps/jumentix-website/')
    || filePath.startsWith('.github/')
    || filePath.startsWith('.circleci/')) {
    matched.add('tooling');
  }
  // Root toolchain pins (lockfile, package manifests, version pins) gate the
  // same toolchain evidence as ci-cd/ changes — a bun.lock-only change must
  // not fall through to unsupported-change-set.
  if (filePath === 'bun.lock' || filePath === 'package.json' || filePath === '.bun-version'
    || filePath === '.gitignore') {
    matched.add('tooling');
  }
  // The CLI's packaged templates are data its tooling-layer suites (template
  // freshness, generation) read from disk, never imports — so no dependency
  // edge reaches them and a templates-only change was `unsupported-change-set`
  // (JUM-904).
  if (filePath.startsWith('packages/cli-init/templates/')
    || filePath === 'packages/cli-init/templates.manifest.json') {
    matched.add('tooling');
  }
  if (filePath.startsWith('apps/backend-template/test/unit/modules/Users/domain/')) matched.add('domain');
  if (filePath.startsWith('apps/backend-template/test/unit/modules/Users/application/')
    || filePath.startsWith('apps/backend-template/test/unit/modules/Users/composition/')
    || filePath === 'apps/backend-template/test/unit/modules/Users/factories.test.ts'
    || filePath === 'apps/backend-template/test/unit/modules/Users/index.exports.test.ts') {
    matched.add('application');
  }
  if (filePath.startsWith('apps/backend-template/test/unit/modules/Users/adapters/in/')) matched.add('adapters/in');
  if (filePath.startsWith('apps/backend-template/test/unit/infra/')
    || filePath.startsWith('apps/backend-template/test/unit/modules/Users/adapters/out/')) {
    matched.add('adapters/out+infra');
  }
  if (filePath.startsWith('apps/backend-template/test/unit/interface/')) matched.add('interface/runtime');
  if (filePath.startsWith('apps/backend-template/test/integration/')) {
    const suite = (manifest.suites || []).find((item) => item.path === filePath);
    if (suite) matched.add(suite.layer);
  }

  return [...matched];
}

function expandThroughGraph(seedFiles, graph) {
  const reverse = new Map();
  for (const [file, deps] of graph.entries()) {
    for (const dep of deps) {
      if (!reverse.has(dep)) reverse.set(dep, new Set());
      reverse.get(dep).add(file);
    }
  }
  const out = new Set(seedFiles);
  const queue = [...seedFiles];
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

function createLayerAwarePlan(changedFiles, options = {}) {
  const manifest = options.manifest || readTestMap(options.manifestPath);
  const root = options.root || path.resolve(__dirname, '../..');
  const files = normalizeFiles(changedFiles);
  const graph = options.graph || buildDependencyGraph(manifest, { root });
  const impactedFiles = expandThroughGraph(files, graph);

  const directLayers = new Set();
  const reasons = {};
  for (const file of files) {
    const layers = layersForFile(manifest, file);
    for (const layer of layers) {
      directLayers.add(layer);
      if (!reasons[layer]) reasons[layer] = { direct: [], propagatedFrom: [] };
      reasons[layer].direct.push(file);
    }
  }

  // Alias-aware dependents can introduce additional layer seeds.
  for (const file of impactedFiles) {
    if (files.includes(file)) continue;
    for (const layer of layersForFile(manifest, file)) {
      if (!directLayers.has(layer)) {
        directLayers.add(layer);
        if (!reasons[layer]) reasons[layer] = { direct: [], propagatedFrom: [] };
        reasons[layer].propagatedFrom.push({ file, via: 'dependency-graph' });
      }
    }
  }

  const selectedLayers = outwardClosure(manifest, [...directLayers]);
  for (const layer of selectedLayers) {
    if (!reasons[layer]) {
      reasons[layer] = {
        direct: [],
        propagatedFrom: [...directLayers].map((seed) => ({ layer: seed, via: 'dependsOn-outward' }))
      };
    }
  }

  const allowNightly = Boolean(options.allowNightly);
  const suites = suitesForLayers(manifest, selectedLayers, { allowNightly })
    .filter((suite) => !isQuarantined(manifest, suite.path));

  const unitSuites = suites.filter((suite) => suite.type === 'unit');
  // Contract suites (JUM-440: `oas:check-routes`, `serverless:check-handlers`)
  // are script-run gates exactly like the per-framework integration scripts —
  // planned but not executed here, they made the evidence validation report
  // its own planned suites as unrun whenever a change selected the contracts
  // layer (first hit by JUM-474 editing `ci-cd/check-oas-route-resolution.js`).
  const integrationScripts = [...new Set(
    suites
      .filter((suite) => (suite.type === 'integration' || suite.type === 'contract') && suite.script)
      .map((suite) => suite.script)
  )];

  const documentationOnly = files.length > 0
    && files.every((file) => /(^|\/)(documentation\/|\.agents\/)|(^|\/)(README|CHANGELOG|CLAUDE|GROK|AGENTS)(\.[^/]*)?\.md$|\.md$/i.test(file));

  if (documentationOnly) {
    return {
      type: 'documentation-validation',
      files,
      selectedLayers: [],
      notRunLayers: layerNamesNotSelected(manifest, []),
      reasons: {},
      unitSuites: [],
      integrationScripts: [],
      suites: []
    };
  }

  if (files.length > 0 && suites.length === 0 && directLayers.size === 0) {
    return {
      type: 'unsupported-change-set',
      files,
      selectedLayers: [],
      notRunLayers: layerNamesNotSelected(manifest, []),
      reasons,
      unitSuites: [],
      integrationScripts: [],
      suites: []
    };
  }

  return {
    type: 'layer-aware',
    files,
    impactedFiles,
    selectedLayers,
    notRunLayers: layerNamesNotSelected(manifest, selectedLayers),
    reasons,
    unitSuites: unitSuites.map((suite) => suite.path),
    integrationScripts,
    suites
  };
}

function layerNamesNotSelected(manifest, selectedLayers) {
  const selected = new Set(selectedLayers);
  return Object.keys(manifest.layers || {}).filter((layer) => !selected.has(layer));
}

module.exports = {
  buildDependencyGraph,
  createLayerAwarePlan,
  expandThroughGraph,
  extractSpecifiers,
  layersForFile,
  matchGlob,
  normalizeFiles,
  resolveAlias,
  resolveSpecifier
};
