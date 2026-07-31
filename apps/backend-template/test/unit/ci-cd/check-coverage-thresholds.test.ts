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
    thresholds?: Record<string, number>
  ) => { failures: string[]; report: Record<string, number | null> };
  THRESHOLDS: Record<string, number>;
  main: (readReport?: () => unknown) => void;
  defaultReadReport: () => unknown;
};

/** Counters where the first `hit` of `found` are covered. */
const counters = (found: number, hit: number) => Object.fromEntries(
  Array.from({ length: found }, (_, index) => [String(index), index < hit ? 1 : 0])
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
    b: Object.fromEntries(
      Array.from({ length: brf }, (_, index) => [String(index), [index < brh ? 1 : 0]])
    )
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
    const { failures } = coverageGuard.validateCoverage(
      coverageGuard.summarize(reportWith({}))
    );

    expect(failures).toStrictEqual([]);
  });

  it('fails when branch coverage is below 90 percent', () => {
    expect.hasAssertions();
    // The metric this checker exists for: Bun cannot enforce it, so nothing else
    // would catch it.
    const { failures } = coverageGuard.validateCoverage(
      coverageGuard.summarize(reportWith({ brf: 100, brh: 89 }))
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
      coverageGuard.summarize(reportWith(over))
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
      coverageGuard.summarize(withoutBranches)
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
