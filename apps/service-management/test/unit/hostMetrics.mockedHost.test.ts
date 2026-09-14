/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
/*
 * hostMetrics against a spied host: os/fs method spies drive every fallback
 * branch that real hardware cannot reach deterministically — zero total
 * memory, missing cpu model/speed fields, non-Error statfs rejections and
 * non-numeric statfs counters.
 *
 * Portable across both runners (Requirement 106): the builtins are not
 * module-replaced (jest.mock does not intercept node builtins under bun:test,
 * and bun's mock.module does not reach them either); `jest.spyOn` on the
 * real module objects works in both.
 * hostMetrics reads os/fs through the module objects at call time, so the
 * spies need no re-registration per test. The previous-CPU-sample module
 * state is reset through the module's own test seam,
 * resetHostCpuSampleForTests — jest.resetModules does not exist under bun.
 */

const hostMetricsFs = require('fs');
const hostMetricsOs = require('os');

const mockStatfs = jest.spyOn(hostMetricsFs.promises, 'statfs') as jest.Mock;
const mockCpus = jest.spyOn(hostMetricsOs, 'cpus') as jest.Mock;
const mockTotalmem = jest.spyOn(hostMetricsOs, 'totalmem') as jest.Mock;
const mockFreemem = jest.spyOn(hostMetricsOs, 'freemem') as jest.Mock;
const mockLoadavg = jest.spyOn(hostMetricsOs, 'loadavg') as jest.Mock;

const {
  collectHostMetrics,
  resetHostCpuSampleForTests
} = require('../../src/runtime/hostMetrics');

const healthyTimes = {
  user: 10, nice: 0, sys: 5, idle: 85, irq: 0
};

function resetHostSpies() {
  mockStatfs.mockReset();
  mockCpus.mockReset();
  mockTotalmem.mockReset();
  mockFreemem.mockReset();
  mockLoadavg.mockReset();
  resetHostCpuSampleForTests();
  mockCpus.mockReturnValue([{ model: 'MockCore', speed: 2400, times: { ...healthyTimes } }]);
  mockTotalmem.mockReturnValue(1000);
  mockFreemem.mockReturnValue(400);
  mockLoadavg.mockReturnValue([0.1, 0.2, 0.3]);
  mockStatfs.mockResolvedValue({
    bsize: 512, blocks: 1000, bfree: 500, bavail: 450, files: 100, ffree: 90
  });
}

describe('service-management hostMetrics on a mocked host', () => {
  // Spies are never restored: both runners isolate per file.
  beforeEach(resetHostSpies);

  it('computes memory and disk numbers from the raw os/statfs values', async () => {
    expect.hasAssertions();
    const first = await collectHostMetrics({
      projectRoot: '/project', processRssSumBytes: 100, processCpuPercentSum: 12.5
    });
    expect(first.cpu).toMatchObject({
      coreCount: 1,
      model: 'MockCore',
      speedMHz: 2400,
      loadAvg: { one: 0.1, five: 0.2, fifteen: 0.3 },
      usagePercent: null,
      perCore: [],
      processCpuPercentSum: 12.5
    });
    expect(first.memory).toMatchObject({
      totalBytes: 1000,
      freeBytes: 400,
      usedBytes: 600,
      usedPercent: 60,
      processRssSumBytes: 100,
      otherBytes: 500
    });
    const volume = first.disk.find((entry: { path: string }) => entry.path === '/project');
    expect(volume).toMatchObject({
      blockSize: 512,
      blocks: 1000,
      blocksFree: 500,
      blocksAvailable: 450,
      files: 100,
      filesFree: 90,
      totalBytes: 512000,
      freeBytes: 256000,
      availableBytes: 230400,
      usedBytes: 256000,
      usedPercent: 50
    });

    // Second sample against identical counters: zero deltas → 0% per core.
    const second = await collectHostMetrics({ projectRoot: '/project' });
    expect(second.cpu.usagePercent).toBe(0);
    expect(second.cpu.perCore).toStrictEqual([0]);
  });

  it('stringifies non-Error statfs rejections and defaults the error code', async () => {
    expect.hasAssertions();
    mockStatfs.mockRejectedValue('statfs blew up');
    const result = await collectHostMetrics({ projectRoot: '/project' });
    for (const volume of result.disk) {
      expect(volume).toMatchObject({ error: 'statfs blew up', code: 'DISK_STAT_ERROR' });
    }
  });

  it('defaults the error code when the statfs Error carries none', async () => {
    expect.hasAssertions();
    mockStatfs.mockRejectedValue(new Error('I/O weirdness'));
    const result = await collectHostMetrics({ projectRoot: '/project' });
    for (const volume of result.disk) {
      expect(volume).toMatchObject({ error: 'I/O weirdness', code: 'DISK_STAT_ERROR' });
    }
  });

  it('propagates the errno code when the statfs Error carries one', async () => {
    expect.hasAssertions();
    mockStatfs.mockRejectedValue(Object.assign(new Error('no space left on device'), { code: 'ENOSPC' }));
    const result = await collectHostMetrics({ projectRoot: '/project' });
    for (const volume of result.disk) {
      expect(volume).toMatchObject({ error: 'no space left on device', code: 'ENOSPC' });
    }
  });

  it('collects with defaulted options when called without arguments', async () => {
    expect.hasAssertions();
    const result = await collectHostMetrics();
    expect(result.memory).toMatchObject({ totalBytes: 1000, freeBytes: 400, usedBytes: 600 });
    expect(result.cpu.coreCount).toBe(1);
    expect(result.disk.length).toBeGreaterThan(0);
  });

  it('coerces missing or non-numeric statfs fields without inventing totals', async () => {
    expect.hasAssertions();
    mockStatfs.mockResolvedValue({
      blksize: 4096, blocks: 'many', bfree: 250, files: 'lots', ffree: undefined
    });
    const result = await collectHostMetrics({ projectRoot: '/project' });
    const volume = result.disk.find((entry: { path: string }) => entry.path === '/project');
    expect(volume).toMatchObject({
      blockSize: 4096,
      blocks: 0,
      blocksFree: 250,
      blocksAvailable: 250,
      files: 0,
      filesFree: 0,
      totalBytes: 0,
      freeBytes: 1024000,
      availableBytes: 1024000,
      usedBytes: 0,
      usedPercent: 0
    });
  });

  it('reports empty cpu metadata when the host exposes no cores', async () => {
    expect.hasAssertions();
    mockCpus.mockReturnValue([]);
    const result = await collectHostMetrics({ projectRoot: '/project' });
    expect(result.cpu).toMatchObject({
      coreCount: 0,
      model: '',
      speedMHz: 0,
      usagePercent: null,
      perCore: [],
      cpus: []
    });
  });

  it('defaults missing cpu model and non-numeric speed per core', async () => {
    expect.hasAssertions();
    mockCpus.mockReturnValue([
      { speed: 'fast', times: { ...healthyTimes } },
      { model: 'SecondCore', speed: 3000, times: { ...healthyTimes } }
    ]);
    const result = await collectHostMetrics({ projectRoot: '/project' });
    expect(result.cpu.model).toBe('');
    expect(result.cpu.speedMHz).toBe(0);
    expect(result.cpu.cpus[0]).toMatchObject({ model: '', speedMHz: 0 });
    expect(result.cpu.cpus[1]).toMatchObject({ model: 'SecondCore', speedMHz: 3000 });
  });

  it('clamps memory usage at zero when free exceeds total or rss exceeds used', async () => {
    expect.hasAssertions();
    mockTotalmem.mockReturnValue(0);
    mockFreemem.mockReturnValue(500);
    const result = await collectHostMetrics({ projectRoot: '/project', processRssSumBytes: 999 });
    expect(result.memory).toMatchObject({
      totalBytes: 0,
      freeBytes: 500,
      usedBytes: 0,
      usedPercent: 0,
      processRssSumBytes: 999,
      otherBytes: 0
    });
  });

  it('coerces non-numeric options and load-average entries to zero', async () => {
    expect.hasAssertions();
    mockLoadavg.mockReturnValue([NaN, undefined, 'x']);
    const result = await collectHostMetrics({
      projectRoot: '/project', processRssSumBytes: 'lots', processCpuPercentSum: null
    });
    expect(result.cpu.loadAvg).toStrictEqual({ one: 0, five: 0, fifteen: 0 });
    expect(result.cpu.processCpuPercentSum).toBe(0);
    expect(result.memory.processRssSumBytes).toBe(0);
  });
});

// Module marker: keeps the file out of the shared script scope (TS2451).
// eslint-disable-next-line jest/no-export
export {};
