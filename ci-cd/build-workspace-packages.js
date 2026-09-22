/* eslint-disable no-console */
/**
 * JUM-871 — level-parallel topological workspace build.
 *
 * `bun run --filter './packages/*' build` schedules the filter set in
 * parallel, so a dependent package's `tsc` races its workspace
 * dependencies' `dist` emission (intermittent TS2307 on
 * @jumentix/shared-contracts and friends — whichever pair scheduling
 * happens to expose). This script replaces the filter with Kahn's
 * algorithm over the workspace dependency graph: each LEVEL builds in
 * parallel, levels run sequentially, so a package's `build` starts only
 * after every workspace package it depends on has finished building.
 *
 * The spawn goes through the running interpreter (`process.execPath run
 * build`, Requirement 096) with cwd at the package directory. The first
 * failure aborts the remaining levels and names the failed package; a
 * dependency cycle fails closed with the cycle in the message.
 *
 * Pure pieces (discovery, graph, levels) are exported and take injected
 * fs/spawn so the suite drives synthetic fixtures.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { isEntryPoint } = require('./lib/entry-point.js');

const DEPENDENCY_FIELDS = Object.freeze(['dependencies', 'peerDependencies', 'devDependencies']);

/**
 * Every workspace package with a build script, keyed by package name.
 * Packages without `scripts.build` are not nodes (nothing to run).
 *
 * @returns {Map<string, { name: string, dir: string, dependencies: string[] }>}
 */
function discoverWorkspacePackages(options = {}) {
  const root = options.root || process.cwd();
  const packagesDir = options.packagesDir || path.join(root, 'packages');
  const readdir = options.readdir || ((dir) => fs.readdirSync(dir, { withFileTypes: true }));
  const readFile = options.readFile || ((file) => fs.readFileSync(file, 'utf8'));

  /** @type {Map<string, { name: string, dir: string, dependencies: string[] }>} */
  const packages = new Map();
  for (const entry of readdir(packagesDir)) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(packagesDir, entry.name);
    const manifestPath = path.join(dir, 'package.json');
    let manifest;
    try {
      manifest = JSON.parse(readFile(manifestPath));
    } catch {
      continue; // not a package (no manifest, or unreadable)
    }
    if (!manifest.name || typeof manifest.scripts?.build !== 'string') continue;
    const dependencies = [];
    for (const field of DEPENDENCY_FIELDS) {
      const declared = manifest[field];
      if (!declared || typeof declared !== 'object') continue;
      for (const depName of Object.keys(declared)) {
        if (depName !== manifest.name && !dependencies.includes(depName)) {
          dependencies.push(depName);
        }
      }
    }
    packages.set(manifest.name, { name: manifest.name, dir, dependencies });
  }
  return packages;
}

/**
 * Restrict declared dependencies to names that are themselves workspace
 * packages — a dependency on an external package is an install concern,
 * not a build-ordering edge.
 */
function workspaceEdges(pkg, knownNames) {
  return pkg.dependencies.filter((name) => knownNames.has(name));
}

/**
 * Kahn's algorithm over workspace edges, grouped into levels: every
 * package in level N depends only on packages in levels < N, so one level
 * can build in parallel while levels run sequentially.
 *
 * @param {Map<string, { name: string, dir: string, dependencies: string[] }>} packages
 * @returns {string[][]} level N is the array of package names built at step N
 */
function computeBuildLevels(packages) {
  const knownNames = new Set(packages.keys());
  const edges = new Map();
  const indegree = new Map();
  packages.forEach((pkg, name) => {
    edges.set(name, []);
    indegree.set(name, 0);
  });
  packages.forEach((pkg, name) => {
    for (const dep of workspaceEdges(pkg, knownNames)) {
      edges.get(dep).push(name);
      indegree.set(name, indegree.get(name) + 1);
    }
  });

  const levels = [];
  let current = [...packages.keys()].filter((name) => indegree.get(name) === 0).sort();
  let placed = 0;
  while (current.length > 0) {
    levels.push(current);
    placed += current.length;
    const next = [];
    for (const name of current) {
      for (const dependent of edges.get(name)) {
        const remaining = indegree.get(dependent) - 1;
        indegree.set(dependent, remaining);
        if (remaining === 0) next.push(dependent);
      }
    }
    current = next.sort();
  }

  if (placed !== packages.size) {
    const remaining = [...packages.keys()].filter((name) => !levels.flat().includes(name));
    const cycle = findCycle(packages, new Set(remaining));
    throw new Error(
      'Workspace dependency cycle detected; cannot compute a build order: '
        + (cycle ? cycle.join(' -> ') : remaining.join(', '))
    );
  }
  return levels;
}

/** One concrete cycle path through `candidates`, for the error message. */
function findCycle(packages, candidates) {
  const knownNames = new Set(packages.keys());
  const state = new Map(); // name → 'visiting' | 'done'
  const stack = [];
  let found = null;
  const visit = (name) => {
    if (found || state.get(name) === 'done') return;
    if (state.get(name) === 'visiting') {
      found = [...stack.slice(stack.indexOf(name)), name];
      return;
    }
    state.set(name, 'visiting');
    stack.push(name);
    for (const dep of workspaceEdges(packages.get(name), knownNames)) {
      if (candidates.has(dep)) visit(dep);
      if (found) return;
    }
    stack.pop();
    state.set(name, 'done');
  };
  for (const name of candidates) {
    visit(name);
    if (found) return found;
  }
  return null;
}

function spawnPackageBuild(pkg, options = {}) {
  const spawnImpl = options.spawn || spawn;
  return new Promise((resolve) => {
    const child = spawnImpl(process.execPath, ['run', 'build'], {
      cwd: pkg.dir,
      stdio: 'inherit',
      env: { ...process.env, ...(options.env || {}) }
    });
    child.on('error', () => resolve(1));
    child.on('close', (code) => resolve(code === null ? 1 : code));
  });
}

/**
 * Build every discovered workspace package in topological levels: parallel
 * within a level, sequential across levels. First failure aborts the
 * remaining levels and names the failed package.
 *
 * @returns {Promise<number>} 0 on success, 1 on failure
 */
async function buildWorkspacePackages(options = {}) {
  const logger = options.logger || console;
  const discover = options.discover || discoverWorkspacePackages;
  const packages = options.packages || discover(options);

  if (packages.size === 0) {
    logger.error('[build] no workspace packages with a build script discovered.');
    return 1;
  }

  const levels = computeBuildLevels(packages);
  for (let index = 0; index < levels.length; index += 1) {
    const level = levels[index];
    logger.log(`[build] level ${index + 1}/${levels.length}: ${level.join(', ')}`);
    const results = await Promise.all(level.map(async (name) => ({
      name,
      status: await spawnPackageBuild(packages.get(name), options)
    })));
    const failed = results.find((result) => result.status !== 0);
    if (failed) {
      logger.error(
        `[build] ${failed.name} build failed with exit code ${String(failed.status)}; aborting remaining levels.`
      );
      return 1;
    }
  }
  logger.log(`[build] built ${packages.size} package(s) across ${levels.length} level(s).`);
  return 0;
}

function main() {
  return buildWorkspacePackages().catch((error) => {
    console.error(`[build] ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  });
}

if (isEntryPoint(module)) {
  main().then((status) => {
    process.exitCode = status;
  });
}

module.exports = {
  buildWorkspacePackages,
  computeBuildLevels,
  discoverWorkspacePackages,
  findCycle,
  main,
  spawnPackageBuild,
  workspaceEdges
};
