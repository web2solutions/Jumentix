/* eslint-disable no-console */
/**
 * Requirement 138 §4 / JUM-19 — the lint runner that cannot false-green.
 *
 * Runs ESLint once per surface, then proves the run meant something:
 *
 * 1. ESLint's own exit code is propagated — no `|| true`, no swallowed
 *    failures, and `--max-warnings=0` turns warnings into failures.
 * 2. Zero discovered files is a hard failure — an empty glob reads as
 *    "0 problems" to a bare eslint run, which is exactly the false-green this
 *    runner exists to kill.
 * 3. A file count below the recorded floor fails — coverage that shrinks
 *    silently (an over-broad new ignore, a renamed directory) is caught here
 *    instead of at the next incident. Floors live in
 *    `ci-cd/lint-coverage-floors.json` and are only lowered deliberately, in a
 *    commit that says why.
 *
 * Proof lives in `ci-cd/test/run-lint.test.ts`: a negative fixture makes the
 * runner exit non-zero, an emptied glob is caught, and a clean fixture passes.
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');

const { isEntryPoint } = require('./lib/entry-point.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const FLOORS_PATH = path.join(__dirname, 'lint-coverage-floors.json');

const SURFACES = Object.freeze({
  root: { cwd: REPO_ROOT },
  frontend: { cwd: path.join(REPO_ROOT, 'apps/frontend') },
  website: { cwd: path.join(REPO_ROOT, 'apps/jumentix-website') }
});

function loadFloors() {
  if (!fs.existsSync(FLOORS_PATH)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(FLOORS_PATH, 'utf8'));
}

function eslintEntrypoint() {
  // Resolve from the repository root so tests can point the runner at fixture
  // trees outside the repo without bun falling back to a registry fetch.
  // eslint's exports map does not expose ./bin/eslint.js, so resolve the
  // package entry and walk to the bin sibling.
  const repoRequire = createRequire(path.join(REPO_ROOT, 'package.json'));
  const packageEntry = repoRequire.resolve('eslint');
  return path.join(path.dirname(packageEntry), '..', 'bin', 'eslint.js');
}

/**
 * Runs eslint for one surface. Returns { code, files, errors, warnings }.
 * `options.cwd` and `options.floor` override the surface defaults (tests).
 */
function runLintSurface(surface, options = {}) {
  const definition = SURFACES[surface];
  const cwd = options.cwd ?? (definition ? definition.cwd : undefined);
  if (!cwd) {
    console.error(`[lint] unknown surface: ${surface}`);
    return { code: 2, files: 0, errors: 0, warnings: 0 };
  }
  const floors = loadFloors();
  const floor = options.floor ?? floors[surface] ?? null;

  const run = spawnSync(
    process.execPath,
    [eslintEntrypoint(), '.', '--format', 'json', '--max-warnings=0'],
    {
      cwd,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=8192' }
    }
  );

  if (run.error) {
    console.error(`[lint] ${surface}: eslint failed to start: ${run.error.message}`);
    return { code: 2, files: 0, errors: 0, warnings: 0 };
  }

  let results = null;
  try {
    results = JSON.parse(run.stdout || '[]');
  } catch {
    // eslint prints config crashes to stderr with no JSON payload.
    console.error(`[lint] ${surface}: eslint produced no JSON report (exit ${run.status})`);
    process.stderr.write(run.stderr || '');
    return { code: 2, files: 0, errors: 0, warnings: 0 };
  }

  const files = results.length;
  const errors = results.reduce((total, file) => total + file.errorCount, 0);
  const warnings = results.reduce((total, file) => total + file.warningCount, 0);

  if (files === 0) {
    console.error(
      `[lint] ${surface}: eslint matched zero files — refusing to report a false green`
    );
    return { code: 2, files, errors, warnings };
  }
  if (floor !== null && files < floor) {
    console.error(
      `[lint] ${surface}: ${files} files linted, below the recorded floor of ${floor} — ` +
        'coverage shrank; update ci-cd/lint-coverage-floors.json only deliberately, with the reason in the commit'
    );
    return { code: 2, files, errors, warnings };
  }

  console.log(
    `[lint] ${surface}: ${files} files linted, ${errors} errors, ${warnings} warnings${
      floor !== null ? ` (floor ${floor})` : ''
    }`
  );
  if (run.status !== 0) {
    // eslint already explained itself on stdout-as-JSON; surface the summary.
    console.error(
      `[lint] ${surface}: eslint exited ${run.status} with ${errors} errors / ${warnings} warnings`
    );
  }
  return { code: run.status ?? 2, files, errors, warnings };
}

function main(argv) {
  const surface = argv[2] || 'root';
  const options = {};
  const cwdIndex = argv.indexOf('--cwd');
  if (cwdIndex !== -1) options.cwd = argv[cwdIndex + 1];
  const floorIndex = argv.indexOf('--floor');
  if (floorIndex !== -1) options.floor = Number(argv[floorIndex + 1]);
  return runLintSurface(surface, options).code;
}

module.exports = { main, runLintSurface };

if (isEntryPoint(module)) {
  process.exitCode = main(process.argv);
}
