#!/usr/bin/env bun
/**
 * Coverage thresholds, enforced from the lcov report rather than by a runner.
 *
 * This exists because deprecating Jest would otherwise drop a threshold in
 * silence. Jest enforced four metrics — `branches: 90`, `functions: 99`,
 * `lines: 99`, `statements: 99` (Requirements 020 / 063). Bun's own
 * `coverageThreshold` understands three: it has no branch metric at all. So
 * removing `jest.config.js` and trusting `bunfig.toml` would leave branch
 * coverage unenforced while every gate still reported green — the exact shape
 * Requirement 065 exists to prevent, arrived at by deleting a config file.
 *
 * `bunfig.toml` already described this file as "the authority for all four
 * metrics". It did not exist. That comment was the plan; this is the thing.
 *
 * Reading lcov rather than asking the runner is what makes it runner-independent:
 * lcov is the same artifact Sonar and Codecov consume, so the numbers enforced
 * here are the numbers reported everywhere else. A runner that miscounts, or one
 * that silently omits a metric, cannot hide from it.
 */

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const lcovPath = path.join(repoRoot, 'coverage', 'lcov.info');

/**
 * The contract, as percentages.
 *
 * Carried over verbatim from the `coverageThreshold.global` block Jest
 * enforced. Lowering any of these is a governance decision under Requirements
 * 020 and 063, not a convenience — which is why they live here as literals with
 * this note rather than being read from a config a runner might stop honouring.
 */
const THRESHOLDS = {
  statements: 99,
  branches: 90,
  functions: 99,
  lines: 99
};

/**
 * lcov counter pairs: found / hit.
 *
 * `LF`/`LH` lines, `FNF`/`FNH` functions, `BRF`/`BRH` branches. lcov has no
 * separate statement counter — every tool that reports both derives statements
 * from lines, so `statements` is checked against the line totals. Stating that
 * rather than quietly reusing the number keeps the report honest about what it
 * measured.
 */
const COUNTERS = {
  lines: { found: 'LF', hit: 'LH' },
  functions: { found: 'FNF', hit: 'FNH' },
  branches: { found: 'BRF', hit: 'BRH' }
};

/** Sum the found/hit counters across every record in an lcov report. */
function summarize(lcov) {
  const totals = {
    lines: { found: 0, hit: 0 },
    functions: { found: 0, hit: 0 },
    branches: { found: 0, hit: 0 }
  };

  for (const line of lcov.split('\n')) {
    const [tag, rawValue] = line.trim().split(':');
    const value = Number(rawValue);
    if (!Number.isFinite(value)) continue;

    for (const [metric, keys] of Object.entries(COUNTERS)) {
      if (tag === keys.found) totals[metric].found += value;
      else if (tag === keys.hit) totals[metric].hit += value;
    }
  }

  return totals;
}

/**
 * Percentage covered, or `null` when nothing of that kind exists.
 *
 * A file with no branches is not 0% branch-covered, and treating it as such
 * would make the metric depend on how much branchless code happens to be in the
 * report. `null` is propagated so the caller decides, rather than being handed a
 * number that looks meaningful.
 */
function percentage({ found, hit }) {
  if (found === 0) return null;
  return (hit / found) * 100;
}

/**
 * Compare a summary against the thresholds.
 *
 * @returns {{failures: string[], report: object}}
 */
function validateCoverage(totals, thresholds = THRESHOLDS) {
  const failures = [];
  const report = {};

  // Statements share the line counters; see COUNTERS.
  const measured = {
    statements: percentage(totals.lines),
    lines: percentage(totals.lines),
    functions: percentage(totals.functions),
    branches: percentage(totals.branches)
  };

  for (const [metric, minimum] of Object.entries(thresholds)) {
    const actual = measured[metric];
    report[metric] = actual;

    if (actual === null) {
      // Fail closed. An empty counter means the report does not measure this,
      // and "unmeasured" must not read as "met" — that is how a threshold
      // disappears without anyone deciding to remove it.
      failures.push(
        `${metric}: the lcov report contains no ${metric} counters, so the ${String(minimum)}% `
          + 'threshold could not be evaluated. A threshold that cannot be checked is not a '
          + 'threshold; fix the report rather than lowering the bar.'
      );
      continue;
    }

    if (actual + Number.EPSILON < minimum) {
      failures.push(
        `${metric}: ${actual.toFixed(2)}% is below the required ${String(minimum)}% `
          + '(Requirements 020 / 063).'
      );
    }
  }

  return { failures, report };
}

function main() {
  if (!fs.existsSync(lcovPath)) {
    console.error(
      'Coverage threshold check failed: coverage/lcov.info does not exist.\n\n'
        + '  Run the suite with coverage first (`bun run test:unit`). Treating a missing report\n'
        + '  as a pass would mean the thresholds stop applying the moment coverage stops being\n'
        + '  produced, which is precisely when they matter most.'
    );
    process.exit(1);
  }

  const totals = summarize(fs.readFileSync(lcovPath, 'utf8'));
  const { failures, report } = validateCoverage(totals);

  if (failures.length > 0) {
    console.error('Coverage threshold check failed:\n');
    for (const failure of failures) console.error(`  - ${failure}`);
    console.error('');
    process.exit(1);
  }

  const summary = Object.entries(report)
    .map(([metric, value]) => `${metric} ${value.toFixed(2)}%`)
    .join(', ');

  console.log(`Coverage threshold check passed: ${summary}.`);
}

if (require.main === module) {
  main();
}

module.exports = {
  COUNTERS,
  THRESHOLDS,
  main,
  percentage,
  summarize,
  validateCoverage
};
