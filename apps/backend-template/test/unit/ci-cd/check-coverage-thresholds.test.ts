/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * The coverage thresholds, enforced from lcov rather than by a runner.
 *
 * The checker exists so that deprecating Jest cannot silently drop a metric.
 * Jest enforced four (Requirements 020 / 063); Bun's own `coverageThreshold`
 * understands three, having no branch metric. Reading the lcov keeps the numbers
 * enforced here identical to the ones Sonar and Codecov consume.
 *
 * Tested by making it fail on purpose. A threshold checker that has only ever
 * been observed passing is indistinguishable from one that always passes.
 */

interface CoverageCounters { found: number; hit: number }

const coverageGuard = require('../../../../../ci-cd/check-coverage-thresholds') as {
  summarize: (report: unknown) => Record<string, CoverageCounters>;
  percentage: (counter: CoverageCounters) => number | null;
  validateCoverage: (
    totals: Record<string, CoverageCounters>,
    thresholds?: Record<string, number>,
    exceptions?: Record<string, { floor: number; issue: string; since: string }>
  ) => { failures: string[]; report: Record<string, number | null> };
  BASE_THRESHOLDS?: Record<string, number>;
  THRESHOLDS: Record<string, number>;
  ACCEPTED_BELOW_THRESHOLD: Record<string, { floor: number; issue: string; since: string }>;
  formatPercentage: (value: number) => string;
  main: (
    readReport?: () => unknown,
    exceptions?: Record<string, { floor: number; issue: string; since: string }>
  ) => void;
  defaultReadReport: () => unknown;
  filterThresholdSubjects: (report: Record<string, unknown>) => Record<string, unknown>;
  isThresholdSubject: (filePath: string) => boolean;
  readsEnvFlag: (name: string, defaultValue?: boolean) => boolean;
};

/** Counters where the first `hit` of `found` are covered. */
const counters = (found: number, hit: number) => Object.fromEntries(
  Array.from({ length: found }, (_, index) => [String(index), index < hit ? 1 : 0])
);

/** Branch points with one path each, the first `hit` of them covered. */
const branches = (found: number, hit: number) => Object.fromEntries(
  Array.from({ length: found }, (_, index) => [String(index), [index < hit ? 1 : 0]])
);

/** A statement map placing each statement on its own line. */
const statements = (found: number) => Object.fromEntries(
  Array.from({ length: found }, (_, index) => [
    String(index), { start: { line: index + 1 } }
  ])
);

/** An Istanbul report with the given per-metric found/hit totals. */
const reportWith = ({
  sf = 100, sh = 100, fnf = 10, fnh = 10, brf = 20, brh = 20
}: Partial<Record<'sf' | 'sh' | 'fnf' | 'fnh' | 'brf' | 'brh', number>>) => ({
  'apps/backend-template/src/example.ts': {
    statementMap: statements(sf),
    s: counters(sf, sh),
    f: counters(fnf, fnh),
    // One path per branch point, so the flattened count is the branch count.
    b: branches(brf, brh)
  }
});

const restoreEnvValue = (name: string, value: string | undefined) => {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
};

describe('check-coverage-thresholds', () => {
  it('sums found and hit counters across records', () => {
    expect.hasAssertions();
    // Two records, so the check is on the total rather than on whichever file
    // happens to be last.
    const totals = coverageGuard.summarize({
      ...reportWith({ sf: 10, sh: 9 }),
      'apps/backend-template/src/other.ts': reportWith({ sf: 30, sh: 21 })['apps/backend-template/src/example.ts']
    });

    expect(totals.statements).toStrictEqual({ found: 40, hit: 30 });
  });

  it('passes when every metric is at or above its threshold', () => {
    expect.hasAssertions();
    // Thresholds passed explicitly, excluding whichever metric currently holds
    // an exception: this asserts the rule, not today's concession.
    const { failures } = coverageGuard.validateCoverage(
      coverageGuard.summarize(reportWith({})),
      { branches: 90, functions: 99, lines: 99 },
      {}
    );

    expect(failures).toStrictEqual([]);
  });

  it('fails when branch coverage is below 90 percent', () => {
    expect.hasAssertions();
    // The metric this checker exists for: Bun cannot enforce it, so nothing else
    // would catch it.
    const { failures } = coverageGuard.validateCoverage(
      coverageGuard.summarize(reportWith({ brf: 100, brh: 89 })),
      { branches: 90, functions: 99, lines: 99 },
      {}
    );

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('branches: 89.00% is below the required 90%');
  });

  it.each([
    ['statements', { sf: 100, sh: 98 }],
    ['lines', { sf: 100, sh: 98 }],
    ['functions', { fnf: 100, fnh: 98 }]
  ])('fails when %s is below 99 percent', (metric, over) => {
    expect.hasAssertions();
    const { failures } = coverageGuard.validateCoverage(
      coverageGuard.summarize(reportWith(over)),
      {
        statements: 99, branches: 90, functions: 99, lines: 99
      }
    );

    expect(failures.join('\n')).toContain(`${metric}: 98.00%`);
  });

  it('fails closed when a metric has no counters at all', () => {
    expect.hasAssertions();
    // The case that makes this checker worth having. Bun's lcov emits no BRF or
    // BRH records, so a checker that treated an absent counter as satisfied
    // would report the branch threshold as met by a report that never measured
    // it — a threshold removed by omission rather than by decision.
    const withoutBranches = {
      'x.ts': {
        statementMap: statements(1), s: counters(1, 1), f: counters(1, 1), b: {}
      }
    };

    const { failures } = coverageGuard.validateCoverage(
      coverageGuard.summarize(withoutBranches),
      { branches: 90, functions: 99, lines: 99 },
      {}
    );

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('contains no branches counters');
  });

  it('reports nothing measurable as null rather than as zero', () => {
    expect.hasAssertions();
    // A file with no branches is not 0% branch-covered. Returning 0 would make
    // the metric depend on how much branchless code is in the report.
    expect(coverageGuard.percentage({ found: 0, hit: 0 })).toBeNull();
    expect(coverageGuard.percentage({ found: 4, hit: 1 })).toBe(25);
  });

  it('keeps the four thresholds Jest enforced', () => {
    expect.hasAssertions();
    // Pinned so the migration off Jest cannot relax a number in passing.
    // Lowering any of these is a governance decision under Requirements 020/063.
    // JUM-681 raised branches from 90 and settled the four at 98. The measured
    // gap lived in `ACCEPTED_BELOW_THRESHOLD` as a dated floor (JUM-579) until
    // branch coverage reached the threshold and the exception was retired —
    // the register is empty again, and only a new dated entry may hold one.
    expect(coverageGuard.THRESHOLDS).toStrictEqual({
      statements: 98,
      branches: 98,
      functions: 98,
      lines: 98
    });
  });
});

/**
 * The CLI, which is what CI actually invokes.
 *
 * `validateCoverage` being correct is not the same as the command exiting
 * non-zero — a checker that computes the right answer and returns 0 blocks
 * nothing, and would look identical in every log until the day it mattered.
 *
 * The report is injected rather than stubbed onto `fs`. A global stub leaks into
 * every other suite sharing the process: the first version of these tests made
 * ten unrelated tests fail, because every `readFileSync` in the run returned a
 * coverage report.
 */
describe('check-coverage-thresholds CLI', () => {
  const runMain = (
    report: unknown,
    exceptions?: Record<string, { floor: number; issue: string; since: string }>
  ) => {
    const errors: unknown[] = [];
    const logs: unknown[] = [];
    jest.spyOn(process, 'exit').mockImplementation(((code: number): never => {
      throw new Error(`exit:${String(code)}`);
    }) as never);
    jest.spyOn(console, 'error').mockImplementation((...args) => { errors.push(...args); });
    jest.spyOn(console, 'log').mockImplementation((...args) => { logs.push(...args); });

    let thrown: Error | null = null;
    try {
      coverageGuard.main(() => report, exceptions);
    } catch (error) {
      thrown = error as Error;
    }

    return { thrown, errors: errors.join('\n'), logs: logs.join('\n') };
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exits non-zero when a threshold is missed', () => {
    expect.hasAssertions();
    const result = runMain(reportWith({ brf: 100, brh: 50 }));

    expect(result.thrown?.message).toBe('exit:1');
    expect(result.errors).toContain('branches: 50.00% is below the required 98%');
  });

  it('exits non-zero when the report is absent, rather than treating it as a pass', () => {
    expect.hasAssertions();
    // The thresholds must not stop applying the moment coverage stops being
    // produced, which is precisely when they matter most.
    const result = runMain(null);

    expect(result.thrown?.message).toBe('exit:1');
    expect(result.errors).toContain('coverage-final.json does not exist');
  });

  it('reports every metric when all pass', () => {
    expect.hasAssertions();
    const result = runMain(reportWith({ brf: 100, brh: 98 }), {});

    expect(result.thrown).toBeNull();
    expect(result.logs).toContain('branches 98.00%');
    expect(result.logs).not.toContain('under JUM-579');
  });

  it('reports a passing metric under a live exception with its ratchet note', () => {
    expect.hasAssertions();
    const result = runMain(reportWith({ brf: 10000, brh: 9747 }), {
      branches: { floor: 97.47, issue: 'JUM-579', since: '2026-08-29' }
    });

    expect(result.thrown).toBeNull();
    expect(result.logs).toContain('branches 97.47% (under JUM-579, floor 97.47%)');
  });
});

/**
 * Reading the report from disk.
 *
 * `defaultReadReport` is the only part of this guard that touches the
 * filesystem, and it is what decides whether a missing report becomes a failure
 * or a crash. Injected everywhere else, so without these two cases it would ship
 * untested.
 */
describe('check-coverage-thresholds report reader', () => {
  it('returns null when no report has been produced', () => {
    expect.hasAssertions();
    // Not an exception: `main` turns null into a stated failure with a
    // remediation, which is more useful than an ENOENT stack.
    // `spyOn` on the CommonJS fs module, not `jest.requireActual` — that does not
    // exist under Bun's runner, which is the whole subject of JUM-583.
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const nodeFs = require('fs') as { existsSync: (path: string) => boolean };
    const spy = jest.spyOn(nodeFs, 'existsSync').mockReturnValue(false);

    expect(coverageGuard.defaultReadReport()).toBeNull();
    spy.mockRestore();
  });

  it('fails closed when the Jest report exists but the browser report does not', () => {
    expect.hasAssertions();
    // Requirement 112 §4: cana is measured in the browser. Returning the Jest
    // half alone would pass the gate with cana unmeasured.
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const nodeFs = require('fs') as {
      existsSync: (path: string) => boolean;
      readFileSync: (path: string, encoding: string) => string;
    };
    const exists = jest.spyOn(nodeFs, 'existsSync').mockImplementation((filePath) => (
      String(filePath).endsWith('coverage/coverage-final.json')
    ));
    const read = jest.spyOn(nodeFs, 'readFileSync').mockReturnValue(JSON.stringify({
      'jest.ts': {
        b: {},
        f: {},
        s: counters(1, 1),
        statementMap: statements(1)
      }
    }));

    expect(coverageGuard.defaultReadReport()).toStrictEqual({ missingBrowserReport: true });
    exists.mockRestore();
    read.mockRestore();
  });

  it('can read only the preserved Jest report when the release job gates project coverage before browser publishing', () => {
    expect.hasAssertions();
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const nodeFs = require('fs') as {
      existsSync: (path: string) => boolean;
      readFileSync: (path: string, encoding: string) => string;
    };
    const previousIncludeBrowser = process.env.JUMENTIX_COVERAGE_INCLUDE_BROWSER;
    const previousRequireBrowser = process.env.JUMENTIX_COVERAGE_REQUIRE_BROWSER;
    process.env.JUMENTIX_COVERAGE_INCLUDE_BROWSER = '0';
    process.env.JUMENTIX_COVERAGE_REQUIRE_BROWSER = '0';
    const exists = jest.spyOn(nodeFs, 'existsSync').mockImplementation((filePath) => (
      String(filePath).endsWith('coverage/coverage-final.json')
    ));
    const read = jest.spyOn(nodeFs, 'readFileSync').mockReturnValue(JSON.stringify({
      'jest.ts': {
        b: {},
        f: {},
        s: counters(1, 1),
        statementMap: statements(1)
      }
    }));

    try {
      const report = coverageGuard.defaultReadReport() as Record<string, { s: unknown }>;

      expect(Object.keys(report)).toStrictEqual(['jest.ts']);
      expect(report['jest.ts'].s).toStrictEqual({ 0: 1 });
    } finally {
      restoreEnvValue('JUMENTIX_COVERAGE_INCLUDE_BROWSER', previousIncludeBrowser);
      restoreEnvValue('JUMENTIX_COVERAGE_REQUIRE_BROWSER', previousRequireBrowser);
      exists.mockRestore();
      read.mockRestore();
    }
  });

  it('parses a report from disk', () => {
    expect.hasAssertions();
    // Reading the repository's own coverage/coverage-final.json would be
    // order-dependent: the run that executes this test is the run that writes
    // that file, so it is absent on a clean run and present on a repeat. A
    // fixture makes the assertion about the reader rather than about timing.
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const nodeFs = require('fs') as {
      existsSync: (path: string) => boolean;
      readFileSync: (path: string, encoding: string) => string;
    };
    const fixture = JSON.stringify({
      'x.ts': {
        b: {},
        f: {},
        s: counters(1, 1),
        statementMap: statements(1)
      }
    });
    const exists = jest.spyOn(nodeFs, 'existsSync').mockReturnValue(true);
    const read = jest.spyOn(nodeFs, 'readFileSync').mockReturnValue(fixture);

    const report = coverageGuard.defaultReadReport() as Record<string, { s: unknown }>;

    expect(Object.keys(report)).toStrictEqual(['x.ts']);
    expect(report['x.ts'].s).toStrictEqual({ 0: 1 });
    exists.mockRestore();
    read.mockRestore();
  });

  it('reads the canonical report when the preserved Jest report is absent', () => {
    expect.hasAssertions();
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const nodeFs = require('fs') as {
      existsSync: (path: string) => boolean;
      readFileSync: (path: string, encoding: string) => string;
    };
    const previousIncludeBrowser = process.env.JUMENTIX_COVERAGE_INCLUDE_BROWSER;
    process.env.JUMENTIX_COVERAGE_INCLUDE_BROWSER = '0';
    const exists = jest.spyOn(nodeFs, 'existsSync').mockImplementation((filePath) => (
      String(filePath).endsWith('coverage/coverage-final.json')
    ));
    const read = jest.spyOn(nodeFs, 'readFileSync').mockReturnValue(JSON.stringify({
      'canonical.ts': {
        b: {},
        f: {},
        s: counters(1, 1),
        statementMap: statements(1)
      }
    }));

    try {
      const report = coverageGuard.defaultReadReport() as Record<string, { s: unknown }>;

      expect(Object.keys(report)).toStrictEqual(['canonical.ts']);
      expect(read).toHaveBeenCalledWith(expect.stringContaining('coverage/coverage-final.json'), 'utf8');
    } finally {
      restoreEnvValue('JUMENTIX_COVERAGE_INCLUDE_BROWSER', previousIncludeBrowser);
      exists.mockRestore();
      read.mockRestore();
    }
  });

  it('uses the canonical report without requiring browser coverage when explicitly allowed', () => {
    expect.hasAssertions();
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const nodeFs = require('fs') as {
      existsSync: (path: string) => boolean;
      readFileSync: (path: string, encoding: string) => string;
    };
    const previousIncludeBrowser = process.env.JUMENTIX_COVERAGE_INCLUDE_BROWSER;
    const previousRequireBrowser = process.env.JUMENTIX_COVERAGE_REQUIRE_BROWSER;
    process.env.JUMENTIX_COVERAGE_INCLUDE_BROWSER = '1';
    process.env.JUMENTIX_COVERAGE_REQUIRE_BROWSER = '0';
    const exists = jest.spyOn(nodeFs, 'existsSync').mockImplementation((filePath) => (
      String(filePath).endsWith('/coverage/coverage-final.json')
    ));
    const read = jest.spyOn(nodeFs, 'readFileSync').mockReturnValue(JSON.stringify({
      'canonical.ts': {
        b: {},
        f: {},
        s: counters(1, 1),
        statementMap: statements(1)
      }
    }));

    try {
      const report = coverageGuard.defaultReadReport() as Record<string, { s: unknown }>;

      expect(Object.keys(report)).toStrictEqual(['canonical.ts']);
    } finally {
      restoreEnvValue('JUMENTIX_COVERAGE_INCLUDE_BROWSER', previousIncludeBrowser);
      restoreEnvValue('JUMENTIX_COVERAGE_REQUIRE_BROWSER', previousRequireBrowser);
      exists.mockRestore();
      read.mockRestore();
    }
  });

  it('prefers the preserved Jest report when browser coverage rewrites the canonical file', () => {
    expect.hasAssertions();
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const nodeFs = require('fs') as {
      existsSync: (path: string) => boolean;
      readFileSync: (path: string, encoding: string) => string;
    };
    const exists = jest.spyOn(nodeFs, 'existsSync').mockReturnValue(true);
    const reports = {
      browser: JSON.stringify({
        'browser.ts': {
          b: {},
          f: {},
          s: counters(1, 1),
          statementMap: statements(1)
        }
      }),
      jest: JSON.stringify({
        'jest.ts': {
          b: {},
          f: {},
          s: counters(1, 1),
          statementMap: statements(1)
        }
      })
    };
    const read = jest.spyOn(nodeFs, 'readFileSync')
      .mockReturnValueOnce(reports.jest)
      .mockReturnValueOnce(reports.browser);

    const report = coverageGuard.defaultReadReport() as Record<string, { s: unknown }>;

    expect(Object.keys(report)).toStrictEqual(['jest.ts', 'browser.ts']);
    exists.mockRestore();
    read.mockRestore();
  });

  it('keeps the global threshold scope on backend, ci-cd, and browser-owned cana sources', () => {
    expect.hasAssertions();

    const report = coverageGuard.filterThresholdSubjects({
      '/repo/apps/backend-template/src/service.ts': reportWith({}),
      '/repo/ci-cd/check-coverage-thresholds.js': reportWith({}),
      '/repo/packages/cana/src/core/database.ts': reportWith({}),
      '/repo/packages/message-mediator/src/RabbitMqMessageMediatorAdapter.ts': reportWith({})
    });

    expect(Object.keys(report)).toStrictEqual([
      '/repo/apps/backend-template/src/service.ts',
      '/repo/ci-cd/check-coverage-thresholds.js',
      '/repo/packages/cana/src/core/database.ts'
    ]);
    expect(coverageGuard.isThresholdSubject('/repo/packages/sdk-rest-client/src/index.ts'))
      .toBe(false);
  });

  it('measures designer-core sources as threshold subjects (JUM-493)', () => {
    expect.hasAssertions();

    // The service-management unit suites exercise the package's canonical
    // sources through the workspace alias, so the package belongs to the
    // global bar exactly like cana/src does.
    expect(coverageGuard.isThresholdSubject('/repo/packages/designer-core/src/state/designerState.js'))
      .toBe(true);
    expect(coverageGuard.isThresholdSubject('/repo/packages/designer-core/test/packaging.test.ts'))
      .toBe(false);
    expect(coverageGuard.isThresholdSubject('/repo/packages/designer-core/dist/index.js'))
      .toBe(false);
  });

  it('parses boolean environment flags with absent and negative values', () => {
    expect.hasAssertions();
    const previous = process.env.JUMENTIX_TEST_BOOLEAN_FLAG;
    delete process.env.JUMENTIX_TEST_BOOLEAN_FLAG;

    try {
      expect(coverageGuard.readsEnvFlag('JUMENTIX_TEST_BOOLEAN_FLAG')).toBe(true);
      expect(coverageGuard.readsEnvFlag('JUMENTIX_TEST_BOOLEAN_FLAG', false)).toBe(false);
      process.env.JUMENTIX_TEST_BOOLEAN_FLAG = 'off';
      expect(coverageGuard.readsEnvFlag('JUMENTIX_TEST_BOOLEAN_FLAG')).toBe(false);
      process.env.JUMENTIX_TEST_BOOLEAN_FLAG = 'yes';
      expect(coverageGuard.readsEnvFlag('JUMENTIX_TEST_BOOLEAN_FLAG')).toBe(true);
    } finally {
      restoreEnvValue('JUMENTIX_TEST_BOOLEAN_FLAG', previous);
    }
  });
});

/**
 * The exception mechanism, which is the part most able to rot.
 *
 * A waiver that silently becomes permanent is worse than a lowered threshold,
 * because it still reads as if the original bar applies. The ratchet is what
 * stops that: a metric under exception may hold or improve, never regress, and
 * once it clears the real threshold the entry must go.
 */
describe('check-coverage-thresholds exceptions', () => {
  const thresholds = { statements: 99 };

  /**
   * A synthetic register, not the live one.
   *
   * The live register is empty, and empty is the state to keep it in — so
   * reading it here would make every assertion below vacuous: the ratchet code
   * would never execute and the tests would pass having exercised nothing. That
   * is exactly what happened when the one real exception was removed.
   */
  const register = {
    statements: { floor: 98.99, since: '2026-07-31', issue: 'JUM-588' }
  };

  /** Hoisted so the predicates are not branches inside a test body. */
  const hasIssue = (entry: { issue: string }) => typeof entry.issue === 'string' && entry.issue.length > 0;
  const hasIsoDate = (entry: { since: string }) => /^\d{4}-\d{2}-\d{2}$/.test(entry.since);

  it('accepts a metric at its recorded floor', () => {
    expect.hasAssertions();
    const { failures } = coverageGuard.validateCoverage(
      coverageGuard.summarize(reportWith({ sf: 10000, sh: 9899 })),
      thresholds,
      register
    );

    expect(failures).toStrictEqual([]);
  });

  it('fails when a metric under exception regresses below its floor', () => {
    expect.hasAssertions();
    // The whole point. Without this the exception is a blank cheque: coverage
    // could fall to any value and the gate would still pass.
    const { failures } = coverageGuard.validateCoverage(
      coverageGuard.summarize(reportWith({ sf: 10000, sh: 9800 })),
      thresholds,
      register
    );

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('below the accepted floor');
    expect(failures[0]).toContain('JUM-588');
  });

  it('fails when a metric clears its threshold but the exception is still listed', () => {
    expect.hasAssertions();
    // The other direction, and the one that decides whether this stays honest:
    // a concession nobody removes is a lowered bar wearing a ticket number.
    const { failures } = coverageGuard.validateCoverage(
      coverageGuard.summarize(reportWith({ sf: 100, sh: 100 })),
      thresholds,
      register
    );

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('now meets the 99% threshold');
    expect(failures[0]).toContain('Remove it from ACCEPTED_BELOW_THRESHOLD');
  });

  it('requires an issue and a date on any exception that is live', () => {
    expect.hasAssertions();
    // An undated exception with no issue is indistinguishable from a threshold
    // someone quietly lowered.
    //
    // The register is empty today and should stay that way, so this asserts the
    // rule holds over whatever is there rather than that anything is — an
    // assertion that entries exist would push the next person toward adding one.
    const entries = Object.values(coverageGuard.ACCEPTED_BELOW_THRESHOLD);

    expect(entries.every(hasIssue)).toBe(true);
    expect(entries.every(hasIsoDate)).toBe(true);
  });

  it('never prints a percentage higher than the one measured', () => {
    expect.hasAssertions();
    // 98.995 rounds to "99.00" with toFixed, which reads as meeting a 99%
    // threshold it does not meet. Truncating keeps the printed figure a lower
    // bound — the only direction a coverage report may err in.
    expect(coverageGuard.formatPercentage(98.995)).toBe('98.99');
    expect(coverageGuard.formatPercentage(99)).toBe('99.00');
  });
});

/**
 * The two exits `main` takes when there is nothing trustworthy to measure
 * (JUM-681).
 *
 * Both were uncovered, and both are the difference between a stated failure and
 * a silent pass. A missing report is exactly when a threshold matters most: if
 * the check treated it as a pass, deleting `coverage/` would satisfy the gate.
 */
describe('check-coverage-thresholds entry point (JUM-681)', () => {
  const exitWith = (readReport: () => unknown) => {
    const exit = jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exit');
    }) as never);
    const errors: string[] = [];
    const consoleError = jest.spyOn(console, 'error').mockImplementation((message?: unknown) => {
      errors.push(String(message));
    });

    let threw = false;
    try {
      (coverageGuard as { main: (read: () => unknown) => void }).main(readReport);
    } catch {
      threw = true;
    }

    const code = exit.mock.calls[0]?.[0];
    exit.mockRestore();
    consoleError.mockRestore();
    return { code, errors, threw };
  };

  it('fails, and says what to run, when no report exists', () => {
    expect.hasAssertions();

    const { code, errors } = exitWith(() => null);

    expect(code).toBe(1);
    expect(errors.join('\n')).toContain('bun run test:coverage');
  });

  it('fails when the browser half is missing rather than measuring the other half', () => {
    expect.hasAssertions();

    // Requirement 112 §4: cana is measured in a real browser. Passing on the
    // Jest half alone would report a number that leaves cana out entirely.
    const { code, errors } = exitWith(() => ({ missingBrowserReport: true }));

    expect(code).toBe(1);
    expect(errors.join('\n')).toContain('bun run test:browser');
  });
});

describe('check-coverage-thresholds line counting (JUM-681)', () => {
  it('counts a line as missed when the report carries no counters for it', () => {
    expect.hasAssertions();

    // Istanbul writes `statementMap` and `s` separately, and a file that was
    // instrumented but never loaded arrives with an empty `s`. Reading that as
    // "no misses" would let an unloaded file raise the percentage instead of
    // lowering it.
    const guard = coverageGuard as unknown as {
      lineTotals: (report: unknown) => { found: number; hit: number };
    };

    const totals = guard.lineTotals({
      'never-loaded.ts': {
        statementMap: { 0: { start: { line: 1 } }, 1: { start: { line: 2 } } },
        s: {},
        f: {},
        b: {}
      }
    });

    expect(totals).toStrictEqual({ found: 2, hit: 0 });
  });
});

/**
 * Records that carry less than the format promises (JUM-721).
 *
 * Istanbul writes a record per file, and a file with no functions has no `f`
 * map, one with no branches has no `b`, and a file the instrumenter skipped has
 * no `statementMap` at all. The summariser has to read each of those as "none
 * of that metric here" rather than throwing — a checker that crashes on one odd
 * record reports nothing about the other nine hundred, and a crashed checker in
 * CI reads as a failed build with no coverage number in it.
 */
describe('check-coverage-thresholds partial records (JUM-721)', () => {
  it('reads a record with no counter maps as contributing nothing', () => {
    expect.hasAssertions();

    const totals = coverageGuard.summarize({
      'apps/backend-template/src/empty.ts': { statementMap: {} },
      ...reportWith({
        sf: 10, sh: 10, fnf: 2, fnh: 2, brf: 4, brh: 4
      })
    });

    expect(totals).toStrictEqual({
      statements: { found: 10, hit: 10 },
      functions: { found: 2, hit: 2 },
      branches: { found: 4, hit: 4 },
      lines: { found: 10, hit: 10 }
    });
  });

  it('counts no lines for a record with no statement map', () => {
    expect.hasAssertions();

    // `lines` is derived from the statement map, so a record without one has
    // no lines rather than a line whose count is `undefined`.
    const totals = coverageGuard.summarize({
      'apps/backend-template/src/skipped.ts': { s: {}, f: {}, b: {} }
    });

    expect(totals.lines).toStrictEqual({ found: 0, hit: 0 });
  });

  it('treats a statement with no recorded count as missed', () => {
    expect.hasAssertions();

    // A statement map entry with no matching `s` count is not a covered line.
    // Reading the absent count as anything but zero would report a file as
    // fully covered because its counters failed to serialise.
    const totals = coverageGuard.summarize({
      'apps/backend-template/src/partial.ts': {
        statementMap: { 0: { start: { line: 1 } }, 1: { start: { line: 2 } } },
        s: { 0: 3 },
        f: {},
        b: {}
      }
    });

    expect(totals.lines).toStrictEqual({ found: 2, hit: 1 });
  });
});

describe('check-coverage-thresholds default parameters (JUM-821)', () => {
  it('counts lines for a record whose statement counters are absent entirely', () => {
    expect.hasAssertions();

    // `statementMap` without any `s` map at all: every line is missed, and
    // the absent map is not a crash.
    const guard = coverageGuard as unknown as {
      lineTotals: (report: unknown) => { found: number; hit: number };
    };

    expect(guard.lineTotals({
      'apps/backend-template/src/unset.ts': {
        statementMap: { 0: { start: { line: 1 } }, 1: { start: { line: 2 } } }
      }
    })).toStrictEqual({ found: 2, hit: 0 });
  });

  it('validates against the built-in thresholds when none are passed', () => {
    expect.hasAssertions();

    const totals = {
      statements: { found: 4, hit: 4 },
      lines: { found: 4, hit: 4 },
      functions: { found: 2, hit: 2 },
      branches: { found: 6, hit: 6 }
    };
    const { failures, report } = coverageGuard.validateCoverage(totals, undefined, {});

    expect(failures).toStrictEqual([]);
    expect(report.statements).toBe(100);
  });

  it('fails closed through the default report reader when no report exists', () => {
    expect.hasAssertions();

    // `main()` with no arguments is the CLI shape: it reads the real
    // coverage/ directory through `defaultReadReport`. The report files are
    // moved aside for the duration of the call rather than stubbing `fs` —
    // a global stub leaks into every suite sharing the process — so the
    // missing-report exit runs against the real defaults, deterministically,
    // whatever a previous run left on disk.
    const fs = require('node:fs');
    const path = require('node:path');
    const coverageDir = path.resolve(__dirname, '../../../../../coverage');
    const reportFiles = [
      path.join(coverageDir, 'coverage-final.json'),
      path.join(coverageDir, 'jest', 'coverage-final.json')
    ];
    const movedAside = reportFiles
      .filter((file) => fs.existsSync(file))
      .map((file) => {
        const aside = `${file}.jum821-aside`;
        fs.renameSync(file, aside);
        return { file, aside };
      });

    const exit = jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exit');
    }) as never);
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(() => coverageGuard.main(undefined, {})).toThrow('exit');
      expect(exit).toHaveBeenCalledWith(1);
      expect(consoleError.mock.calls.flat().join('\n'))
        .toContain('coverage-final.json does not exist');
    } finally {
      exit.mockRestore();
      consoleError.mockRestore();
      for (const { file, aside } of movedAside) {
        fs.renameSync(aside, file);
      }
    }
  });
});
