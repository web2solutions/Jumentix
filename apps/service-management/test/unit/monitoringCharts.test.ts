/* eslint-disable jest/prefer-expect-assertions, jest/max-expects, import/first */

jest.mock('d3', () => {
  const chain = () => {
    const api: any = new Proxy(() => api, {
      get: () => api,
      apply: () => api
    });
    return api;
  };
  return {
    arc: chain,
    pie: () => (entries: unknown) => entries,
    scaleLinear: () => ({ domain: chain, range: chain }),
    scaleOrdinal: () => ({ domain: chain, range: chain }),
    max: (values: number[]) => Math.max(...values),
    min: (values: number[]) => Math.min(...values),
    sum: (values: unknown[], accessor?: (entry: any) => number) => values.reduce(
      (total: number, entry) => total + (accessor ? accessor(entry) : Number(entry) || 0),
      0
    )
  };
});

import { clamp, colorForStatus } from '../../src/ui/monitoringCharts.js';

describe('service-management monitoringCharts helpers', () => {
  it('clamps numeric ranges and maps PM2 status colors', () => {
    expect.hasAssertions();
    expect(clamp(150, 0, 100)).toBe(100);
    expect(clamp(-5, 0, 100)).toBe(0);
    expect(clamp(40, 0, 100)).toBe(40);
    expect(colorForStatus('online')).toBe('#1f9d55');
    expect(colorForStatus('errored')).toBe('#dc2626');
  });
});
