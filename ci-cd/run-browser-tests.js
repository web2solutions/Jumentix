#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Requirement 112 §4 — run the browser suites in a real browser, headless.
 *
 * Two steps, and the first one exists for a reason worth writing down.
 *
 * Cypress compiles specs with its own bundled webpack. In this repository that
 * compile crashes before any spec runs — `Cannot read properties of undefined
 * (reading 'deferreds')`, thrown from inside webpack's cache while it stores
 * build dependencies. It is not our configuration: a TypeScript spec importing
 * nothing at all, in an otherwise empty project, fails the same way. A plain
 * JavaScript spec runs fine.
 *
 * So the specs are bundled here first, with Bun — the toolchain this repository
 * already pins and already builds every other artifact with — and Cypress is
 * handed JavaScript. That is a smaller dependency on Cypress's internals, not a
 * larger one: the browser still runs the real spec against the real IndexedDB,
 * and the thing that changed is which bundler produced the file.
 *
 * The build output is generated, so it is written outside the source tree and
 * ignored by git. `--force` rebuilds; otherwise a spec is rebuilt only when it
 * or its sources are newer than the bundle.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { runWhenEntryPoint } = require('./lib/entry-point.js');
const { instrumentBundle, writeBrowserCoverage } = require('./lib/browser-coverage.js');

const ROOT = process.cwd();
const SPEC_ROOT = path.join(ROOT, 'packages');
const BUILD_DIR = path.join(ROOT, '.browser-tests');

/** Every `*.cy.ts` under any package's `cypress/` directory. */
function findSpecs(root = SPEC_ROOT, list = fs.existsSync(root) ? fs.readdirSync(root) : []) {
  return list.flatMap((name) => {
    const full = path.join(root, name);
    if (fs.statSync(full).isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name === '.build') return [];
      return findSpecs(full);
    }
    return full.endsWith('.cy.ts') ? [full] : [];
  });
}

/** Where a spec's bundle goes: the package name, then the spec name. */
function bundlePath(specPath) {
  const relative = path.relative(SPEC_ROOT, specPath);
  const [packageName] = relative.split(path.sep);
  return path.join(BUILD_DIR, packageName, `${path.basename(specPath, '.ts')}.js`);
}

function bundle(specPath, spawn = spawnSync) {
  const output = bundlePath(specPath);
  fs.mkdirSync(path.dirname(output), { recursive: true });

  const result = spawn(
    'bun',
    [
      'build', specPath,
      '--target', 'browser',
      '--format', 'iife',
      // Inline, because the instrumenter reads the map out of the bundle to put
      // the coverage back on the TypeScript files it came from.
      '--sourcemap=inline',
      '--outfile', output
    ],
    { stdio: 'pipe', encoding: 'utf8' }
  );

  if (result.status !== 0) {
    return {
      ok: false,
      message: `Failed to bundle ${path.relative(ROOT, specPath)}:\n${result.stderr || result.stdout}`
    };
  }

  instrumentBundle(output);

  return { ok: true, output };
}

function buildAll(specs, spawn = spawnSync) {
  const failures = [];
  for (const spec of specs) {
    const result = bundle(spec, spawn);
    if (!result.ok) failures.push(result.message);
  }
  return failures;
}

function run(options = {}) {
  const spawn = options.spawn || spawnSync;
  const specs = options.specs || findSpecs();

  if (specs.length === 0) {
    return { ok: false, message: 'No browser specs found under packages/*/cypress/**.cy.ts.' };
  }

  fs.rmSync(BUILD_DIR, { recursive: true, force: true });

  const failures = buildAll(specs, spawn);
  if (failures.length > 0) {
    return { ok: false, message: failures.join('\n\n') };
  }

  console.log(`[browser] bundled ${specs.length} spec(s) with Bun; handing them to Cypress.`);

  const cypress = spawn(
    'bunx',
    ['cypress', 'run', '--e2e', '--browser', options.browser || 'electron'],
    { stdio: 'inherit' }
  );

  if (cypress.status !== 0) {
    return { ok: false, message: `Cypress exited with status ${String(cypress.status)}.` };
  }

  const coverage = writeBrowserCoverage();
  if (!coverage.ok) return coverage;

  return {
    ok: true,
    message: `Browser suite passed: ${specs.length} spec(s) in a real browser. ${coverage.message}`
  };
}

function main(io = console, execute = run) {
  const result = execute();
  if (result.ok) {
    io.log(result.message);
    return 0;
  }
  io.error(result.message);
  return 1;
}

const runAsEntryPoint = ({ runMain = main, ...rest } = {}) => runWhenEntryPoint({
  caller: module,
  execute: runMain,
  ...rest
});

runAsEntryPoint();

module.exports = {
  BUILD_DIR,
  bundlePath,
  buildAll,
  findSpecs,
  main,
  run,
  runAsEntryPoint
};
