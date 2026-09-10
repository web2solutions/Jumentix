/* eslint-disable jest/prefer-expect-assertions, jest/max-expects,
  jest/prefer-lowercase-title, jest/prefer-strict-equal */
import {
  Context,
  redactSensitive,
  resetAsyncContextMetricsForTests,
  runWithContext,
  snapshotAsyncContextMetrics
} from '@src/infra/context/Context';

describe('asyncLocalStorage context metrics + redact', () => {
  beforeEach(() => {
    resetAsyncContextMetricsForTests();
  });

  it('redacts sensitive keys and preserves correlationId in recentStores', () => {
    expect.hasAssertions();
    expect(redactSensitive({ authorization: 'Bearer secret', name: 'ok' })).toStrictEqual({
      authorization: '[REDACTED]',
      name: 'ok'
    });

    runWithContext(new Map<unknown, unknown>([
      ['correlationId', 'corr-abc'],
      ['authorization', 'Bearer xyz'],
      ['password', 'hunter2']
    ]), () => 'done');

    const snapshot = snapshotAsyncContextMetrics();
    expect(snapshot.enteredTotal).toBe(1);
    expect(snapshot.lastCorrelationIds).toContain('corr-abc');
    expect(snapshot.recentStores).toHaveLength(1);
    expect(snapshot.recentStores[0].entries).toMatchObject({
      correlationId: 'corr-abc',
      authorization: '[REDACTED]',
      password: '[REDACTED]'
    });
    expect(Context.getStore()).toBeUndefined();
  });
});
