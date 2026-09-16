/* eslint-disable jest/prefer-expect-assertions, jest/max-expects,
  jest/prefer-lowercase-title, jest/prefer-strict-equal */
import {
  Context,
  redactSensitive,
  resetAsyncContextMetricsForTests,
  runWithContext,
  snapshotAsyncContextMetrics
} from '@src/infra/context/Context';

/**
 * The instrumentation half of the context store.
 *
 * The suite beside this one covers the redaction happy path. What it does not
 * push are the bounds and the failure bookkeeping: the ring buffers that cap
 * `recentStores`, `lastCorrelationIds` and the duration samples, the error
 * counters for synchronous and asynchronous failures, and the serialization
 * fallback for values JSON cannot represent. A metrics endpoint that grows
 * without bound or that stops counting errors is worse than none — it reports
 * a healthy service that is not.
 */
describe('asyncLocalStorage context instrumentation', () => {
  beforeEach(() => {
    resetAsyncContextMetricsForTests();
  });

  it('serializes bigints, arrays, maps, plain objects and unserializable values', () => {
    expect.hasAssertions();

    const circular: Record<string, unknown> = {};
    circular.self = circular;

    runWithContext(new Map<unknown, unknown>([
      ['count', 1],
      ['big', 10n],
      ['list', ['a', 1]],
      ['lookup', new Map([['k', 'v']])],
      ['plain', { nested: true }],
      ['nothing', null],
      ['circular', circular],
      ['fn', () => 'x']
    ]), () => 'done');

    const { recentStores } = snapshotAsyncContextMetrics();
    expect(recentStores).toHaveLength(1);
    expect(recentStores[0].entries).toStrictEqual({
      count: 1,
      big: '10',
      list: ['a', 1],
      lookup: { k: 'v' },
      plain: { nested: true },
      nothing: null,
      circular: '[unserializable]',
      fn: expect.any(String)
    });
  });

  it('redacts arrays and nested objects by key hint at any depth', () => {
    expect.hasAssertions();

    expect(redactSensitive(['a', 'b'])).toStrictEqual(['a', 'b']);
    expect(redactSensitive('value', 'secretKey')).toBe('[REDACTED]');
    expect(redactSensitive({
      token: 'x',
      nested: { password: 'y', keep: 1 }
    })).toStrictEqual({
      token: '[REDACTED]',
      nested: { password: '[REDACTED]', keep: 1 }
    });
  });

  it('caps recent stores and correlation ids while totals keep counting', () => {
    expect.hasAssertions();

    for (let index = 0; index < 25; index += 1) {
      runWithContext(new Map([['correlationId', `corr-${index}`]]), () => index);
    }

    const snapshot = snapshotAsyncContextMetrics();
    expect(snapshot.enteredTotal).toBe(25);
    expect(snapshot.exitedTotal).toBe(25);
    expect(snapshot.recentStores).toHaveLength(20);
    expect(snapshot.lastCorrelationIds).toStrictEqual(
      Array.from({ length: 20 }, (_, offset) => `corr-${offset + 5}`)
    );
  });

  it('caps duration samples and still answers aggregate durations', () => {
    expect.hasAssertions();

    for (let index = 0; index < 260; index += 1) {
      runWithContext(new Map(), () => index);
    }

    const snapshot = snapshotAsyncContextMetrics();
    expect(snapshot.enteredTotal).toBe(260);
    expect(snapshot.avgDurationMs).toBeGreaterThanOrEqual(0);
    expect(snapshot.p95Ms).toBeGreaterThanOrEqual(0);
  });

  it('counts a rejected promise as an error and releases the active slot', async () => {
    expect.hasAssertions();

    await expect(runWithContext(new Map(), async () => {
      throw new Error('async boom');
    })).rejects.toThrow('async boom');

    const snapshot = snapshotAsyncContextMetrics();
    expect(snapshot.errorTotal).toBe(1);
    expect(snapshot.enteredTotal).toBe(1);
    expect(snapshot.exitedTotal).toBe(1);
    expect(snapshot.active).toBe(0);
  });

  it('counts a synchronous throw as an error and releases the active slot', () => {
    expect.hasAssertions();

    expect(() => runWithContext(new Map(), () => {
      throw new Error('sync boom');
    })).toThrow('sync boom');

    const snapshot = snapshotAsyncContextMetrics();
    expect(snapshot.errorTotal).toBe(1);
    expect(snapshot.exitedTotal).toBe(1);
    expect(snapshot.active).toBe(0);
  });

  it('resolves asynchronous results and exposes the current store during a run', async () => {
    expect.hasAssertions();

    const result = await runWithContext(new Map([['correlationId', 'corr-async']]), async () => {
      const during = snapshotAsyncContextMetrics();
      expect(during.active).toBe(1);
      expect(during.currentStore).toMatchObject({ correlationId: 'corr-async' });
      return 'value';
    });

    expect(result).toBe('value');
    const after = snapshotAsyncContextMetrics();
    expect(after.active).toBe(0);
    expect(after.errorTotal).toBe(0);
    expect(after.currentStore).toBeNull();
  });

  it('ignores a non-finite duration sample instead of poisoning the average', () => {
    expect.hasAssertions();

    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(NaN);
    try {
      runWithContext(new Map(), () => 'x');
    } finally {
      nowSpy.mockRestore();
    }

    const snapshot = snapshotAsyncContextMetrics();
    expect(snapshot.exitedTotal).toBe(1);
    expect(snapshot.avgDurationMs).toBe(0);
    expect(snapshot.p95Ms).toBe(0);
  });

  it('skips correlation tracking for non-map stores and non-string ids', () => {
    expect.hasAssertions();

    runWithContext(new Map([['correlationId', 123]]), () => 'numeric');
    runWithContext(new Map([['correlationId', '']]), () => 'empty');
    runWithContext('not-a-map' as never, () => 'opaque');

    const snapshot = snapshotAsyncContextMetrics();
    expect(snapshot.enteredTotal).toBe(3);
    expect(snapshot.lastCorrelationIds).toStrictEqual([]);
    expect(snapshot.recentStores[2].entries).toStrictEqual({});
  });

  it('counts a double-settling thenable only once', () => {
    expect.hasAssertions();

    // A thenable that calls both callbacks settles twice: the first settle
    // finishes the bookkeeping, and the rejection callback's rethrow escapes
    // synchronously — but neither the exit nor an error is counted twice.
    const doubleSettling = {
      then: (onFulfilled: (value: unknown) => void, onRejected: (error: unknown) => void) => {
        onFulfilled('value');
        onRejected(new Error('late rejection'));
      }
    };

    expect(() => runWithContext(new Map(), () => doubleSettling as never))
      .toThrow('late rejection');

    const snapshot = snapshotAsyncContextMetrics();
    expect(snapshot.enteredTotal).toBe(1);
    expect(snapshot.exitedTotal).toBe(1);
    expect(snapshot.errorTotal).toBe(0);
    expect(snapshot.active).toBe(0);
  });

  // Last on purpose: `disable` turns the shared AsyncLocalStorage off for the
  // rest of this file.
  it('supports enterWith for synchronous entry and disable for teardown', () => {
    expect.hasAssertions();

    Context.enterWith(new Map([['correlationId', 'entered']]));
    expect(Context.getStore()?.get('correlationId')).toBe('entered');
    expect(snapshotAsyncContextMetrics().currentStore)
      .toMatchObject({ correlationId: 'entered' });

    Context.disable();
    expect(Context.getStore()).toBeUndefined();
    expect(snapshotAsyncContextMetrics().currentStore).toBeNull();
  });
});
