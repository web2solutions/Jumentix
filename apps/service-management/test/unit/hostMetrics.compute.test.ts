/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
/*
 * hostMetrics pure computations and real-filesystem disk probes: CPU-usage
 * deltas (clamps, mismatched samples), disk path resolution from the env
 * allowlist, the statfs failure surface and the cpu-sample reset hook. No
 * module mocks here — the disk error probe targets a path the test itself
 * guarantees does not exist.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const {
  collectHostMetrics,
  computeCpuUsage,
  resetHostCpuSampleForTests,
  resolveDiskPaths,
  toFiniteNumber
} = require('../../src/runtime/hostMetrics');

type CpuSample = { times: Record<string, number> };

function cpu(times: Record<string, number>): CpuSample {
  return { times };
}

describe('service-management hostMetrics.toFiniteNumber', () => {
  it('coerces numeric input and defaults non-finite input to zero', () => {
    expect.hasAssertions();
    expect(toFiniteNumber('7')).toBe(7);
    expect(toFiniteNumber(2.5)).toBe(2.5);
    expect(toFiniteNumber('nope')).toBe(0);
    expect(toFiniteNumber(undefined)).toBe(0);
    expect(toFiniteNumber(NaN)).toBe(0);
  });
});

describe('service-management hostMetrics.computeCpuUsage', () => {
  it('returns null usage until two samples with the same core count exist', () => {
    expect.hasAssertions();
    const oneCore = [cpu({
      user: 1, nice: 0, sys: 1, idle: 1, irq: 0
    })];
    const twoCores = [...oneCore, cpu({
      user: 1, nice: 0, sys: 1, idle: 1, irq: 0
    })];
    expect(computeCpuUsage(null, oneCore)).toStrictEqual({ usagePercent: null, perCore: [] });
    expect(computeCpuUsage(oneCore, null)).toStrictEqual({ usagePercent: null, perCore: [] });
    expect(computeCpuUsage(oneCore, twoCores)).toStrictEqual({ usagePercent: null, perCore: [] });
    expect(computeCpuUsage([], [])).toStrictEqual({ usagePercent: null, perCore: [] });
  });

  it('computes per-core percentages and their average from counter deltas', () => {
    expect.hasAssertions();
    const before = [
      cpu({
        user: 100, nice: 0, sys: 50, idle: 200, irq: 0
      }),
      cpu({
        user: 0, nice: 0, sys: 0, idle: 100, irq: 0
      })
    ];
    const after = [
      cpu({
        user: 200, nice: 0, sys: 100, idle: 250, irq: 0
      }),
      cpu({
        user: 25, nice: 0, sys: 0, idle: 175, irq: 0
      })
    ];
    // core 0: idle delta 50 of 200 total → 75%; core 1: idle 75 of 100 → 25%.
    expect(computeCpuUsage(before, after)).toStrictEqual({
      usagePercent: 50,
      perCore: [75, 25]
    });
  });

  it('reports 0 for a core whose counters did not advance', () => {
    expect.hasAssertions();
    const sample = [cpu({
      user: 1, nice: 0, sys: 1, idle: 1, irq: 0
    })];
    expect(computeCpuUsage(sample, sample.map((entry) => cpu({ ...entry.times }))))
      .toStrictEqual({ usagePercent: 0, perCore: [0] });
  });

  it('clamps negative usage to 0 when non-idle counters regress', () => {
    expect.hasAssertions();
    const before = [cpu({
      user: 100, nice: 0, sys: 0, idle: 0, irq: 0
    })];
    const after = [cpu({
      user: 50, nice: 0, sys: 0, idle: 200, irq: 0
    })];
    expect(computeCpuUsage(before, after).perCore).toStrictEqual([0]);
  });

  it('clamps usage above 100 when the idle counter regresses', () => {
    expect.hasAssertions();
    const before = [cpu({
      user: 0, nice: 0, sys: 0, idle: 100, irq: 0
    })];
    const after = [cpu({
      user: 100, nice: 0, sys: 0, idle: 90, irq: 0
    })];
    expect(computeCpuUsage(before, after).perCore).toStrictEqual([100]);
  });
});

describe('service-management hostMetrics.resolveDiskPaths', () => {
  const ENV_KEY = 'JUMENTIX_SERVICE_MANAGEMENT_DISK_PATHS';

  afterEach(() => {
    delete process.env[ENV_KEY];
  });

  it('always probes the project root and the temp dir, without duplicates', () => {
    expect.hasAssertions();
    const root = path.resolve(process.cwd());
    const paths = resolveDiskPaths(root);
    expect(paths).toContain(root);
    expect(paths).toContain(path.resolve(os.tmpdir()));
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('appends trimmed env paths, drops blanks and dedupes against the defaults', () => {
    expect.hasAssertions();
    const root = path.resolve(process.cwd());
    process.env[ENV_KEY] = ` /data/x , ,${root},/data/y `;
    const paths = resolveDiskPaths(root);
    expect(paths).toContain(path.resolve('/data/x'));
    expect(paths).toContain(path.resolve('/data/y'));
    expect(paths.filter((entry: string) => entry === root)).toHaveLength(1);
    expect(paths.some((entry: string) => entry.trim() === '')).toBe(false);
  });
});

describe('service-management hostMetrics disk failure surface', () => {
  it('reports the statfs error per volume instead of failing the sample', async () => {
    expect.hasAssertions();
    const missing = path.join(os.tmpdir(), 'jumentix-cov-probe-definitely-missing');
    expect(fs.existsSync(missing)).toBe(false);
    const result = await collectHostMetrics({ projectRoot: missing });
    const failed = result.disk.find(
      (volume: { path: string }) => volume.path === path.resolve(missing)
    );
    expect(failed).toBeDefined();
    // jest's vm realm can make fs errors fail `instanceof Error`, in which case
    // the module falls back to String(error) and DISK_STAT_ERROR; either way the
    // volume reports a message naming the failure and a non-empty code.
    expect(failed.error).toContain('ENOENT');
    expect(typeof failed.code).toBe('string');
    expect(failed.code.length).toBeGreaterThan(0);
    expect(failed.totalBytes).toBeUndefined();
  });
});

describe('service-management hostMetrics cpu sample reset', () => {
  it('reports null usage again after resetHostCpuSampleForTests', async () => {
    expect.hasAssertions();
    await collectHostMetrics({ projectRoot: path.resolve(process.cwd()) });
    const second = await collectHostMetrics({ projectRoot: path.resolve(process.cwd()) });
    expect(typeof second.cpu.usagePercent).toBe('number');
    expect(second.cpu.perCore).toHaveLength(second.cpu.coreCount);

    resetHostCpuSampleForTests();
    const fresh = await collectHostMetrics({ projectRoot: path.resolve(process.cwd()) });
    expect(fresh.cpu.usagePercent).toBeNull();
    expect(fresh.cpu.perCore).toStrictEqual([]);
  });
});

// Module marker: keeps the file out of the shared script scope (TS2451).
// eslint-disable-next-line jest/no-export
export {};
