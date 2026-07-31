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
 * It reads `coverage/coverage-final.json` — Istanbul's own format — rather than
 * the lcov beside it. The first version read lcov and was wrong in a way worth
 * recording: **lcov has no statement counter.** It carries LF/LH for lines,
 * FNF/FNH for functions and BRF/BRH for branches, and nothing else, so deriving
 * `statements` from the line totals reports lines twice under two names.
 *
 * That is not academic. On the same run, Jest reported 98.86% statements while
 * this checker reported 99.10% — the line figure. The gate would have passed a
 * tree Jest's own threshold rejected, which is precisely the quiet inaccuracy the
 * checker exists to prevent.
 *
 * `coverage-final.json` carries separate `s`, `f` and `b` counter maps, so all
 * four metrics are measured rather than three measured and one aliased. It is
 * produced by the same run that writes the lcov Sonar and Codecov consume.
 */

const fs = require('node:fs');
const path = require('node:path');
const { isEntryPoint } = require('./lib/entry-point.js');

const repoRoot = path.resolve(__dirname, '..');
const reportPath = path.join(repoRoot, 'coverage', 'coverage-final.json');

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
 * Metrics accepted below their threshold, as a ratchet rather than a waiver.
 *
 * `floor` is the measurement at the moment the exception was granted. Coverage
 * at or above the floor passes; **below it fails**, so the exception can only be
 * held or improved, never spent. When a metric reaches its real threshold the
 * entry must be deleted — the checker fails if one is still listed once it is no
 * longer needed, so this cannot quietly become permanent.
 *
 * Why `statements` is here: the 99% figure was calibrated against a coverage
 * scope that excluded `packages/` entirely. Widening it to include
 * `packages/cana/src` — 17 files and 293 tests that had never been measured —
 * moved the tree from 99.26% over the old scope to 98.99% over the new one. The
 * number fell because the measurement improved, not because the code got worse,
 * and narrowing the scope again to recover it would restore the gap JUM-578 was
 * filed about.
 *
 * What remains uncovered is defensive code behind validators: `core/database.ts`
 * aborts a `versionchange` transaction when applying a schema throws, and
 * `validateSchema` rejects every malformed schema before a database is opened,
 * so nothing that reaches that handler is constructible through the public API.
 * `fake-indexeddb` cannot produce the failures it does guard against — quota
 * exhaustion partway through an upgrade, most of all. Closing it needs a real
 * browser, which is JUM-417.
 */
const ACCEPTED_BELOW_THRESHOLD = {
  // Empty, and that is the state to keep it in.
  //
  // One entry lived here for a few hours on 2026-07-31: `statements` at a floor
  // of 98.99% after the coverage scope widened to include `packages/cana/src`
  // (JUM-588). It was removed the same day because the ratchet demanded it — the
  // metric reached 99% and the checker then failed *because the exception was
  // still listed*, which is the behaviour that stops a dated concession becoming
  // a permanently lowered bar.
  //
  // Adding an entry is a governance decision under Requirements 020/063. It needs
  // a floor, a date, an issue and a reason, and it expires by failing.
};

/**
 * Istanbul counter maps, by metric.
 *
 * `s` statements, `f` functions, `b` branches. Each is an object of counter id
 * to hit count; `b` maps to an array per branch point, one entry per path, which
 * is why branches are flattened rather than counted per key.
 */
const COUNTERS = {
  statements: 's',
  functions: 'f',
  branches: 'b'
};

/** Sum found/hit across every file in an Istanbul report. */
function summarize(report) {
  const totals = {
    statements: { found: 0, hit: 0 },
    functions: { found: 0, hit: 0 },
    branches: { found: 0, hit: 0 }
  };

  for (const file of Object.values(report)) {
    for (const [metric, key] of Object.entries(COUNTERS)) {
      const counters = file[key] || {};
      // A branch point holds one count per path, so its paths are the unit.
      const counts = metric === 'branches'
        ? Object.values(counters).flat()
        : Object.values(counters);

      totals[metric].found += counts.length;
      totals[metric].hit += counts.filter((count) => count > 0).length;
    }
  }

  // Istanbul reports lines separately from statements, but the two differ only
  // where one line holds several statements. `lines` is kept as its own metric
  // because Requirements 020/063 name it; it is derived from the statement map's
  // line numbers so it measures lines rather than repeating the statement count.
  totals.lines = lineTotals(report);
  return totals;
}

/** Distinct source lines, and how many of them were hit at least once. */
function lineTotals(report) {
  let found = 0;
  let hit = 0;

  for (const file of Object.values(report)) {
    const byLine = new Map();
    for (const [id, location] of Object.entries(file.statementMap || {})) {
      const line = location.start.line;
      const count = (file.s || {})[id] || 0;
      byLine.set(line, (byLine.get(line) || 0) + count);
    }
    found += byLine.size;
    hit += [...byLine.values()].filter((count) => count > 0).length;
  }

  return { found, hit };
}

/**
 * Format a percentage, rounding **down**.
 *
 * `toFixed` rounds to nearest, so 98.995% prints as "99.00%" — a number that
 * reads as meeting a 99% threshold it does not meet. Truncating keeps the
 * printed figure a lower bound on the real one, which is the only direction a
 * coverage report may err in.
 */
function formatPercentage(value) {
  return (Math.floor(value * 100) / 100).toFixed(2);
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
/**
 * @param exceptions The live exception register. Injected so the ratchet's three
 * behaviours stay testable when the register is empty — which is its normal,
 * desired state. Without this, emptying it would make the ratchet unreachable
 * and its tests vacuous: they would pass while asserting nothing.
 */
function validateCoverage(totals, thresholds = THRESHOLDS, exceptions = ACCEPTED_BELOW_THRESHOLD) {
  const failures = [];
  const report = {};

  const measured = {
    statements: percentage(totals.statements),
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
        `${metric}: the coverage report contains no ${metric} counters, so the ${String(minimum)}% `
          + 'threshold could not be evaluated. A threshold that cannot be checked is not a '
          + 'threshold; fix the report rather than lowering the bar.'
      );
      continue;
    }

    const exception = exceptions[metric];

    if (exception && actual + Number.EPSILON >= minimum) {
      // The exception outlived its reason. Leaving it would turn a dated,
      // tracked concession into a permanently lowered bar that nobody notices.
      failures.push(
        `${metric}: ${formatPercentage(actual)}% now meets the ${String(minimum)}% threshold, but an `
          + `exception is still recorded (${exception.issue}, since ${exception.since}). Remove `
          + 'it from ACCEPTED_BELOW_THRESHOLD and close the issue.'
      );
      continue;
    }

    if (exception) {
      // A ratchet, not a waiver: at or above the recorded floor is accepted,
      // below it fails. The concession can be held or improved, never spent.
      if (actual + Number.EPSILON < exception.floor) {
        failures.push(
          `${metric}: ${formatPercentage(actual)}% is below the accepted floor of `
            + `${String(exception.floor)}% (${exception.issue}). The threshold is `
            + `${String(minimum)}%; this metric is under a tracked exception since `
            + `${exception.since}, and it may not regress further.`
        );
      }
      continue;
    }

    if (actual + Number.EPSILON < minimum) {
      failures.push(
        `${metric}: ${formatPercentage(actual)}% is below the required ${String(minimum)}% `
          + '(Requirements 020 / 063).'
      );
    }
  }

  return { failures, report };
}

/**
 * @param readReport Returns the parsed Istanbul report, or null when there is
 * none. Injected so the CLI's exit paths can be tested without stubbing the real
 * `fs` — a global stub leaks into every other suite sharing the process, which
 * is how ten unrelated tests failed the first time this was covered.
 */
function defaultReadReport() {
  if (!fs.existsSync(reportPath)) return null;
  return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
}

function main(readReport = defaultReadReport, exceptions = ACCEPTED_BELOW_THRESHOLD) {
  const coverage = readReport();

  if (coverage === null) {
    console.error(
      'Coverage threshold check failed: coverage/coverage-final.json does not exist.\n\n'
        + '  Run `bun run test:coverage` first. Treating a missing report as a pass would mean\n'
        + '  the thresholds stop applying the moment coverage stops being produced, which is\n'
        + '  precisely when they matter most.'
    );
    process.exit(1);
  }

  const totals = summarize(coverage);
  const { failures, report } = validateCoverage(totals, THRESHOLDS, exceptions);

  if (failures.length > 0) {
    console.error('Coverage threshold check failed:\n');
    for (const failure of failures) console.error(`  - ${failure}`);
    console.error('');
    process.exit(1);
  }

  const summary = Object.entries(report)
    .map(([metric, value]) => {
      const exception = exceptions[metric];
      const note = exception
        ? ` (under ${exception.issue}, floor ${String(exception.floor)}%)`
        : '';
      return `${metric} ${formatPercentage(value)}%${note}`;
    })
    .join(', ');

  console.log(`Coverage threshold check passed: ${summary}.`);
}

if (isEntryPoint(module)) {
  main();
}

module.exports = {
  ACCEPTED_BELOW_THRESHOLD,
  formatPercentage,
  COUNTERS,
  defaultReadReport,
  lineTotals,
  THRESHOLDS,
  main,
  percentage,
  summarize,
  validateCoverage
};
