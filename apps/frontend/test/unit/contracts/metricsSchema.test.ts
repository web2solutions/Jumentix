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

  it('keeps a contract interval verbatim', () => {
    expect.hasAssertions();
    expect(asMetricsResult({ metric: 'series', interval: 'week', buckets: [] }))
      .toMatchObject({ metric: 'series', interval: 'week' });
  });

  it('returns undefined when the list operation has no metrics sibling', () => {
    expect.hasAssertions();
    expect(metricsSpecForListOperation('getOneById')).toBeUndefined();
  });

  it('returns undefined when the operation id is not in the document at all', () => {
    expect.hasAssertions();
    // Unlike getOneById (which exists but has no /metrics sibling), a wholly
    // unknown operation id exhausts the path search without a match.
    expect(metricsSpecForListOperation('noSuchOperation')).toBeUndefined();
  });
});
