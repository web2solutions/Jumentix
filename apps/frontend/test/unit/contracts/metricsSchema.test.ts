import { describe, expect, it } from 'bun:test';

import { asMetricsResult, metricsSpecForListOperation } from '@/contracts/metricsSchema';

describe('metricsSchema (JUM-812)', () => {
  it('normalizes a missing buckets array', () => {
    expect.hasAssertions();
    expect(asMetricsResult(null)).toStrictEqual({
      metric: 'count', field: undefined, interval: undefined, buckets: []
    });
    expect(asMetricsResult({ metric: 'groupBy', field: 'roles', buckets: [{ key: 'admin', count: 2 }] })).toMatchObject({
      metric: 'groupBy',
      field: 'roles',
      buckets: [{ key: 'admin', count: 2 }]
    });
  });

  it('returns undefined when the list operation has no metrics sibling', () => {
    expect.hasAssertions();
    expect(metricsSpecForListOperation('getOneById')).toBeUndefined();
  });
});
