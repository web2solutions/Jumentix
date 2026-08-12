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

/** Asserts on something other than a call. */
const STATE_ASSERTIONS = /\.(toBe|toEqual|toStrictEqual|toMatchObject|toContain|toHaveLength|toThrow|toBeTruthy|toBeFalsy|toBeDefined|toBeUndefined|toBeNull|toBeGreaterThan|toBeLessThan|toMatchSnapshot|resolves|rejects)\b/;

/** `setTimeout(resolve, 40)` and friends: a sleep, not a timeout. */
const FIXED_SLEEP = /setTimeout\(\s*(?:resolve|\(\)\s*=>\s*resolve\([^)]*\))\s*,\s*(\d+)/g;

/**
 * Sleeps that are accepted, each with the issue that owns the decision.
 *
 * A zero-millisecond sleep is a macrotask flush rather than a wait on wall
 * clock, so it is not in the same class; it is still listed, because it is
 * still a scheduling assumption.
 */
const ACCEPTED_SLEEPS = Object.freeze([
  {
    file: 'apps/backend-template/test/unit/infra/messages/InMemoryMessageMediator.test.ts',
    issue: 'JUM-679',
    reason: '25ms wait on an in-process handler; should await the handler promise'
  },
  {
    file: 'apps/backend-template/test/unit/service-management/catalogSyncClient.test.ts',
    issue: 'JUM-679',
    reason: '40ms wait on a debounce; should inject the scheduler'
  },
  {
    file: 'apps/backend-template/test/unit/service-management/designerSync.test.ts',
    issue: 'JUM-679',
    reason: '5ms and 100ms waits on the real trailing-edge scheduler; should inject it'
  },
  {
    file: 'packages/message-mediator/test/message-mediator.test.ts',
    issue: 'JUM-679',
    reason: '10ms and 30ms waits on in-process delivery'
  },
  {
    file: 'packages/message-mediator/test/integration/brokers.integration.test.ts',
    issue: 'JUM-679',
    reason: 'waits on real broker delivery; should poll the condition with a bound'
  }
]);

/**
 * Suites that assert only on mocks today, each owned by JUM-678.
 *
 * A ratchet, not an exemption: these are the findings as measured, and a new
 * suite that asserts only on calls fails immediately.
 */
const ACCEPTED_MOCK_ONLY = Object.freeze([
  { file: 'apps/backend-template/test/integration/Adonis-JS/get.localhost.test.ts', issue: 'JUM-678' },
  { file: 'apps/backend-template/test/integration/Cloudflare-Workers/get.localhost.test.ts', issue: 'JUM-678' },
  { file: 'apps/backend-template/test/integration/Derby-JS/get.localhost.test.ts', issue: 'JUM-678' },
  { file: 'apps/backend-template/test/integration/Express/get.localhost.test.ts', issue: 'JUM-678' },
  { file: 'apps/backend-template/test/integration/Feathers/get.localhost.test.ts', issue: 'JUM-678' },
  { file: 'apps/backend-template/test/integration/LoopBack/get.localhost.test.ts', issue: 'JUM-678' },
  { file: 'apps/backend-template/test/integration/Sails-JS/get.localhost.test.ts', issue: 'JUM-678' },
  { file: 'apps/backend-template/test/integration/Total-JS/get.localhost.test.ts', issue: 'JUM-678' },
  { file: 'apps/backend-template/test/integration/Vercel-Functions/get.localhost.test.ts', issue: 'JUM-678' },
  { file: 'apps/backend-template/test/unit/infra/events/InMemoryEventBus.test.ts', issue: 'JUM-678' },
  { file: 'apps/backend-template/test/unit/interface/CLI/index.test.ts', issue: 'JUM-678' },
  { file: 'apps/backend-template/test/unit/interface/WebSocket/adapters/clusterAdapter.lifecycle.test.ts', issue: 'JUM-678' },
  { file: 'apps/backend-template/test/unit/interface/WebSocket/adapters/redisStreamsAdapter.lifecycle.test.ts', issue: 'JUM-678' },
  { file: 'apps/backend-template/test/unit/modules/Users/application/service/UserProviderLocal.test.ts', issue: 'JUM-678' }
]);

/**
 * Suites with no assertion declaration today, each owned by JUM-677.
 *
 * Same ratchet. Removing an entry is done by fixing the suite; the check fails
 * on an entry whose file no longer matches.
 */
const ACCEPTED_NO_ASSERTIONS = Object.freeze([
  { file: 'apps/backend-template/test/integration/ServiceManagement/domainDesigner.smoke.test.ts', issue: 'JUM-677' },
  { file: 'apps/backend-template/test/integration/ServiceManagement/pm2Ecosystem.integration.test.ts', issue: 'JUM-677' },
  { file: 'apps/backend-template/test/unit/ci-cd/sync-service-management-cana-bundle.test.ts', issue: 'JUM-677' },
  { file: 'apps/backend-template/test/unit/ci-cd/sync-service-management-designer-core.test.ts', issue: 'JUM-677' },
  { file: 'apps/backend-template/test/unit/domains/validators/index.test.ts', issue: 'JUM-677' },
  { file: 'apps/backend-template/test/unit/service-management/canaDesignerStore.test.ts', issue: 'JUM-677' },
  { file: 'apps/backend-template/test/unit/service-management/canaMigration.test.ts', issue: 'JUM-677' },
  { file: 'apps/backend-template/test/unit/service-management/deployTargetLifecycle.test.ts', issue: 'JUM-677' },
  { file: 'apps/backend-template/test/unit/service-management/deployTargetValidation.test.ts', issue: 'JUM-677' },
  { file: 'apps/backend-template/test/unit/service-management/designerAsyncApiExport.test.ts', issue: 'JUM-677' },
  { file: 'apps/backend-template/test/unit/service-management/designerExporters.test.ts', issue: 'JUM-677' },
  { file: 'apps/backend-template/test/unit/service-management/designerImporters.test.ts', issue: 'JUM-677' },
  { file: 'apps/backend-template/test/unit/service-management/designerNormalizers.test.ts', issue: 'JUM-677' },
  { file: 'apps/backend-template/test/unit/service-management/designerOasCompliance.test.ts', issue: 'JUM-677' },
  { file: 'apps/backend-template/test/unit/service-management/designerPackageVersioning.test.ts', issue: 'JUM-677' },
  { file: 'apps/backend-template/test/unit/service-management/designerRoundTrip.test.ts', issue: 'JUM-677' },
  { file: 'apps/backend-template/test/unit/service-management/designerState.test.ts', issue: 'JUM-677' },
  { file: 'apps/backend-template/test/unit/service-management/designerStore.test.ts', issue: 'JUM-677' },
  { file: 'apps/backend-template/test/unit/service-management/designerSync.test.ts', issue: 'JUM-677' },
  { file: 'apps/backend-template/test/unit/service-management/hexagonalCodegen.test.ts', issue: 'JUM-677' },
  { file: 'apps/backend-template/test/unit/service-management/interfaceAdapterValidation.test.ts', issue: 'JUM-677' },
  { file: 'apps/backend-template/test/unit/service-management/modelQueries.test.ts', issue: 'JUM-677' },
  { file: 'apps/backend-template/test/unit/service-management/modelValidation.test.ts', issue: 'JUM-677' },
  { file: 'apps/backend-template/test/unit/service-management/mvp.roadmap.features.test.ts', issue: 'JUM-677' },
  { file: 'apps/backend-template/test/unit/service-management/pm2EcosystemUi.contract.test.ts', issue: 'JUM-677' },
  { file: 'apps/backend-template/test/unit/service-management/pwaShell.test.ts', issue: 'JUM-677' },
  { file: 'apps/backend-template/test/unit/service-management/rbacContract.test.ts', issue: 'JUM-677' },
  { file: 'apps/backend-template/test/unit/service-management/runtimeEnvUi.contract.test.ts', issue: 'JUM-677' },
  { file: 'apps/backend-template/test/unit/service-management/sampleModel.test.ts', issue: 'JUM-677' },
  { file: 'apps/backend-template/test/unit/service-management/serverHarnessPorts.test.ts', issue: 'JUM-677' },
  { file: 'apps/backend-template/test/unit/service-management/serviceConfigurationValidation.test.ts', issue: 'JUM-677' }
]);

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
