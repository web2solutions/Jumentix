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
  main: (readReport?: () => unknown) => void;
  defaultReadReport: () => unknown;
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
      { branches: 90, functions: 99, lines: 99 }
    );

    expect(failures).toStrictEqual([]);
  });

  it('fails when branch coverage is below 90 percent', () => {
    expect.hasAssertions();
    // The metric this checker exists for: Bun cannot enforce it, so nothing else
    // would catch it.
    const { failures } = coverageGuard.validateCoverage(
      coverageGuard.summarize(reportWith({ brf: 100, brh: 89 })),
      { branches: 90, functions: 99, lines: 99 }
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
      { branches: 90, functions: 99, lines: 99 }
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
    expect(coverageGuard.THRESHOLDS).toStrictEqual({
      statements: 99,
      branches: 90,
      functions: 99,
      lines: 99
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
  const runMain = (report: unknown) => {
    const errors: unknown[] = [];
    const logs: unknown[] = [];
    jest.spyOn(process, 'exit').mockImplementation(((code: number): never => {
      throw new Error(`exit:${String(code)}`);
    }) as never);
    jest.spyOn(console, 'error').mockImplementation((...args) => { errors.push(...args); });
    jest.spyOn(console, 'log').mockImplementation((...args) => { logs.push(...args); });

    let thrown: Error | null = null;
    try {
      coverageGuard.main(() => report);
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
    expect(result.errors).toContain('branches: 50.00% is below the required 90%');
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
    const result = runMain(reportWith({ brf: 100, brh: 95 }));

    expect(result.thrown).toBeNull();
    expect(result.logs).toContain('branches 95.00%');
    // No live exception, so no note. When one is recorded the summary names it,
    // so a reader is never shown a number without being told it sits under a
    // tracked concession.
    expect(result.logs).not.toContain('under JUM-');
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
        statementMap: statements(1), s: counters(1, 1), f: {}, b: {}
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
