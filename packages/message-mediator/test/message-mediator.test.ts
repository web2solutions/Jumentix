import {
  BullMqMessageMediatorAdapter,
  InMemoryMessageMediatorAdapter,
  RabbitMqMessageMediatorAdapter,
  compileMessageMediator
} from '../src';
import type { IIntegrationEvent, IMessage, IMessageResponse } from '../src';

/**
 * Requirement 112 — this package owns its suite.
 *
 * The in-memory mediator is what every application here runs on by default and
 * what every test of anything else runs on, so a fault in it is a fault
 * everywhere at once, wearing someone else's name. It is covered in full.
 *
 * The RabbitMQ and BullMQ adapters talk to brokers: unit tests cover the
 * configuration the compiler assembles (wrong port / dropped credential), and
 * `test/integration/brokers.integration.test.ts` measures the live path under
 * `RUN_BROKER_INTEGRATION` against real RabbitMQ/Redis in the coverage gate.
 */

const message = (over: Partial<IMessage> = {}): IMessage => ({
  contract: 'orders.create',
  version: '1.0.0',
  payload: { id: 1 },
  metadata: { requestId: 'r-1' },
  ...over
});

const answering = (result: unknown = { ok: true }) => async (): Promise<IMessageResponse> => ({
  contract: 'orders.create',
  result
});

/** Runs `body` with the environment applied, and puts it back afterwards. */
async function withEnvironment<T>(
  values: Record<string, string | undefined>,
  body: () => T | Promise<T>
): Promise<T> {
  const previous = Object.keys(values).map((name): [string, string | undefined] => [
    name, process.env[name]
  ]);

  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }

  try {
    return await body();
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

describe('publishing events', () => {
  it('delivers an event to every subscriber', async () => {
    expect.hasAssertions();

    const mediator = new InMemoryMessageMediatorAdapter();
    const seen: string[] = [];

    mediator.subscribe('order.created', () => { seen.push('first'); });
    mediator.subscribe('order.created', () => { seen.push('second'); });

    await mediator.publish({
      name: 'order.created', payload: {}, occurredAt: '2026-01-01T00:00:00.000Z'
    });

    expect(seen).toStrictEqual(['first', 'second']);
  });

  it('delivers only to subscribers of that event', async () => {
    expect.hasAssertions();

    const mediator = new InMemoryMessageMediatorAdapter();
    let other = 0;

    mediator.subscribe('order.shipped', () => { other += 1; });

    await mediator.publish({
      name: 'order.created', payload: {}, occurredAt: '2026-01-01T00:00:00.000Z'
    });

    expect(other).toBe(0);
  });

  it('publishes to nobody without complaint', async () => {
    expect.hasAssertions();

    const mediator = new InMemoryMessageMediatorAdapter();

    // An event with no subscribers is normal, not an error: publishers are not
    // supposed to know who is listening.
    await expect(mediator.publish({
      name: 'nobody.listening', payload: {}, occurredAt: '2026-01-01T00:00:00.000Z'
    })).resolves.toBeUndefined();
  });

  it('passes the whole event through', async () => {
    expect.hasAssertions();

    const mediator = new InMemoryMessageMediatorAdapter();
    const received: IIntegrationEvent[] = [];
    const event: IIntegrationEvent = {
      name: 'order.created',
      payload: { id: 7 },
      occurredAt: '2026-01-01T00:00:00.000Z',
      metadata: { correlationId: 'c-1' }
    };

    mediator.subscribe('order.created', (delivered) => { received.push(delivered); });
    await mediator.publish(event);

    expect(received).toStrictEqual([event]);
  });

  /**
   * `publish` awaits its listeners. A subscriber that writes to a database has
   * to have finished before the publisher moves on, or the next step reads a
   * state that has not been written yet.
   */
  it('waits for an asynchronous subscriber to finish', async () => {
    expect.hasAssertions();

    const mediator = new InMemoryMessageMediatorAdapter();
    let done = false;

    // JUM-679: the subscriber is held open by this test rather than by a 10ms
    // sleep, which proves the property better than the sleep did. `publish` is
    // started and *not* awaited; the flag is still false while the subscriber
    // is blocked, and only becomes true once the publish resolves. A sleep
    // could only ever show that 10ms had passed.
    let releaseSubscriber: () => void = () => undefined;
    const subscriberWork = new Promise<void>((resolve) => { releaseSubscriber = resolve; });

    mediator.subscribe('order.created', async () => {
      await subscriberWork;
      done = true;
    });

    const publishing = mediator.publish({
      name: 'order.created', payload: {}, occurredAt: '2026-01-01T00:00:00.000Z'
    });

    expect(done).toBe(false);

    releaseSubscriber();
    await publishing;

    expect(done).toBe(true);
  });

  /**
   * `Promise.all` rejects on the first failure, so one bad subscriber fails the
   * publish for the publisher. Pinned as the behaviour it is: whether a failing
   * listener should stop a publish is a real question, and the answer today is
   * yes.
   */
  it('fails the publish when a subscriber throws', async () => {
    expect.hasAssertions();

    const mediator = new InMemoryMessageMediatorAdapter();

    mediator.subscribe('order.created', () => { throw new Error('listener failed'); });

    await expect(mediator.publish({
      name: 'order.created', payload: {}, occurredAt: '2026-01-01T00:00:00.000Z'
    })).rejects.toThrow('listener failed');
  });
});

describe('bullMQ queue infrastructure readiness', () => {
  const deferred = () => {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((done, fail) => {
      resolve = done;
      reject = fail;
    });
    return { promise, reject, resolve };
  };

  const createBullMqHarness = (
    readinessByName: Record<string, { events: Promise<void>; worker: Promise<void> }>,
    // JUM-621: the job options were discarded here, so nothing could assert on
    // them, and `removeOnComplete: true` — which deletes the result before the
    // caller can read it — was invisible to this suite.
    finish: () => Promise<unknown> = async () => ({ contract: 'orders.create', result: 'ok' })
  ) => {
    const added: string[] = [];
    const addedOptions: unknown[] = [];
    const closed: string[] = [];
    const mutableReadinessByName = { ...readinessByName };
    const waitsByName: Record<string, { events: number; worker: number }> = {};
    const ensureQueue = (name: string) => {
      if (!waitsByName[name]) waitsByName[name] = { events: 0, worker: 0 };
      if (!mutableReadinessByName[name]) {
        mutableReadinessByName[name] = { events: Promise.resolve(), worker: Promise.resolve() };
      }
    };

    function Queue(
      this: { name: string; add: () => Promise<unknown>; close: () => Promise<void> },
      name: string
    ) {
      this.name = name;
      ensureQueue(name);
      this.add = async (_routeKey?: unknown, _data?: unknown, jobOptions?: unknown) => {
        added.push(this.name);
        addedOptions.push(jobOptions);
        return { waitUntilFinished: finish };
      };
      this.close = async () => { closed.push(`queue:${this.name}`); };
    }

    function QueueEvents(this: {
      name: string;
      waitUntilReady: () => Promise<void>;
      close: () => Promise<void>;
    }, name: string) {
      this.name = name;
      ensureQueue(name);
      this.waitUntilReady = async () => {
        waitsByName[this.name].events += 1;
        await mutableReadinessByName[this.name].events;
      };
      this.close = async () => { closed.push(`events:${this.name}`); };
    }

    function Worker(this: {
      name: string;
      processor: (job: unknown) => Promise<unknown>;
      waitUntilReady: () => Promise<void>;
      close: () => Promise<void>;
    }, name: string, processor: (job: unknown) => Promise<unknown>) {
      this.name = name;
      this.processor = processor;
      ensureQueue(name);
      this.waitUntilReady = async () => {
        waitsByName[this.name].worker += 1;
        await mutableReadinessByName[this.name].worker;
      };
      this.close = async () => { closed.push(`worker:${this.name}`); };
    }

    return {
      added,
      addedOptions,
      closed,
      module: { Queue, QueueEvents, Worker },
      readinessByName: mutableReadinessByName,
      waitsByName
    };
  };

  /**
   * JUM-621 — the two halves of the intermittent BullMQ failure, made
   * deterministic.
   *
   * The integration suite proved the behaviour against a real Redis; these two
   * hold the invariants in place without one. Both failed before the fix.
   */
  const withHarness = async (
    harness: { module: unknown },
    body: () => Promise<void>
  ) => {
    const original = BullMqMessageMediatorAdapter.importBullMq;
    BullMqMessageMediatorAdapter.importBullMq = async () => harness.module;
    try {
      await body();
    } finally {
      BullMqMessageMediatorAdapter.importBullMq = original;
    }
  };

  it('keeps a finished job long enough for the caller to read its result', async () => {
    expect.hasAssertions();

    // `removeOnComplete: true` deletes the job the moment the worker finishes.
    // `waitUntilFinished` polls `isFinished` once to catch a job that finished
    // before it subscribed, and that poll then fails with `Missing key for job`
    // — a correct answer reported as a failure, whenever the worker wins.
    const harness = createBullMqHarness({});

    await withHarness(harness, async () => {
      const mediator = new BullMqMessageMediatorAdapter({
        connection: { host: '127.0.0.1', port: 6379 }
      });
      // Both sides of the floor: a short timeout still keeps the job for the
      // 60s minimum, and a long one keeps it for as long as someone may wait.
      await mediator.request(message(), { queueName: 'retention.queue', timeoutMs: 20000 });
      await mediator.request(message(), { queueName: 'retention.queue', timeoutMs: 120000 });

      expect(harness.addedOptions).toStrictEqual([
        {
          removeOnComplete: { age: 60, count: 1000 },
          removeOnFail: { age: 60, count: 1000 }
        },
        {
          removeOnComplete: { age: 120, count: 1000 },
          removeOnFail: { age: 120, count: 1000 }
        }
      ]);

      await mediator.disconnect();
    });
  });

  it('does not report a non-timeout failure as a timeout', async () => {
    expect.hasAssertions();

    // The missing-key rejection arrives in single-digit milliseconds. Reporting
    // it as `timed out after 20000ms` names a duration that never elapsed, and
    // is why JUM-621 was filed against the test rather than the adapter.
    const missingKey = createBullMqHarness({}, async () => {
      throw new Error('Missing key for job bull:q:1. isFinished');
    });

    await withHarness(missingKey, async () => {
      const mediator = new BullMqMessageMediatorAdapter({
        connection: { host: '127.0.0.1', port: 6379 }
      });
      const response = await mediator.request(message(), {
        queueName: 'cause.queue',
        timeoutMs: 20000
      });

      expect((response.error as Error).message)
        .toBe('Message request failed: Missing key for job bull:q:1. isFinished');

      await mediator.disconnect();
    });

    const timedOut = createBullMqHarness({}, async () => {
      throw new Error('Job wait x timed out before finishing, no finish notification arrived after 20000ms (id=1)');
    });

    await withHarness(timedOut, async () => {
      const mediator = new BullMqMessageMediatorAdapter({
        connection: { host: '127.0.0.1', port: 6379 }
      });
      const response = await mediator.request(message(), {
        queueName: 'timeout.queue',
        timeoutMs: 20000
      });

      // A real timeout still reads as one.
      expect((response.error as Error).message).toBe('Message request timed out after 20000ms');

      await mediator.disconnect();
    });
  });

  it('makes concurrent callers wait for the same queue setup before enqueueing', async () => {
    expect.assertions(4);

    const queueName = 'slow.queue';
    const eventsReady = deferred();
    const workerReady = deferred();
    const harness = createBullMqHarness({
      [queueName]: { events: eventsReady.promise, worker: workerReady.promise }
    });

    const original = BullMqMessageMediatorAdapter.importBullMq;
    BullMqMessageMediatorAdapter.importBullMq = async () => harness.module;

    try {
      const mediator = new BullMqMessageMediatorAdapter({
        connection: { host: '127.0.0.1', port: 6379 }
      });
      await mediator.connect();

      const first = mediator.request(message(), { queueName, timeoutMs: 20000 });
      const second = mediator.request(message(), { queueName, timeoutMs: 20000 });

      await Promise.resolve();

      expect({ added: harness.added, waits: harness.waitsByName[queueName] }).toStrictEqual({
        added: [],
        waits: { events: 1, worker: 0 }
      });

      eventsReady.resolve();
      await new Promise((resolve) => { setTimeout(resolve, 0); });

      expect({ added: harness.added, waits: harness.waitsByName[queueName] }).toStrictEqual({
        added: [],
        waits: { events: 1, worker: 1 }
      });

      workerReady.resolve();

      await expect(Promise.all([first, second])).resolves.toStrictEqual([
        { contract: 'orders.create', result: 'ok' },
        { contract: 'orders.create', result: 'ok' }
      ]);
      expect({ added: harness.added, waits: harness.waitsByName[queueName] }).toStrictEqual({
        added: [queueName, queueName],
        waits: { events: 1, worker: 1 }
      });

      await mediator.disconnect();
    } finally {
      BullMqMessageMediatorAdapter.importBullMq = original;
    }
  });

  it('closes clients built by a failed queue setup before a retry', async () => {
    expect.assertions(3);

    const queueName = 'failing.queue';
    const eventsReady = deferred();
    const readinessByName = {
      [queueName]: { events: eventsReady.promise, worker: Promise.resolve() }
    };
    const harness = createBullMqHarness(readinessByName);
    const original = BullMqMessageMediatorAdapter.importBullMq;
    BullMqMessageMediatorAdapter.importBullMq = async () => harness.module;

    try {
      const mediator = new BullMqMessageMediatorAdapter({
        connection: { host: '127.0.0.1', port: 6379 }
      });
      await mediator.connect();

      const first = mediator.request(message(), { queueName, timeoutMs: 20000 });
      eventsReady.reject(new Error('queue-events-not-ready'));

      await expect(first).rejects.toThrow('queue-events-not-ready');
      expect(harness.closed).toStrictEqual([
        `queue:${queueName}`,
        `events:${queueName}`
      ]);

      harness.closed.length = 0;
      harness.waitsByName[queueName] = { events: 0, worker: 0 };
      harness.readinessByName[queueName] = {
        events: Promise.resolve(),
        worker: Promise.resolve()
      };

      await expect(mediator.request(message(), { queueName, timeoutMs: 20000 }))
        .resolves.toMatchObject({ result: 'ok' });

      await mediator.disconnect();
    } finally {
      BullMqMessageMediatorAdapter.importBullMq = original;
    }
  });

  it('lets disconnect close clients from setup that was already in flight', async () => {
    expect.assertions(3);

    const queueName = 'disconnect.queue';
    const eventsReady = deferred();
    const workerReady = deferred();
    const harness = createBullMqHarness({
      [queueName]: { events: eventsReady.promise, worker: workerReady.promise }
    });
    const original = BullMqMessageMediatorAdapter.importBullMq;
    BullMqMessageMediatorAdapter.importBullMq = async () => harness.module;

    try {
      const mediator = new BullMqMessageMediatorAdapter({
        connection: { host: '127.0.0.1', port: 6379 }
      });
      await mediator.connect();

      const request = mediator.request(message(), { queueName, timeoutMs: 20000 });
      await Promise.resolve();

      const disconnect = mediator.disconnect();
      await Promise.resolve();

      expect(harness.closed).toStrictEqual([]);

      eventsReady.resolve();
      workerReady.resolve();

      await expect(Promise.all([request, disconnect])).resolves.toBeDefined();
      expect(harness.closed).toStrictEqual(expect.arrayContaining([
        `queue:${queueName}`,
        `events:${queueName}`,
        `worker:${queueName}`
      ]));
    } finally {
      BullMqMessageMediatorAdapter.importBullMq = original;
    }
  });
});

describe('routing a request to a handler', () => {
  it('reaches the handler registered for the contract', async () => {
    expect.hasAssertions();

    const mediator = new InMemoryMessageMediatorAdapter();
    mediator.registerHandler('orders.create', answering({ id: 9 }));

    await expect(mediator.request(message())).resolves.toMatchObject({ result: { id: 9 } });
  });

  it('hands the whole message to the handler', async () => {
    expect.hasAssertions();

    const mediator = new InMemoryMessageMediatorAdapter();
    const received: IMessage[] = [];

    mediator.registerHandler('orders.create', async (incoming) => {
      received.push(incoming);
      return { contract: incoming.contract };
    });

    const sent = message();
    await mediator.request(sent);

    expect(received).toStrictEqual([sent]);
  });

  /**
   * Route key and queue name take precedence over the contract, in that order.
   * That is how one contract is served by more than one handler, and getting
   * the precedence wrong silently sends the message to the wrong one.
   */
  it('prefers a handler matched by route key', async () => {
    expect.hasAssertions();

    const mediator = new InMemoryMessageMediatorAdapter();
    mediator.registerHandler('orders.create', answering('by-contract'));
    mediator.registerHandler('orders.create.priority', answering('by-route'), {
      routeKey: 'priority'
    });

    await expect(mediator.request(message(), { routeKey: 'priority' }))
      .resolves.toMatchObject({ result: 'by-route' });
  });

  it('prefers a handler matched by queue name', async () => {
    expect.hasAssertions();

    const mediator = new InMemoryMessageMediatorAdapter();
    mediator.registerHandler('orders.create', answering('by-contract'));
    mediator.registerHandler('orders.create.batch', answering('by-queue'), {
      queueName: 'batch'
    });

    await expect(mediator.request(message(), { queueName: 'batch' }))
      .resolves.toMatchObject({ result: 'by-queue' });
  });

  it('prefers the route key over the queue name', async () => {
    expect.hasAssertions();

    const mediator = new InMemoryMessageMediatorAdapter();
    mediator.registerHandler('a', answering('by-route'), { routeKey: 'priority' });
    mediator.registerHandler('b', answering('by-queue'), { queueName: 'batch' });
    mediator.registerHandler('orders.create', answering('by-contract'));

    await expect(mediator.request(message(), { routeKey: 'priority', queueName: 'batch' }))
      .resolves.toMatchObject({ result: 'by-route' });
  });

  it('falls back to the contract when the route key matches nothing', async () => {
    expect.hasAssertions();

    const mediator = new InMemoryMessageMediatorAdapter();
    mediator.registerHandler('orders.create', answering('by-contract'));

    await expect(mediator.request(message(), { routeKey: 'no-such-route' }))
      .resolves.toMatchObject({ result: 'by-contract' });
  });

  it('falls back to the contract when the queue name matches nothing', async () => {
    expect.hasAssertions();

    const mediator = new InMemoryMessageMediatorAdapter();
    mediator.registerHandler('orders.create', answering('by-contract'));

    await expect(mediator.request(message(), { queueName: 'no-such-queue' }))
      .resolves.toMatchObject({ result: 'by-contract' });
  });

  it('registers a handler under all three keys at once', async () => {
    expect.hasAssertions();

    const mediator = new InMemoryMessageMediatorAdapter();
    mediator.registerHandler('orders.create', answering('the-one'), {
      routeKey: 'priority',
      queueName: 'batch'
    });

    await expect(mediator.request(message(), { routeKey: 'priority' }))
      .resolves.toMatchObject({ result: 'the-one' });
    await expect(mediator.request(message(), { queueName: 'batch' }))
      .resolves.toMatchObject({ result: 'the-one' });
    await expect(mediator.request(message()))
      .resolves.toMatchObject({ result: 'the-one' });
  });

  it('replaces a handler registered twice for the same contract', async () => {
    expect.hasAssertions();

    const mediator = new InMemoryMessageMediatorAdapter();
    mediator.registerHandler('orders.create', answering('first'));
    mediator.registerHandler('orders.create', answering('second'));

    // Last registration wins. Worth pinning either way: silently keeping the
    // first would make a re-registration a no-op that nobody could see.
    await expect(mediator.request(message())).resolves.toMatchObject({ result: 'second' });
  });
});

describe('when a request cannot be served', () => {
  /**
   * An unrouted message comes back as a response carrying an error, not as a
   * rejection. Callers of `request` treat the resolved value as the answer, so
   * this is the difference between a caller that sees the failure and one that
   * reads `result: undefined` as an empty answer.
   */
  it('answers with an error rather than rejecting', async () => {
    expect.hasAssertions();

    const mediator = new InMemoryMessageMediatorAdapter();
    const response = await mediator.request(message());

    expect(response.error).toStrictEqual(
      new Error('No handler registered for contract orders.create')
    );
    expect(response.result).toBeUndefined();
  });

  it('echoes the contract, version and metadata back with the error', async () => {
    expect.hasAssertions();

    const mediator = new InMemoryMessageMediatorAdapter();
    const response = await mediator.request(message());

    // The correlation identifiers are how a caller ties the failure to what it
    // sent; dropping them makes the error unattributable.
    expect(response).toMatchObject({
      contract: 'orders.create',
      version: '1.0.0',
      metadata: { requestId: 'r-1' }
    });
  });

  it('reports a handler that threw as an error response', async () => {
    expect.hasAssertions();

    const mediator = new InMemoryMessageMediatorAdapter();
    mediator.registerHandler('orders.create', () => { throw new Error('handler failed'); });

    const response = await mediator.request(message());

    expect(response.error).toStrictEqual(new Error('handler failed'));
    expect(response).toMatchObject({ contract: 'orders.create', version: '1.0.0' });
  });

  it('reports a handler that rejected as an error response', async () => {
    expect.hasAssertions();

    const mediator = new InMemoryMessageMediatorAdapter();
    mediator.registerHandler('orders.create', async () => {
      throw new Error('handler rejected');
    });

    await expect(mediator.request(message()))
      .resolves.toMatchObject({ error: new Error('handler rejected') });
  });
});

describe('the response the caller gets back', () => {
  it('keeps what the handler set', async () => {
    expect.hasAssertions();

    const mediator = new InMemoryMessageMediatorAdapter();
    mediator.registerHandler('orders.create', async () => ({
      contract: 'orders.created',
      version: '2.0.0',
      metadata: { requestId: 'from-handler' },
      result: { id: 1 }
    }));

    await expect(mediator.request(message())).resolves.toStrictEqual({
      contract: 'orders.created',
      version: '2.0.0',
      metadata: { requestId: 'from-handler' },
      result: { id: 1 }
    });
  });

  /**
   * A handler that answers with only a result still produces a response that
   * can be correlated, because the mediator fills the fields back in from the
   * request.
   */
  it('fills in the contract, version and metadata the handler left out', async () => {
    expect.hasAssertions();

    const mediator = new InMemoryMessageMediatorAdapter();
    mediator.registerHandler('orders.create', (async () => ({ result: 'bare' })) as never);

    await expect(mediator.request(message())).resolves.toStrictEqual({
      contract: 'orders.create',
      version: '1.0.0',
      metadata: { requestId: 'r-1' },
      result: 'bare'
    });
  });

  it('accepts a handler that answers synchronously', async () => {
    expect.hasAssertions();

    const mediator = new InMemoryMessageMediatorAdapter();
    mediator.registerHandler('orders.create', () => ({
      contract: 'orders.create', result: 'sync'
    }));

    await expect(mediator.request(message())).resolves.toMatchObject({ result: 'sync' });
  });
});

describe('request timeouts', () => {
  /** A handler that never answers, and never will. */
  const neverAnswers = () => new Promise<IMessageResponse>(() => {});

  it('gives up on a handler that does not answer in time', async () => {
    expect.hasAssertions();

    const mediator = new InMemoryMessageMediatorAdapter();
    mediator.registerHandler('orders.create', neverAnswers);

    const response = await mediator.request(message(), { timeoutMs: 20 });

    // Reported as an error response, like every other failure here — the caller
    // is not left waiting and is not made to catch.
    expect(response.error).toStrictEqual(new Error('Message request timed out after 20ms'));
  });

  it('lets a handler that answers in time through', async () => {
    expect.hasAssertions();

    const mediator = new InMemoryMessageMediatorAdapter();
    mediator.registerHandler('orders.create', answering('in-time'));

    await expect(mediator.request(message(), { timeoutMs: 1000 }))
      .resolves.toMatchObject({ result: 'in-time' });
  });

  /**
   * No timeout means no timer, which is the difference between a mediator that
   * waits for a slow handler and one that leaves a pending timer behind for
   * every request it ever served.
   */
  it.each([[undefined], [0], [-1]])('waits indefinitely when the timeout is %p', async (
    timeoutMs: number | undefined
  ) => {
    expect.hasAssertions();

    const mediator = new InMemoryMessageMediatorAdapter();
    // JUM-679: held open rather than slept through. "Waits indefinitely" is
    // shown by the request still being pending while the handler is blocked —
    // a 30ms sleep only showed that it waited 30ms, which every timeout does.
    let releaseHandler: () => void = () => undefined;
    const handlerWork = new Promise<void>((resolve) => { releaseHandler = resolve; });
    mediator.registerHandler('orders.create', async () => {
      await handlerWork;
      return { contract: 'orders.create', result: 'slow but fine' };
    });

    const pending = mediator.request(message(), { timeoutMs });
    let settled = false;
    pending.then(() => { settled = true; }).catch(() => undefined);
    await Promise.resolve();

    expect(settled).toBe(false);

    releaseHandler();

    await expect(pending).resolves.toMatchObject({ result: 'slow but fine' });
  });
});

describe('compiling a mediator', () => {
  it('builds the in-memory adapter by default', async () => {
    expect.hasAssertions();

    const mediator = await withEnvironment(
      { JUMENTIX_MESSAGE_MEDIATOR_ADAPTER: undefined },
      () => compileMessageMediator()
    );

    expect(mediator).toBeInstanceOf(InMemoryMessageMediatorAdapter);
  });

  it.each(['inmemory', 'INMEMORY', '  inmemory  ', 'nonsense', ''])(
    'builds the in-memory adapter for %p',
    async (adapter: string) => {
      expect.hasAssertions();

      const mediator = await withEnvironment(
        { JUMENTIX_MESSAGE_MEDIATOR_ADAPTER: adapter },
        () => compileMessageMediator()
      );

      expect(mediator).toBeInstanceOf(InMemoryMessageMediatorAdapter);
    }
  );

  it('hands out a fresh in-memory mediator each time', async () => {
    expect.hasAssertions();

    const first = await withEnvironment(
      { JUMENTIX_MESSAGE_MEDIATOR_ADAPTER: 'inmemory' },
      () => compileMessageMediator()
    );
    const second = await withEnvironment(
      { JUMENTIX_MESSAGE_MEDIATOR_ADAPTER: 'inmemory' },
      () => compileMessageMediator()
    );

    // Not a singleton: two applications in one process must not share a
    // handler registry.
    expect(first).not.toBe(second);
  });

  it.each(['rabbitmq', 'rabbit', 'RabbitMQ'])('builds the RabbitMQ adapter for %p', async (
    adapter: string
  ) => {
    expect.hasAssertions();

    const mediator = await withEnvironment(
      { JUMENTIX_MESSAGE_MEDIATOR_ADAPTER: adapter, JUMENTIX_RABBITMQ_URL: 'amqp://127.0.0.1:5672' },
      () => compileMessageMediator()
    );

    expect(mediator).toBeInstanceOf(RabbitMqMessageMediatorAdapter);
  });

  /**
   * RabbitMQ with no URL must fail at startup rather than at the first message.
   * Falling back to in-memory would be worse than either: the application would
   * start, accept work, and quietly serve it from a queue nothing else can see.
   */
  it('refuses to build the RabbitMQ adapter with no url', async () => {
    expect.hasAssertions();

    await expect(withEnvironment(
      { JUMENTIX_MESSAGE_MEDIATOR_ADAPTER: 'rabbitmq', JUMENTIX_RABBITMQ_URL: undefined },
      () => compileMessageMediator()
    )).rejects.toThrow('JUMENTIX_RABBITMQ_URL is required when JUMENTIX_MESSAGE_MEDIATOR_ADAPTER=rabbitmq');
  });

  it.each(['bullmq', 'bull', 'BullMQ'])('builds the BullMQ adapter for %p', async (
    adapter: string
  ) => {
    expect.hasAssertions();

    const mediator = await withEnvironment(
      { JUMENTIX_MESSAGE_MEDIATOR_ADAPTER: adapter },
      () => compileMessageMediator()
    );

    expect(mediator).toBeInstanceOf(BullMqMessageMediatorAdapter);
  });
});

/**
 * The configuration the compiler assembles for the brokers.
 *
 * Read back off the adapter: this is the half that runs without a broker, and
 * the half where a wrong port or a dropped password actually comes from. Live
 * broker behaviour is measured by `test/integration/brokers.integration.test.ts`
 * under `RUN_BROKER_INTEGRATION` against real RabbitMQ/Redis, and that suite is
 * part of the Jest coverage instrument when the coverage gate brings those
 * services up (Req 110 / 118) — not excluded by an istanbul ignore.
 */
describe('broker configuration', () => {
  const optionsOf = (mediator: unknown) => (mediator as unknown as {
    options: {
      url?: string;
      exchangeName?: string;
      defaultRequestQueue?: string;
      prefetch?: number;
      connection?: {
        host?: string; port?: number; username?: string; password?: string; db?: number;
      };
    };
  }).options;

  const rabbit = (env: Record<string, string | undefined>) => withEnvironment(
    { JUMENTIX_MESSAGE_MEDIATOR_ADAPTER: 'rabbitmq', JUMENTIX_RABBITMQ_URL: 'amqp://127.0.0.1:5672', ...env },
    () => compileMessageMediator()
  );

  const bull = (env: Record<string, string | undefined>) => withEnvironment(
    { JUMENTIX_MESSAGE_MEDIATOR_ADAPTER: 'bullmq', ...env },
    () => compileMessageMediator()
  );

  it('passes the RabbitMQ url, exchange and queue through', async () => {
    expect.hasAssertions();

    const mediator = await rabbit({
      JUMENTIX_RABBITMQ_URL: 'amqp://user:pass@broker.internal:5672/vhost',
      JUMENTIX_RABBITMQ_EXCHANGE: 'orders',
      JUMENTIX_RABBITMQ_REQUEST_QUEUE: 'orders.requests'
    });

    expect(optionsOf(mediator)).toMatchObject({
      url: 'amqp://user:pass@broker.internal:5672/vhost',
      exchangeName: 'orders',
      defaultRequestQueue: 'orders.requests'
    });
  });

  it('reads the RabbitMQ prefetch', async () => {
    expect.hasAssertions();

    expect(optionsOf(await rabbit({ JUMENTIX_RABBITMQ_PREFETCH: '50' })).prefetch).toBe(50);
  });

  /**
   * Prefetch decides how many messages a consumer takes at once. A
   * non-numeric value becoming NaN would be taken by the driver without
   * complaint, and the consumer would behave in a way the configuration does
   * not explain.
   */
  it.each([[undefined], ['not-a-number'], ['']])(
    'falls back to a prefetch of 10 for %p',
    async (value) => {
      expect.hasAssertions();

      expect(optionsOf(await rabbit({ JUMENTIX_RABBITMQ_PREFETCH: value })).prefetch).toBe(10);
    }
  );

  it('reads the BullMQ redis connection', async () => {
    expect.hasAssertions();

    const mediator = await bull({
      JUMENTIX_BULLMQ_REDIS_HOST: 'redis.internal',
      JUMENTIX_BULLMQ_REDIS_PORT: '6380',
      JUMENTIX_BULLMQ_REDIS_USERNAME: 'worker',
      JUMENTIX_BULLMQ_REDIS_PASSWORD: 'secret',
      JUMENTIX_BULLMQ_REDIS_DB: '3',
      JUMENTIX_BULLMQ_REQUEST_QUEUE: 'jobs'
    });

    expect(optionsOf(mediator)).toMatchObject({
      connection: {
        host: 'redis.internal', port: 6380, username: 'worker', password: 'secret', db: 3
      },
      defaultRequestQueue: 'jobs'
    });
  });

  /**
   * BullMQ falls back to the shared Redis settings. That is what makes a
   * single-Redis deployment work without naming it twice, and it is exactly the
   * kind of fallback that stops working unnoticed.
   */
  it('falls back to the shared redis host, port and password', async () => {
    expect.hasAssertions();

    const mediator = await bull({
      JUMENTIX_BULLMQ_REDIS_HOST: undefined,
      JUMENTIX_BULLMQ_REDIS_PORT: undefined,
      JUMENTIX_BULLMQ_REDIS_PASSWORD: undefined,
      JUMENTIX_REDIS_HOST: 'shared.internal',
      JUMENTIX_REDIS_PORT: '6381',
      JUMENTIX_REDIS_PASSWORD: 'shared-secret'
    });

    expect(optionsOf(mediator).connection).toMatchObject({
      host: 'shared.internal', port: 6381, password: 'shared-secret'
    });
  });

  it('prefers the BullMQ-specific settings over the shared ones', async () => {
    expect.hasAssertions();

    const mediator = await bull({
      JUMENTIX_BULLMQ_REDIS_HOST: 'bull.internal',
      JUMENTIX_BULLMQ_REDIS_PORT: '6390',
      JUMENTIX_REDIS_HOST: 'shared.internal',
      JUMENTIX_REDIS_PORT: '6381'
    });

    expect(optionsOf(mediator).connection).toMatchObject({
      host: 'bull.internal', port: 6390
    });
  });

  it('defaults to loopback on 6379 when nothing is configured', async () => {
    expect.hasAssertions();

    const mediator = await bull({
      JUMENTIX_BULLMQ_REDIS_HOST: undefined,
      JUMENTIX_BULLMQ_REDIS_PORT: undefined,
      JUMENTIX_REDIS_HOST: undefined,
      JUMENTIX_REDIS_PORT: undefined
    });

    expect(optionsOf(mediator).connection).toMatchObject({ host: '127.0.0.1', port: 6379 });
  });

  it('leaves the database unset when none is configured', async () => {
    expect.hasAssertions();

    const mediator = await bull({ JUMENTIX_BULLMQ_REDIS_DB: undefined });

    // Undefined, not 0: the driver's own default is not necessarily database 0,
    // and choosing one here would be a decision made by accident.
    expect(optionsOf(mediator).connection?.db).toBeUndefined();
  });
});
