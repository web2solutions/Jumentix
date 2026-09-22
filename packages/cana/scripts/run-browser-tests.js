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
const { runWhenEntryPoint } = require('../../../ci-cd/lib/entry-point.js');
const { instrumentBundle, writeBrowserCoverage } = require('../../../ci-cd/lib/browser-coverage.js');

const ROOT = process.cwd();
const SPEC_ROOT = path.join(ROOT, 'packages');
const BUILD_DIR = path.join(ROOT, '.browser-tests');
const EVIDENCE_PATH = path.join(ROOT, 'artifacts', 'ci', 'browser-matrix.json');

/**
 * The browser engines Cana supports, and the only values `--browser` accepts.
 *
 * The matrix is engines, not brand names (JUM-417): `chrome` (the Chromium
 * engine, also Edge and Brave), `firefox` (the independent Gecko IndexedDB
 * implementation) and `webkit` (Playwright's build of Safari's engine — the
 * one whose quota/eviction behaviour this issue was filed about). Cypress
 * drives all three headless; WebKit additionally needs
 * `experimentalWebKitSupport` in `cypress.config.js` and the
 * `playwright-webkit` dev dependency.
 *
 * The names are Cypress's own detection vocabulary, and one of them is a
 * trap: `chromium` is accepted as a name only when a browser whose binary
 * reports that name is installed (Chrome for Testing, Chromium itself). On a
 * machine — and on every GitHub runner — where the Chromium engine is Google
 * Chrome, `--browser chromium` fails with "invalid browser name" and lists
 * chromium as supported anyway. `chrome` detects everywhere the engine ships.
 *
 * `electron` is deliberately absent. It was the stand-in before the matrix
 * existed and it is the same engine as Chrome one version behind, so it adds
 * runtime without adding evidence.
 */
const SUPPORTED_BROWSERS = Object.freeze(['chrome', 'firefox', 'webkit']);

/** Which engine this process is running, `--browser` first, then env. */
function requestedBrowser(options = {}) {
  return options.browser
    || process.env.JUMENTIX_BROWSER
    || process.argv.find((arg, index) => process.argv[index - 1] === '--browser')
    || 'chrome';
}

function isPackageCypressFile(specRoot, filePath, suffix) {
  const parts = path.relative(specRoot, filePath).split(path.sep);
  return parts.length >= 3 && parts[1] === 'cypress' && parts.at(-1).endsWith(suffix);
}

/** Every `*.cy.ts` directly under a workspace package's `cypress/` directory. */
function findSpecs(root = SPEC_ROOT, list = fs.existsSync(root) ? fs.readdirSync(root) : [], specRoot = root) {
  return list.flatMap((name) => {
    const full = path.join(root, name);
    if (fs.statSync(full).isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name === '.build') return [];
      return findSpecs(full, undefined, specRoot);
    }
    return isPackageCypressFile(specRoot, full, '.cy.ts') ? [full] : [];
  });
}

/**
 * Dedicated Worker entry scripts (`*-worker.ts` under cypress/support).
 *
 * Bundled beside the specs so real-Worker suites can load them via blob URL
 * (JUM-615). Not Cypress specs — they must not be handed to `cypress run`.
 */
function findWorkerEntries(
  root = SPEC_ROOT,
  list = fs.existsSync(root) ? fs.readdirSync(root) : [],
  specRoot = root
) {
  return list.flatMap((name) => {
    const full = path.join(root, name);
    if (fs.statSync(full).isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name === '.build') return [];
      return findWorkerEntries(full, undefined, specRoot);
    }
    return isPackageCypressFile(specRoot, full, '-worker.ts') && full.includes(`${path.sep}cypress${path.sep}support${path.sep}`)
      ? [full]
      : [];
  });
}

/** Where a spec's (or worker entry's) bundle goes: the package name, then the file name. */
function bundlePath(specPath) {
  const relative = path.relative(SPEC_ROOT, specPath);
  const [packageName] = relative.split(path.sep);
  return path.join(BUILD_DIR, packageName, `${path.basename(specPath, '.ts')}.js`);
}

function bundle(specPath, spawn = spawnSync, { instrument = true } = {}) {
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

  // Worker entries run under `self`, not `window`. Istanbul's browser coverage
  // global is `window.__coverage__`, which throws ReferenceError inside a
  // dedicated Worker (JUM-615).
  if (instrument) instrumentBundle(output);

  return { ok: true, output };
}

function buildAll(specs, spawn = spawnSync, options = {}) {
  const failures = [];
  for (const spec of specs) {
    const result = bundle(spec, spawn, options);
    if (!result.ok) failures.push(result.message);
  }
  return failures;
}

function runCypress(spawn, browser, env, attempts = 2) {
  let result;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    result = spawn(
      'bun',
      ['x', 'cypress', 'run', '--e2e', '--browser', browser],
      { stdio: 'inherit', env }
    );
    if (!result.error && result.status === 0) return result;
    if (attempt < attempts) {
      console.warn(`[browser] ${browser} did not start cleanly; retrying once.`);
    }
  }
  return result;
}

function run(options = {}) {
  const spawn = options.spawn || spawnSync;
  const specs = options.specs || findSpecs();
  const browser = requestedBrowser(options);

  if (specs.length === 0) {
    return { ok: false, message: 'No browser specs found under packages/*/cypress/**.cy.ts.' };
  }

  if (!SUPPORTED_BROWSERS.includes(browser)) {
    return {
      ok: false,
      message: `Unsupported browser "${browser}". The matrix is engines: ${SUPPORTED_BROWSERS.join(', ')}.`
    };
  }

  fs.rmSync(BUILD_DIR, { recursive: true, force: true });

  const workers = options.workers || findWorkerEntries();
  const failures = [
    ...buildAll(specs, spawn),
    ...buildAll(workers, spawn, { instrument: false })
  ];
  if (failures.length > 0) {
    return { ok: false, message: failures.join('\n\n') };
  }

  console.log(
    `[browser] bundled ${specs.length} spec(s) and ${workers.length} worker entr(y/ies) with Bun; `
      + `handing specs to Cypress on ${browser}.`
  );

  // Bun exports ELECTRON_RUN_AS_NODE=1 into its children. Cypress's binary is
  // Electron, and under that flag it starts as plain Node: every Electron CLI
  // option is an unknown argument, the smoke test reports `bad option:
  // --no-sandbox`, and the run dies before a spec executes. CI never sees it
  // because nothing there runs under Bun's environment. Deleting the flag for
  // the Cypress child restores the binary it actually is.
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;

  const cypress = runCypress(spawn, browser, env);

  if (cypress.error) {
    return { ok: false, message: `Cypress failed to start: ${cypress.error.message}` };
  }
  if (cypress.status !== 0) {
    return { ok: false, message: `Cypress exited with status ${String(cypress.status)}.` };
  }

  const coverage = writeBrowserCoverage();
  if (!coverage.ok) return coverage;

  // Per-engine evidence. The LCOV is identical per engine — the counters come
  // from the same instrumented bundles — so coverage stays canonical in
  // coverage/browser/ and this file records that the matrix ran and passed.
  const evidence = {
    browser,
    specs: specs.length,
    ranAtUtc: new Date().toISOString(),
    coverage: 'coverage/browser'
  };
  fs.mkdirSync(path.dirname(EVIDENCE_PATH), { recursive: true });
  fs.writeFileSync(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`);

  return {
    ok: true,
    message: `Browser suite passed: ${specs.length} spec(s) on ${browser}. ${coverage.message}`
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
  EVIDENCE_PATH,
  SUPPORTED_BROWSERS,
  bundlePath,
  buildAll,
  findSpecs,
  findWorkerEntries,
  isPackageCypressFile,
  main,
  requestedBrowser,
  runCypress,
  run,
  runAsEntryPoint
};
