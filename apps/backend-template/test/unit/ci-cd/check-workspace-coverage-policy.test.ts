/* eslint-disable @typescript-eslint/no-var-requires */
const {
  MINIMUM_GLOBAL_THRESHOLDS,
  validateGlobalCoverageThreshold,
  validatePackageCoveragePolicy
} = require('../../../../../ci-cd/check-workspace-coverage-policy');

describe('check-workspace-coverage-policy', () => {
  it('accepts root jest global coverage thresholds when minimums are met', () => {
    expect.hasAssertions();
    const failures = validateGlobalCoverageThreshold({
      coverageThreshold: {
        global: {
          statements: MINIMUM_GLOBAL_THRESHOLDS.statements,
          lines: MINIMUM_GLOBAL_THRESHOLDS.lines,
          functions: MINIMUM_GLOBAL_THRESHOLDS.functions,
          branches: MINIMUM_GLOBAL_THRESHOLDS.branches
        }
      }
    });
    expect(failures).toStrictEqual([]);
  });

  it('rejects root jest global coverage thresholds below minimums', () => {
    expect.hasAssertions();
    const failures = validateGlobalCoverageThreshold({
      coverageThreshold: {
        global: {
          statements: 95,
          lines: 95,
          functions: 95,
          branches: 80
        }
      }
    });
    // JUM-681 recorded the first live exception, and this is the branch the
    // previous version described but could not exercise: the affected metric
    // names its floor and the issue, the other three name their base minimum.
    expect(failures).toStrictEqual([
      'Root coverageThreshold.global.statements must be >= 98 (current: 95)',
      'Root coverageThreshold.global.lines must be >= 98 (current: 95)',
      'Root coverageThreshold.global.functions must be >= 98 (current: 95)',
      'Root coverageThreshold.global.branches must be >= 94.514'
        + ' (98 relaxed to the accepted floor under JUM-681) (current: 80)'
    ]);
  });

  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const exceptionRegister = require('../../../../../ci-cd/check-coverage-thresholds')
    .ACCEPTED_BELOW_THRESHOLD as Record<string, { floor: number } | undefined>;

  /** A metric's floor: its recorded exception if one exists, else the base minimum. */
  const atFloor = (metric: string, base: number) => {
    const exception = exceptionRegister[metric];
    return exception === undefined ? base : exception.floor;
  };

  it('reads its exceptions from the coverage checker rather than its own copy', () => {
    expect.hasAssertions();
    // Two guards enforcing the same numbers is fine; two holding separate ideas
    // of which concessions are live is not — one would keep passing a metric the
    // other had released, or keep failing one already accepted.
    // Every metric set to its floor — the base minimum where there is no
    // exception, the recorded floor where there is one.
    const failures = validateGlobalCoverageThreshold({
      coverageThreshold: {
        global: {
          statements: atFloor('statements', 98),
          lines: atFloor('lines', 98),
          functions: atFloor('functions', 98),
          branches: atFloor('branches', 98)
        }
      }
    });

    expect(failures).toStrictEqual([]);
  });

  it('accepts package test policy for non-placeholder scripts', () => {
    expect.hasAssertions();
    const failures = validatePackageCoveragePolicy({
      name: '@jumentix/message-mediator',
      scripts: {
        test: 'npm run typecheck'
      }
    });
    expect(failures).toStrictEqual([]);
  });

  it('rejects placeholder test scripts for non-allowlisted packages', () => {
    expect.hasAssertions();
    const failures = validatePackageCoveragePolicy({
      name: '@jumentix/runtime-infra',
      scripts: {
        test: 'echo "No tests yet for @jumentix/runtime-infra"'
      }
    });
    expect(failures).toStrictEqual([
      '[@jumentix/runtime-infra] test script must not be placeholder output'
    ]);
  });

  it('rejects a placeholder test script for a config package too', () => {
    expect.hasAssertions();
    // This test used to assert the opposite, naming `@jumentix/config-eslint` as
    // allowlisted. Requirement 106 / JUM-557 emptied that allowlist — placeholders
    // are now forbidden for every package, and the config packages moved to
    // `test: bun run typecheck`. The assertion was not updated with the policy,
    // so it kept describing an exemption that no longer exists (JUM-583).
    const failures = validatePackageCoveragePolicy({
      name: '@jumentix/config-eslint',
      scripts: {
        test: 'echo "config-eslint placeholder: migration wave pending"'
      }
    });

    expect(failures).toStrictEqual([
      '[@jumentix/config-eslint] test script must not be placeholder output'
    ]);
  });

  it('accepts a test script that runs a real command', () => {
    expect.hasAssertions();
    // The shape the config packages actually use now, so the suite records what
    // replaced the allowlist rather than only what was removed.
    const failures = validatePackageCoveragePolicy({
      name: '@jumentix/config-eslint',
      scripts: { test: 'bun run typecheck' }
    });

    expect(failures).toStrictEqual([]);
  });
});
