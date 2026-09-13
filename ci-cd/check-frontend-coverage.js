#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Frontend coverage gate (JUM-776, Requirement 112).
 *
 * `apps/frontend` runs on `bun:test` — its `.vue` components mount through
 * @vue/test-utils with a Bun SFC loader — and Bun writes lcov, not Istanbul
 * JSON. `check-coverage-thresholds.js` reads Istanbul counters on purpose
 * (Requirement 110 §3: lcov has no statement counter), so the frontend cannot
 * be folded into that report without inventing numbers. This gate reads the
 * frontend lcov for the two counters lcov does carry — lines and functions —
 * and says so in its output. Branches are not measured for this app: Bun
 * emits no BRDA records (Requirement 110 §2), and a threshold that cannot be
 * measured is reported as unmeasured, never as met.
 *
 * Scope: every file under `apps/frontend/src/` the suites touched, plus every
 * `.ts`/`.vue` source file they did not touch, counted at 0 — an untested
 * component must lower the number, not vanish from it.
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const DEFAULT_REPORT = path.join(repoRoot, 'coverage', 'frontend', 'lcov.info');
const APP_ROOT = path.join(repoRoot, 'apps', 'frontend');
const SOURCE_ROOT = path.join(APP_ROOT, 'src');

/**
 * Lines and functions, as percentages. Set at the measured baseline of the
 * first gated run (JUM-776) and meant to ratchet upward toward the 98% the
 * rest of the repository holds; lowering either is a governance decision.
 */
const THRESHOLDS = {
  lines: 85,
  functions: 80
};

/** Files that are runtime wiring with no unit-testable behaviour. */
const EXCLUDED = [
  /\/src\/main\.ts$/,
  /\/src\/env\.d\.ts$/,
  /\/src\/router\/index\.ts$/,
  /\/src\/App\.vue$/,
  /\/src\/contracts\/openapi\.json$/,
  /\/src\/contracts\/sharedContractsBrowserShim\.ts$/,
  /\/src\/styles\//
];

function parseLcov(text) {
  const files = new Map();
  let current = null;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line.startsWith('SF:')) {
      // Bun writes SF entries relative to the directory it ran in (the app).
      current = {
        path: path.resolve(APP_ROOT, line.slice(3)), lf: 0, lh: 0, fnf: 0, fnh: 0
      };
    } else if (line.startsWith('LF:') && current) current.lf = Number(line.slice(3));
    else if (line.startsWith('LH:') && current) current.lh = Number(line.slice(3));
    else if (line.startsWith('FNF:') && current) current.fnf = Number(line.slice(4));
    else if (line.startsWith('FNH:') && current) current.fnh = Number(line.slice(4));
    else if (line === 'end_of_record' && current) {
      files.set(current.path, current);
      current = null;
    }
  }
  return files;
}

function listSources(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listSources(full, out);
    else if (/\.(ts|vue)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function isSubject(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  return normalized.startsWith(SOURCE_ROOT.replace(/\\/g, '/'))
    && !EXCLUDED.some((pattern) => pattern.test(normalized));
}

/** Untouched sources count as 0/LF where LF is estimated from line count. */
function countLines(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return text.split('\n').filter((line) => line.trim().length > 0).length;
}

function summarize(files, sources) {
  const totals = { lines: { found: 0, hit: 0 }, functions: { found: 0, hit: 0 } };
  const untouched = [];
  for (const source of sources) {
    const record = files.get(source);
    if (record) {
      totals.lines.found += record.lf;
      totals.lines.hit += record.lh;
      totals.functions.found += record.fnf;
      totals.functions.hit += record.fnh;
    } else {
      untouched.push(path.relative(repoRoot, source));
      totals.lines.found += countLines(source);
    }
  }
  return { totals, untouched };
}

const percentage = ({ found, hit }) => (found === 0 ? 100 : (hit / found) * 100);

function run({ reportPath = DEFAULT_REPORT, thresholds = THRESHOLDS } = {}) {
  if (!fs.existsSync(reportPath)) {
    return {
      ok: false,
      messages: [
        `Frontend coverage check failed: ${path.relative(repoRoot, reportPath)} does not exist.`,
        '  Run `bun run frontend:test:coverage` first; a missing report is not a pass (Requirement 065).'
      ]
    };
  }
  const files = parseLcov(fs.readFileSync(reportPath, 'utf8'));
  const sources = listSources(SOURCE_ROOT).filter(isSubject);
  const { totals, untouched } = summarize(files, sources);
  const messages = [];
  let ok = true;
  for (const metric of Object.keys(thresholds)) {
    const value = percentage(totals[metric]);
    const line = `  ${metric.padEnd(10)} ${value.toFixed(2)}% (${totals[metric].hit}/${totals[metric].found}) threshold ${thresholds[metric]}%`;
    if (value + 1e-9 < thresholds[metric]) {
      ok = false;
      messages.push(`${line}  FAIL`);
    } else {
      messages.push(line);
    }
  }
  messages.push('  branches   unmeasured — bun emits no branch records (Requirement 110 §2); not counted as met.');
  if (untouched.length) {
    messages.push(`  untouched sources counted at 0 lines hit (${untouched.length}):`);
    untouched.forEach((file) => messages.push(`    - ${file}`));
  }
  return { ok, messages, totals, untouched };
}

module.exports = {
  THRESHOLDS, EXCLUDED, parseLcov, isSubject, summarize, run
};

if (require.main === module) {
  const result = run();
  console.log(result.ok ? 'Frontend coverage check passed.' : 'Frontend coverage check failed.');
  result.messages.forEach((message) => console.log(message));
  process.exit(result.ok ? 0 : 1);
}
