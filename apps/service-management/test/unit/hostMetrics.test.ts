/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
import path from 'node:path';

const { collectHostMetrics } = require('../../src/runtime/hostMetrics');

describe('service-management hostMetrics', () => {
  it('returns CPU, memory and disk volumes for the project root', async () => {
    expect.hasAssertions();
    const first = await collectHostMetrics({
      projectRoot: path.resolve(process.cwd()),
      processRssSumBytes: 1024,
      processCpuPercentSum: 1.5
    });
    const second = await collectHostMetrics({
      projectRoot: path.resolve(process.cwd()),
      processRssSumBytes: 2048,
      processCpuPercentSum: 2.5
    });

    expect(first.cpu).toMatchObject({
      coreCount: expect.any(Number),
      loadAvg: {
        one: expect.any(Number),
        five: expect.any(Number),
        fifteen: expect.any(Number)
      }
    });
    expect(first.memory.processRssSumBytes).toBe(1024);
    expect(Array.isArray(first.disk)).toBe(true);
    expect(first.disk.length).toBeGreaterThan(0);
    expect(second.memory.processRssSumBytes).toBe(2048);
  });
});
