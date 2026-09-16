/* eslint-disable jest/prefer-expect-assertions, jest/max-expects, import/first */
/*
 * JUM-770 — number formatting behind the monitoring chart headers: bytes,
 * percents, window min/max, throughput and stacked-area legends.
 */

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
    max: (values: number[]) => Math.max(...values),
    min: (values: number[]) => Math.min(...values),
    sum: (values: unknown[], accessor?: (entry: any) => number) => values.reduce(
      (total: number, entry) => total + (accessor ? accessor(entry) : Number(entry) || 0),
      0
    )
  };
});

import {
  STACK_PALETTE,
  computeWindowThroughput,
  formatBytesValue,
  formatPercentValue,
  formatSeriesSummary,
  formatThroughputValue,
  legendEntriesForStack,
  stackColorAt,
  summarizeSeries
} from '../../src/ui/monitoringCharts.js';

describe('service-management monitoring chart formatting (JUM-770)', () => {
  it('formats bytes as B/KB/MB/GB with one decimal from KB up', () => {
    expect.hasAssertions();
    expect(formatBytesValue(0)).toBe('0 B');
    expect(formatBytesValue(512)).toBe('512 B');
    expect(formatBytesValue(1536)).toBe('1.5 KB');
    expect(formatBytesValue(5 * 1024 ** 2)).toBe('5.0 MB');
    expect(formatBytesValue(2 * 1024 ** 3)).toBe('2.0 GB');
    expect(formatBytesValue(undefined)).toBe('0 B');
  });

  it('formats percents with configurable digits and an em-dash for non-numbers', () => {
    expect.hasAssertions();
    expect(formatPercentValue(42.4)).toBe('42%');
    expect(formatPercentValue(42.44, 1)).toBe('42.4%');
    expect(formatPercentValue(Number.NaN)).toBe('—');
  });

  it('summarizes a series window as current/min/max and null when empty', () => {
    expect.hasAssertions();
    expect(summarizeSeries([1, 5, 3])).toStrictEqual({
      current: 3, min: 1, max: 5, count: 3
    });
    expect(summarizeSeries([7])).toStrictEqual({
      current: 7, min: 7, max: 7, count: 1
    });
    expect(summarizeSeries([])).toBeNull();
    expect(summarizeSeries(null)).toBeNull();
    expect(summarizeSeries(['x', 2])).toStrictEqual({
      current: 2, min: 2, max: 2, count: 1
    });
  });

  it('renders the header line "now X · min Y · max Z" through the given formatter', () => {
    expect.hasAssertions();
    expect(formatSeriesSummary([10, 30, 20], (value) => `${value}%`)).toBe('now 20% · min 10% · max 30%');
    expect(formatSeriesSummary([], String)).toBe('—');
    expect(formatSeriesSummary([1024 ** 2], formatBytesValue)).toBe('now 1.0 MB · min 1.0 MB · max 1.0 MB');
  });

  it('computes throughput between the last two cumulative samples, clamped at zero', () => {
    expect.hasAssertions();
    expect(computeWindowThroughput([100, 250], 1)).toBe(150);
    expect(computeWindowThroughput([100, 250], 2)).toBe(75);
    expect(computeWindowThroughput([250, 100], 1)).toBe(0);
    expect(computeWindowThroughput([100], 1)).toBeNull();
    expect(computeWindowThroughput([], 1)).toBeNull();
  });

  it('formats throughput as bytes per second with an em-dash when unknown', () => {
    expect.hasAssertions();
    expect(formatThroughputValue(1536)).toBe('1.5 KB/s');
    expect(formatThroughputValue(null)).toBe('—');
    expect(formatThroughputValue(Number.NaN)).toBe('—');
  });

  it('builds stacked-area legends with palette colors and current values', () => {
    expect.hasAssertions();
    const entries = legendEntriesForStack({
      'jumentix-dev-restapi': [1, 2],
      'jumentix-dev-websocketapi': [3, 4]
    });
    expect(entries).toStrictEqual([
      { name: 'jumentix-dev-restapi', color: STACK_PALETTE[0], current: 2 },
      { name: 'jumentix-dev-websocketapi', color: STACK_PALETTE[1], current: 4 }
    ]);
    expect(legendEntriesForStack({})).toStrictEqual([]);
    expect(legendEntriesForStack({ a: [] })).toStrictEqual([
      { name: 'a', color: STACK_PALETTE[0], current: 0 }
    ]);
  });

  it('cycles the shared palette so legend swatches always match their area', () => {
    expect.hasAssertions();
    expect(stackColorAt(0)).toBe(STACK_PALETTE[0]);
    expect(stackColorAt(STACK_PALETTE.length)).toBe(STACK_PALETTE[0]);
    expect(stackColorAt(1, ['#fff'])).toBe('#fff');
  });
});
