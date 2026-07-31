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

const coverageGuard = require('../../../../../ci-cd/check-coverage-thresholds') as {
  summarize: (lcov: string) => Record<string, { found: number; hit: number }>;
  percentage: (counter: { found: number; hit: number }) => number | null;
  validateCoverage: (
    totals: Record<string, { found: number; hit: number }>,
    thresholds?: Record<string, number>
  ) => { failures: string[]; report: Record<string, number | null> };
  THRESHOLDS: Record<string, number>;
  main: () => void;
};

/** An lcov report with the given per-metric found/hit totals. */
const lcovWith = ({
  lf = 100, lh = 100, fnf = 10, fnh = 10, brf = 20, brh = 20
}: Partial<Record<'lf' | 'lh' | 'fnf' | 'fnh' | 'brf' | 'brh', number>>) => [
  'TN:',
  'SF:apps/backend-template/src/example.ts',
  `FNF:${fnf}`, `FNH:${fnh}`,
  `LF:${lf}`, `LH:${lh}`,
  `BRF:${brf}`, `BRH:${brh}`,
  'end_of_record'
].join('\n');

describe('check-coverage-thresholds', () => {
  it('sums found and hit counters across records', () => {
    expect.hasAssertions();
    // Two records, so the check is on the total rather than on whichever file
    // happens to be last.
    const totals = coverageGuard.summarize(
      `${lcovWith({ lf: 10, lh: 9 })}\n${lcovWith({ lf: 30, lh: 21 })}`
    );

    expect(totals.lines).toStrictEqual({ found: 40, hit: 30 });
  });

  it('passes when every metric is at or above its threshold', () => {
    expect.hasAssertions();
    const { failures } = coverageGuard.validateCoverage(
      coverageGuard.summarize(lcovWith({}))
    );

    expect(failures).toStrictEqual([]);
  });

  it('fails when branch coverage is below 90 percent', () => {
    expect.hasAssertions();
    // The metric this checker exists for: Bun cannot enforce it, so nothing else
    // would catch it.
    const { failures } = coverageGuard.validateCoverage(
      coverageGuard.summarize(lcovWith({ brf: 100, brh: 89 }))
    );

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('branches: 89.00% is below the required 90%');
  });

  it.each([
    ['statements', { lf: 100, lh: 98 }],
    ['lines', { lf: 100, lh: 98 }],
    ['functions', { fnf: 100, fnh: 98 }]
  ])('fails when %s is below 99 percent', (metric, counters) => {
    expect.hasAssertions();
    const { failures } = coverageGuard.validateCoverage(
      coverageGuard.summarize(lcovWith(counters))
    );

    expect(failures.join('\n')).toContain(`${metric}: 98.00%`);
  });

  it('fails closed when a metric has no counters at all', () => {
    expect.hasAssertions();
    // The case that makes this checker worth having. Bun's lcov emits no BRF or
    // BRH records, so a checker that treated an absent counter as satisfied
    // would report the branch threshold as met by a report that never measured
    // it — a threshold removed by omission rather than by decision.
    const withoutBranches = 'TN:\nSF:x.ts\nFNF:1\nFNH:1\nLF:1\nLH:1\nend_of_record';

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
 * non-zero — a threshold checker that computes the right answer and returns 0
 * blocks nothing, and would look identical in every log until the day it
 * mattered.
 */
describe('check-coverage-thresholds CLI', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const nodeFs = require('fs');
  const originalRead = nodeFs.readFileSync;
  const originalExists = nodeFs.existsSync;

  const runMain = (lcov: string | null) => {
    const errors: unknown[][] = [];
    const logs: unknown[][] = [];
    const exit = jest.spyOn(process, 'exit').mockImplementation(((code: number): never => {
      throw new Error(`exit:${String(code)}`);
    }) as never);
    jest.spyOn(console, 'error').mockImplementation((...args) => { errors.push(args); });
    jest.spyOn(console, 'log').mockImplementation((...args) => { logs.push(args); });
    nodeFs.existsSync = () => lcov !== null;
    nodeFs.readFileSync = () => lcov ?? '';

    let thrown: Error | null = null;
    try {
      coverageGuard.main();
    } catch (error) {
      thrown = error as Error;
    }

    return {
      thrown, errors: errors.flat().join('\n'), logs: logs.flat().join('\n'), exit
    };
  };

  afterEach(() => {
    nodeFs.readFileSync = originalRead;
    nodeFs.existsSync = originalExists;
    jest.restoreAllMocks();
  });

  it('exits non-zero when a threshold is missed', () => {
    expect.hasAssertions();
    const result = runMain(
      'TN:\nSF:x.ts\nFNF:100\nFNH:100\nLF:100\nLH:100\nBRF:100\nBRH:50\nend_of_record'
    );

    expect(result.thrown?.message).toBe('exit:1');
    expect(result.errors).toContain('branches: 50.00% is below the required 90%');
  });

  it('exits non-zero when the report is absent, rather than treating it as a pass', () => {
    expect.hasAssertions();
    // The thresholds must not stop applying the moment coverage stops being
    // produced, which is precisely when they matter most.
    const result = runMain(null);

    expect(result.thrown?.message).toBe('exit:1');
    expect(result.errors).toContain('coverage/lcov.info does not exist');
  });

  it('reports every metric when all pass', () => {
    expect.hasAssertions();
    const result = runMain(
      'TN:\nSF:x.ts\nFNF:100\nFNH:100\nLF:100\nLH:100\nBRF:100\nBRH:95\nend_of_record'
    );

    expect(result.thrown).toBeNull();
    expect(result.logs).toContain('branches 95.00%');
  });
});
