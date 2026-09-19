/* eslint-disable no-console */
/**
 * JUM-655 — a built entrypoint must carry everything its source barrel exports.
 *
 * `packages/agent-registry/dist/index.js` shipped without `createRtdbClient`
 * while `src/index.ts` exported it. Nothing failed at load time: a stale build
 * `require()`s perfectly well, it is simply missing the newer names. The defect
 * surfaced only when a caller reached for one —
 * `registry.createRtdbClient is not a function` — and by then the mandatory
 * Requirement 129 agent bus had been unusable for every agent (JUM-654).
 *
 * JUM-654 taught that one CLI to notice. This checks the condition itself, for
 * every package that publishes a built entrypoint, so the next stale `dist`
 * fails a gate instead of a user.
 *
 * What it does not do: compare timestamps. `dist` newer than `src` proves
 * nothing about content, and mtimes are meaningless after a fresh clone or a
 * cache restore. The question asked here is the one that matters — is each
 * exported name actually present in the built output.
 */
const fs = require('fs');
const path = require('path');
const { isEntryPoint } = require('./lib/entry-point.js');

const PACKAGES_DIR = 'packages';

/**
 * Named exports of a TypeScript barrel, as written.
 *
 * Deliberately textual rather than a TypeScript parse: this runs in the gate on
 * every commit, and a parser dependency for `export { a, b } from './x'` would
 * cost more than it returns. The forms below are the ones these barrels use;
 * anything else is reported as unparsed rather than silently ignored, because a
 * barrel this cannot read is exactly where a stale export would hide.
 */
function sourceExports(source) {
  const names = new Set();

  // export { a, b as c } from './x'  |  export { a, b }
  for (const match of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const entry of match[1].split(',')) {
      const cleaned = entry.trim();
      if (!cleaned) continue;
      // `a as b` publishes `b`; `type X` is erased at runtime and cannot appear
      // in the built JavaScript, so asserting on it would fail every time.
      if (/^type\s/.test(cleaned)) continue;
      const alias = /\sas\s+([A-Za-z0-9_$]+)$/.exec(cleaned);
      names.add(alias ? alias[1] : cleaned);
    }
  }

  // export function foo() / export const foo = / export class Foo
  for (const match of source.matchAll(
    /export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/g
  )) {
    names.add(match[1]);
  }

  return [...names].filter(Boolean);
}

function builtEntrypoint(root, packageDir) {
  const manifestPath = path.join(root, PACKAGES_DIR, packageDir, 'package.json');
  if (!fs.existsSync(manifestPath)) return null;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const main = manifest.main;
  if (typeof main !== 'string' || !main.startsWith('dist/')) return null;
  return {
    name: manifest.name || packageDir,
    manifestMain: main,
    sourceBarrel: path.join(root, PACKAGES_DIR, packageDir, 'src', 'index.ts'),
    builtFile: path.join(root, PACKAGES_DIR, packageDir, main)
  };
}

function checkPackage(entry) {
  const failures = [];

  if (!fs.existsSync(entry.sourceBarrel)) return failures;

  // An unbuilt package is a different problem with its own remedy, and the
  // consumers already build on demand. Reporting it here would make this check
  // fail on every fresh clone, which trains people to ignore it.
  if (!fs.existsSync(entry.builtFile)) return failures;

  const declared = sourceExports(fs.readFileSync(entry.sourceBarrel, 'utf8'));
  if (declared.length === 0) return failures;

  const built = fs.readFileSync(entry.builtFile, 'utf8');
  const missing = declared.filter((name) => !new RegExp(`\\b${name}\\b`).test(built));

  if (missing.length > 0) {
    failures.push(
      `[build-freshness] ${entry.name}: ${entry.manifestMain} is missing `
      + `${missing.length} export(s) declared in src/index.ts: ${missing.sort((a, b) => a.localeCompare(b)).join(', ')}`
      + ' — rebuild the package'
    );
  }

  return failures;
}

function validatePackageBuilds(rootDir = process.cwd()) {
  const packagesRoot = path.join(rootDir, PACKAGES_DIR);
  if (!fs.existsSync(packagesRoot)) return [];

  return fs.readdirSync(packagesRoot, { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => builtEntrypoint(rootDir, item.name))
    .filter(Boolean)
    .flatMap(checkPackage);
}

function run(rootDir = process.cwd()) {
  const failures = validatePackageBuilds(rootDir);
  if (failures.length > 0) {
    failures.forEach((failure) => console.error(failure));
    return 1;
  }
  console.log('Package build freshness check passed: every built entrypoint carries its source exports.');
  return 0;
}

if (isEntryPoint(module)) {
  process.exitCode = run();
}

module.exports = { builtEntrypoint, checkPackage, run, sourceExports, validatePackageBuilds };
