/* eslint-disable no-console */
/**
 * Requirements 134 and 135 — the mechanical half of "no flaky, no fake".
 *
 * Judgement cannot be gated. These four conditions can:
 *
 *  1. A suite with no assertion declaration. A test whose `expect` never runs —
 *     inside an unentered branch, after an unawaited promise — passes. 38 of
 *     296 suites had none.
 *  2. A suite that asserts only on mocks. `toHaveBeenCalled` says a function
 *     ran; whether the write landed is the question that matters.
 *  3. A fixed sleep used as synchronisation. Waiting a set number of
 *     milliseconds is a race with a comfortable margin, and the margin is
 *     whatever CI happens to have left.
 *  4. A suite outside `test-map.json`. The map is the target list; a suite
 *     nothing selects is a suite nobody runs, reporting nothing.
 *
 * Registers, not exemptions: an entry names the issue that owns it, and a
 * register entry whose file no longer exists is itself a failure, because a
 * stale exemption is how a register stops meaning anything.
 */
const fs = require('fs');
const path = require('path');
const { isEntryPoint } = require('./lib/entry-point.js');

const TEST_ROOTS = ['apps', 'packages'];
const SKIP_DIRECTORIES = new Set(['node_modules', 'dist', 'build', 'coverage', '.next']);

/** Declares that the test asserts. */
const ASSERTION_DECLARATIONS = /expect\.hasAssertions\(\)|expect\.assertions\(/;

/**
 * Asserts on content rather than merely on the fact of a call.
 *
 * `toHaveBeenCalledWith` belongs here, and leaving it out was a measurement
 * error (JUM-678). It asserts the argument — for a handler whose whole effect
 * is `res.json(payload)`, the argument *is* the effect. The first sweep counted
 * fourteen suites as "mock-only" on the strength of the substring
 * `toHaveBeenCalled`; every one of them was in fact asserting a payload.
 *
 * What stays reportable is the bare form: `toHaveBeenCalled()` and
 * `toHaveBeenCalledTimes(n)` say a function ran and nothing about what it did.
 */
const STATE_ASSERTIONS = /\.(toBe|toEqual|toStrictEqual|toMatchObject|toContain|toHaveLength|toThrow|toBeTruthy|toBeFalsy|toBeDefined|toBeUndefined|toBeNull|toBeGreaterThan|toBeLessThan|toMatchSnapshot|toHaveBeenCalledWith|toHaveBeenLastCalledWith|resolves|rejects)\b/;

/** `setTimeout(resolve, 40)` and friends: a sleep, not a timeout. */
const FIXED_SLEEP = /setTimeout\(\s*(?:resolve|\(\)\s*=>\s*resolve\([^)]*\))\s*,\s*(\d+)/g;

/**
 * Sleeps that are accepted, each with the issue that owns the decision.
 *
 * **Empty since JUM-679.** All five files were fixed rather than exempted:
 * three hold a promise open under the test's control, one drives the injected
 * scheduler the client already accepted, and the broker suite polls with a
 * bound. A zero-millisecond flush is not in this class and is not counted.
 */
const ACCEPTED_SLEEPS = Object.freeze([]);

/**
 * Suites that assert only on mocks.
 *
 * **Empty since JUM-678, and not because they were fixed.** The fourteen
 * entries were a measurement error: the rule matched the substring
 * `toHaveBeenCalled`, so `toHaveBeenCalledWith(payload)` counted as asserting
 * nothing. It asserts the payload. The rule is corrected above; the register is
 * empty because there was never anything in it.
 */
const ACCEPTED_MOCK_ONLY = Object.freeze([]);

/**
 * Suites with no assertion declaration.
 *
 * **Empty since JUM-677**: 644 declarations were added across the 31 files and
 * every test still passed, which is the honest result — none of them had been
 * asserting nothing. The declaration is now what makes that true tomorrow as
 * well as today.
 */
const ACCEPTED_NO_ASSERTIONS = Object.freeze([]);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name) || entry.name.startsWith('.')) continue;
      walk(absolute, out);
      continue;
    }
    // Suites live under `test/` in the backend and the packages, and beside the
    // component they cover in the website (JUM-680). Both are suites; only the
    // convention differs, and a convention is not a reason to be unchecked.
    const isSuite = /\.test\.(ts|tsx|js|mjs)$/.test(entry.name);
    const underTestDir = absolute.includes(`${path.sep}test${path.sep}`);
    const inWebsite = absolute.includes(`${path.sep}jumentix-website${path.sep}`);
    if (isSuite && (underTestDir || inWebsite)) {
      out.push(absolute);
    }
  }
  return out;
}

function mappedSuites(rootDir) {
  const mapPath = path.join(rootDir, 'test-map.json');
  if (!fs.existsSync(mapPath)) return null;
  const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  const ids = new Set((map.suites || []).map((suite) => suite.id));
  for (const entry of map.quarantine || []) ids.add(entry.path);
  return ids;
}

function fixedSleeps(source) {
  return [...source.matchAll(FIXED_SLEEP)].map((match) => Number(match[1]));
}

function validateTestIntegrity(rootDir = process.cwd(), options = {}) {
  const acceptedSleeps = options.acceptedSleeps || ACCEPTED_SLEEPS;
  const acceptedMockOnly = options.acceptedMockOnly || ACCEPTED_MOCK_ONLY;
  const acceptedNoAssertions = options.acceptedNoAssertions || ACCEPTED_NO_ASSERTIONS;
  const failures = [];
  const files = TEST_ROOTS.flatMap((root) => walk(path.join(rootDir, root)));
  const mapped = mappedSuites(rootDir);
  const sleepRegister = new Map(acceptedSleeps.map((entry) => [entry.file, entry]));
  const mockRegister = new Map(acceptedMockOnly.map((entry) => [entry.file, entry]));
  const assertRegister = new Map(acceptedNoAssertions.map((entry) => [entry.file, entry]));
  const seenSleep = new Set();
  const seenMock = new Set();
  const seenAssert = new Set();

  for (const absolute of files) {
    const relative = path.relative(rootDir, absolute).split(path.sep).join('/');
    const source = fs.readFileSync(absolute, 'utf8');

    if (!ASSERTION_DECLARATIONS.test(source)) {
      const declared = assertRegister.get(relative);
      if (declared) seenAssert.add(relative);
      else failures.push(
        `[test-integrity] ${relative} declares no assertions. Add \`expect.hasAssertions()\``
        + ' to each test: an expect that never runs is a test that passes for free'
        + ' (Requirement 135 §2).'
      );
    }

    if (/toHaveBeenCalled/.test(source) && !STATE_ASSERTIONS.test(source)) {
      const exemption = mockRegister.get(relative);
      if (exemption) seenMock.add(relative);
      else {
        failures.push(
          `[test-integrity] ${relative} asserts only that functions were called.`
          + ' Assert the effect — the row, the response, the state — not the call'
          + ' (Requirement 135 §1).'
        );
      }
    }

    const sleeps = fixedSleeps(source).filter((ms) => ms > 0);
    if (sleeps.length > 0) {
      const exemption = sleepRegister.get(relative);
      if (exemption) seenSleep.add(relative);
      else {
        failures.push(
          `[test-integrity] ${relative} sleeps ${sleeps.join('ms, ')}ms as synchronisation.`
          + ' Wait on the event or poll the condition; a fixed wait is a race with a'
          + ' margin, and the margin is whatever CI has left (Requirement 134 §2).'
        );
      }
    }

    if (mapped && !mapped.has(relative)) {
      failures.push(
        `[test-integrity] ${relative} is not in test-map.json. The map is the target`
        + ' list, so a suite outside it is a suite nothing runs (Requirement 135 §6).'
      );
    }
  }

  const present = new Set(files.map((f) => path.relative(rootDir, f).split(path.sep).join('/')));
  for (const [file, entry] of sleepRegister) {
    if (!present.has(file)) {
      failures.push(
        `[test-integrity] ACCEPTED_SLEEPS lists ${file} (${entry.issue}), which no longer`
        + ' exists. Remove the entry — a stale exemption hides the next real one.'
      );
    } else if (!seenSleep.has(file)) {
      failures.push(
        `[test-integrity] ACCEPTED_SLEEPS lists ${file} (${entry.issue}), which no longer`
        + ' sleeps. Remove the entry.'
      );
    }
  }
  for (const [file, entry] of assertRegister) {
    if (!seenAssert.has(file)) {
      failures.push(
        `[test-integrity] ACCEPTED_NO_ASSERTIONS lists ${file} (${entry.issue}), which now`
        + ' declares assertions or no longer exists. Remove the entry.'
      );
    }
  }
  for (const [file, entry] of mockRegister) {
    if (!seenMock.has(file)) {
      failures.push(
        `[test-integrity] ACCEPTED_MOCK_ONLY lists ${file} (${entry.issue}), which no`
        + ' longer matches. Remove the entry.'
      );
    }
  }

  return failures;
}

function run(rootDir = process.cwd()) {
  const failures = validateTestIntegrity(rootDir);
  if (failures.length > 0) {
    failures.forEach((failure) => console.error(failure));
    console.error(`\n[test-integrity] ${failures.length} finding(s).`);
    return 1;
  }
  console.log('Test integrity check passed: every suite declares assertions, asserts state, waits on events and is mapped.');
  return 0;
}

if (isEntryPoint(module)) {
  process.exitCode = run();
}

module.exports = {
  ACCEPTED_SLEEPS,
  ACCEPTED_MOCK_ONLY,
  ACCEPTED_NO_ASSERTIONS,
  fixedSleeps,
  run,
  validateTestIntegrity
};
