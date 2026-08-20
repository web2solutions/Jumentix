import { DeadLetterQueue, DeadLetterReplayWorker } from '../src';

/**
 * JUM-53 — the drain that a queue is useless without.
 *
 * Each test here is a way a naive timer loop goes wrong while still looking
 * like it works.
 */

/** A queue whose drain is a spy: the worker's job is to call it, and to stop. */
function queueDouble() {
  return {
    enqueue: jest.fn(),
    pending: jest.fn(),
    replay: jest.fn().mockResolvedValue({
      replayed: [], retried: [], abandoned: [], skipped: []
    })
  };
}

/** A controllable interval, so the tests measure behaviour rather than wait. */
function fakeTimers() {
  const ticks: Array<() => void> = [];
  return {
    ticks,
    setIntervalFn: ((handler: () => void) => {
      ticks.push(handler);
      return { unref: () => undefined } as unknown as ReturnType<typeof setInterval>;
    }) as unknown as typeof setInterval,
    clearIntervalFn: (() => { ticks.length = 0; }) as unknown as typeof clearInterval,
    fire() { ticks.forEach((handler) => handler()); }
  };
}

function queueWithOnePending() {
  const queue = new DeadLetterQueue();
  return queue.enqueue({
    entityName: 'User', resourceId: 'user-1', operation: 'update', payload: { firstName: 'Ada' }
  }).then(() => queue);
}

describe('deadLetterReplayWorker (JUM-53)', () => {
  it('drains the queue when it ticks', async () => {
    expect.hasAssertions();

    const queue = await queueWithOnePending();
    const applied: string[] = [];
    const worker = new DeadLetterReplayWorker({
      queue,
      handlers: { update: async (record) => { applied.push(record.resourceId); } }
    });

    const report = await worker.tick();

    expect(report?.replayed).toHaveLength(1);
    expect(applied).toStrictEqual(['user-1']);
    await expect(queue.pending()).resolves.toStrictEqual([]);
  });

  it('does not start a second drain while the first is still running', async () => {
    expect.hasAssertions();

    // A drain slower than the interval would otherwise replay the same record
    // twice concurrently — the duplicate write this design exists to avoid.
    const queue = await queueWithOnePending();
    let release: () => void = () => undefined;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    let calls = 0;
    const worker = new DeadLetterReplayWorker({
      queue,
      handlers: { update: async () => { calls += 1; await blocked; } }
    });

    const first = worker.tick();
    const second = await worker.tick();

    // The second tick returns immediately without draining. `calls` is not
    // asserted here: the first drain is still inside `pending()` at this point,
    // so a count now would measure scheduling, not overlap.
    expect(second).toBeUndefined();

    release();
    await first;

    expect(calls).toBe(1);
  });

  it('survives a drain that throws, and drains again on the next tick', async () => {
    expect.hasAssertions();

    // Redis down is a bad tick, not the end of the worker. One that dies on the
    // first error is indistinguishable from one never started.
    const failures: unknown[] = [];
    const queue = queueDouble();
    queue.replay
      .mockRejectedValueOnce(new Error('redis unreachable'))
      .mockResolvedValueOnce({
        replayed: ['dlq-1'], retried: [], abandoned: [], skipped: []
      });
    const worker = new DeadLetterReplayWorker({
      queue: queue as never,
      handlers: { update: async () => undefined },
      onError: (error) => failures.push(error)
    });

    const bad = await worker.tick();
    const good = await worker.tick();

    expect(bad).toBeUndefined();
    expect(failures).toHaveLength(1);
    expect(good?.replayed).toStrictEqual(['dlq-1']);
  });

  it('runs on the interval once started, and not after it is stopped', async () => {
    expect.hasAssertions();

    const timers = fakeTimers();
    const queue = queueDouble();
    const worker = new DeadLetterReplayWorker({
      queue: queue as never,
      handlers: { update: async () => undefined },
      intervalMs: 1000,
      setIntervalFn: timers.setIntervalFn,
      clearIntervalFn: timers.clearIntervalFn
    });

    worker.start();

    expect(worker.running).toBe(true);
    timers.fire();
    await Promise.resolve();

    expect(queue.replay).toHaveBeenCalledTimes(1);

    worker.stop();

    expect(worker.running).toBe(false);
    timers.fire();
    await Promise.resolve();

    expect(queue.replay).toHaveBeenCalledTimes(1);
  });

  it('starting twice does not double the drains', async () => {
    expect.hasAssertions();

    const timers = fakeTimers();
    const queue = queueDouble();
    const worker = new DeadLetterReplayWorker({
      queue: queue as never,
      handlers: { update: async () => undefined },
      setIntervalFn: timers.setIntervalFn,
      clearIntervalFn: timers.clearIntervalFn
    });

    worker.start();
    worker.start();
    timers.fire();
    await Promise.resolve();

    expect(queue.replay).toHaveBeenCalledTimes(1);
    worker.stop();
  });

  it('refuses a configuration that would drain nothing for ever', () => {
    expect.hasAssertions();

    // A worker with no handlers skips every record and reports success, which
    // reads exactly like a working one.
    expect(() => new DeadLetterReplayWorker({ queue: {} as never, handlers: {} }))
      .toThrow('at least one handler');
    expect(() => new DeadLetterReplayWorker({
      queue: undefined as never, handlers: { a: async () => undefined }
    })).toThrow('requires a queue');
    expect(() => new DeadLetterReplayWorker({
      queue: {} as never, handlers: { a: async () => undefined }, intervalMs: 0
    })).toThrow('positive intervalMs');
  });
});
