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
    expect(failures).toStrictEqual([
      'Root coverageThreshold.global.statements must be >= 99 (current: 95)',
      'Root coverageThreshold.global.lines must be >= 99 (current: 95)',
      'Root coverageThreshold.global.functions must be >= 99 (current: 95)',
      'Root coverageThreshold.global.branches must be >= 90 (current: 80)'
    ]);
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

  it('accepts allowlisted placeholder test scripts for config placeholders', () => {
    expect.hasAssertions();
    const failures = validatePackageCoveragePolicy({
      name: '@jumentix/config-eslint',
      scripts: {
        test: 'echo "config-eslint placeholder: migration wave pending"'
      }
    });
    expect(failures).toStrictEqual([]);
  });
});
