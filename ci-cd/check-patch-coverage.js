#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { emitsNoJavaScript } = require('./lib/emits-javascript.js');

const ROOT = process.cwd();
const LCOV_PATH = process.env.JUMENTIX_MERGED_LCOV
  || path.join(ROOT, 'coverage', 'merged', 'lcov.info');
const LCOV_FALLBACK = path.join(ROOT, 'coverage', 'lcov.info');
const threshold = Number(process.env.PATCH_COVERAGE_THRESHOLD || '99');
// JUM-555: under selective gates, only evaluate files owned by selected layers.
const selectedLayers = String(process.env.JUMENTIX_SELECTED_LAYERS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

/**
 * Files that are not subjects of coverage, and why each exclusion is safe.
 *
 * The rule below — a changed file with no lcov entry has every changed line
 * counted as uncovered — is the right default for source: a new module nobody
 * tested has no lcov entry, and silently ignoring it is exactly the false green
 * Requirement 065 forbids.
 *
 * It is wrong for two categories, and being wrong here is not cosmetic. A test
 * file never appears in lcov, because it is the instrument, not the subject; so
 * every test added counted against patch coverage, and writing more tests made
 * the number worse. On a branch carrying 51 changed test files that produced
 * 8467 "uncovered" lines and a gate nobody could pass by testing harder.
 *
 * The second category is files `jest.config.js` deliberately excludes from
 * measurement. Those are read from the Jest configuration rather than restated
 * here: a second list would drift, and the moment it drifts one of the two is
 * silently wrong.
 */
const TEST_FILE = /(^|\/)test\/|\.test\.ts$|\.spec\.ts$/;

const coverageIgnorePatterns = (() => {
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const jestConfig = require(path.join(ROOT, 'jest.config.js'));
    return (jestConfig.coveragePathIgnorePatterns || [])
      .map((pattern) => new RegExp(pattern.replace('<rootDir>', ROOT)));
  } catch {
    // No config to read: measure everything rather than assume an exclusion.
    return [];
  }
})();

/**
 * Istanbul's own file-level opt-out, honoured here for the same reason the Jest
 * ignore patterns are: it is a declared, reviewable exclusion, and a file the
 * instrumenter was told to skip can never appear in the report. Counting its
 * lines as uncovered turns a deliberate decision into an unpayable debt —
 * `start-rest-api.ts` carries the pragma because importing its adapter table
 * boots real HTTP servers, and it contributed 48 unreachable misses.
 */
const ISTANBUL_IGNORE_FILE = /\/\*\s*istanbul\s+ignore\s+file\s*\*\//;

const isCoverageSubject = (file) => {
  if (TEST_FILE.test(file)) return false;
  const absolute = path.join(ROOT, file);
  if (coverageIgnorePatterns.some((pattern) => pattern.test(absolute))) return false;
  if (!fs.existsSync(absolute)) return false;
  if (ISTANBUL_IGNORE_FILE.test(fs.readFileSync(absolute, 'utf8'))) return false;
  return !emitsNoJavaScript(absolute);
};

const run = (cmd) => cp.execSync(cmd, {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
  maxBuffer: 1024 * 1024 * 32
}).trim();

const resolveBaseRef = () => {
  const candidates = [
    'origin/main',
    'main'
  ];
  for (const candidate of candidates) {
    try {
      run(`git rev-parse --verify ${candidate}`);
      return candidate;
    } catch (error) {
      // keep trying candidates
    }
  }
  throw new Error('Could not resolve base ref (origin/main or main).');
};

const normalizeFilePath = (raw) => {
  if (!raw) return '';
  const clean = raw.replace(/\\/g, '/');
  if (path.isAbsolute(clean)) {
    return path.relative(ROOT, clean).replace(/\\/g, '/');
  }
  return clean.replace(/^\.\//, '');
};

const parseChangedLines = (diffText) => {
  const changed = new Map();
  let currentFile = '';
  let currentLine = 0;

  const ensure = (file) => {
    if (!changed.has(file)) changed.set(file, new Set());
    return changed.get(file);
  };

  for (const line of diffText.split('\n')) {
    if (line.startsWith('+++ b/')) {
      currentFile = normalizeFilePath(line.slice(6));
      continue;
    }
    if (line.startsWith('@@')) {
      const match = line.match(/\+(\d+)(?:,(\d+))?/);
      if (match) {
        currentLine = Number(match[1]);
      }
      continue;
    }
    if (!currentFile || !currentFile.endsWith('.ts')) continue;
    if (line.startsWith('+') && !line.startsWith('+++')) {
      ensure(currentFile).add(currentLine);
      currentLine += 1;
      continue;
    }
    if (line.startsWith('-') && !line.startsWith('---')) {
      continue;
    }
    currentLine += 1;
  }

  return changed;
};

const parseLcov = (lcovText) => {
  const fileLineHits = new Map();
  let currentFile = '';

  for (const line of lcovText.split('\n')) {
    if (line.startsWith('SF:')) {
      currentFile = normalizeFilePath(line.slice(3));
      if (!fileLineHits.has(currentFile)) fileLineHits.set(currentFile, new Map());
      continue;
    }
    if (line.startsWith('DA:') && currentFile) {
      const [lineNumberRaw, hitsRaw] = line.slice(3).split(',');
      const lineNumber = Number(lineNumberRaw);
      const hits = Number(hitsRaw);
      if (!Number.isNaN(lineNumber) && !Number.isNaN(hits)) {
        fileLineHits.get(currentFile).set(lineNumber, hits);
      }
    }
  }

  return fileLineHits;
};

const fileOwnedBySelectedLayers = (file) => {
  if (selectedLayers.length === 0) return true;
  try {
    // Lazy require keeps this script usable without a manifest.
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const { readTestMap } = require('./lib/test-map');
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const { layersForFile } = require('./lib/layer-resolver');
    const manifest = readTestMap(path.join(ROOT, 'test-map.json'));
    const layers = layersForFile(manifest, file);
    if (layers.length === 0) {
      // Unknown ownership under selective mode → ignore (not 0%, not false green).
      return false;
    }
    return layers.some((layer) => selectedLayers.includes(layer));
  } catch {
    return true;
  }
};

const main = () => {
  const lcovPath = fs.existsSync(LCOV_PATH) ? LCOV_PATH : LCOV_FALLBACK;
  if (!fs.existsSync(lcovPath)) {
    throw new Error(`Coverage file not found at ${LCOV_PATH} or ${LCOV_FALLBACK}. Run unit tests with coverage first.`);
  }

  const baseRef = resolveBaseRef();
  const diff = run(`git diff --unified=0 --no-color ${baseRef}...HEAD -- '*.ts'`);
  const changedLinesByFile = parseChangedLines(diff);
  const lcov = fs.readFileSync(lcovPath, 'utf8');
  const lcovByFile = parseLcov(lcov);

  let covered = 0;
  let total = 0;
  let ignoredUnselected = 0;
  let ignoredNotSubject = 0;
  const missing = [];

  for (const [file, lines] of changedLinesByFile.entries()) {
    if (!isCoverageSubject(file)) {
      ignoredNotSubject += lines.size;
      continue;
    }
    if (!fileOwnedBySelectedLayers(file)) {
      ignoredUnselected += lines.size;
      continue;
    }
    const lineHits = lcovByFile.get(file);
    if (!lineHits) {
      // Selective reconciliation (JUM-555): missing coverage for a selected
      // file fails closed; missing coverage for unselected layers is ignored above.
      for (const ln of lines.values()) missing.push(`${file}:${ln}`);
      total += lines.size;
      continue;
    }
    for (const ln of lines.values()) {
      if (!lineHits.has(ln)) continue;
      total += 1;
      const hits = lineHits.get(ln);
      if (hits > 0) {
        covered += 1;
      } else {
        missing.push(`${file}:${ln}`);
      }
    }
  }

  if (ignoredNotSubject > 0) {
    console.log(
      `[patch-coverage] ignored ${ignoredNotSubject} changed line(s) in test files and in `
        + 'paths jest.config.js excludes from coverage'
    );
  }

  if (ignoredUnselected > 0) {
    console.log(`[patch-coverage] ignored ${ignoredUnselected} changed line(s) outside JUMENTIX_SELECTED_LAYERS=[${selectedLayers.join(',')}]`);
  }

  if (total === 0) {
    console.log(`[patch-coverage] No changed executable TypeScript lines found. threshold=${threshold}%`);
    process.exit(0);
  }

  const pct = Number(((covered / total) * 100).toFixed(2));
  console.log(`[patch-coverage] ${pct}% (${covered}/${total}) threshold=${threshold}%`);

  if (pct < threshold) {
    console.error('[patch-coverage] FAIL: patch coverage below threshold.');
    if (missing.length > 0) {
      console.error('[patch-coverage] Missing lines:');
      missing.slice(0, 80).forEach((entry) => console.error(`  - ${entry}`));
      if (missing.length > 80) {
        console.error(`  ... and ${missing.length - 80} more`);
      }
    }
    process.exit(1);
  }

  console.log('[patch-coverage] PASS');
};

try {
  main();
} catch (error) {
  console.error('[patch-coverage] ERROR:', error.message);
  process.exit(1);
}
