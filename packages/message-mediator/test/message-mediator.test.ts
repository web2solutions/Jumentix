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
 * The RabbitMQ and BullMQ adapters are not, and were not before this suite:
 * both files carry `istanbul ignore file`, because what they do is talk to a
 * broker and there is no honest way to test that without one. What *is* covered
 * for them is the part that runs with no broker in sight — the configuration
 * the compiler assembles, which is where a wrong port or a dropped credential
 * actually comes from.
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

    mediator.subscribe('order.created', async () => {
      await new Promise((resolve) => { setTimeout(resolve, 10); });
      done = true;
    });

    await mediator.publish({
      name: 'order.created', payload: {}, occurredAt: '2026-01-01T00:00:00.000Z'
    });

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
    mediator.registerHandler('orders.create', async () => {
      await new Promise((resolve) => { setTimeout(resolve, 30); });
      return { contract: 'orders.create', result: 'slow but fine' };
    });

    await expect(mediator.request(message(), { timeoutMs }))
      .resolves.toMatchObject({ result: 'slow but fine' });
  });
});

describe('compiling a mediator', () => {
  it('builds the in-memory adapter by default', async () => {
    expect.hasAssertions();

    const mediator = await withEnvironment(
      { AAA_MESSAGE_MEDIATOR_ADAPTER: undefined },
      () => compileMessageMediator()
    );

    expect(mediator).toBeInstanceOf(InMemoryMessageMediatorAdapter);
  });

  it.each(['inmemory', 'INMEMORY', '  inmemory  ', 'nonsense', ''])(
    'builds the in-memory adapter for %p',
    async (adapter: string) => {
      expect.hasAssertions();

      const mediator = await withEnvironment(
        { AAA_MESSAGE_MEDIATOR_ADAPTER: adapter },
        () => compileMessageMediator()
      );

      expect(mediator).toBeInstanceOf(InMemoryMessageMediatorAdapter);
    }
  );

  it('hands out a fresh in-memory mediator each time', async () => {
    expect.hasAssertions();

    const first = await withEnvironment(
      { AAA_MESSAGE_MEDIATOR_ADAPTER: 'inmemory' },
      () => compileMessageMediator()
    );
    const second = await withEnvironment(
      { AAA_MESSAGE_MEDIATOR_ADAPTER: 'inmemory' },
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
      { AAA_MESSAGE_MEDIATOR_ADAPTER: adapter, AAA_RABBITMQ_URL: 'amqp://127.0.0.1:5672' },
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
      { AAA_MESSAGE_MEDIATOR_ADAPTER: 'rabbitmq', AAA_RABBITMQ_URL: undefined },
      () => compileMessageMediator()
    )).rejects.toThrow('AAA_RABBITMQ_URL is required when AAA_MESSAGE_MEDIATOR_ADAPTER=rabbitmq');
  });

  it.each(['bullmq', 'bull', 'BullMQ'])('builds the BullMQ adapter for %p', async (
    adapter: string
  ) => {
    expect.hasAssertions();

    const mediator = await withEnvironment(
      { AAA_MESSAGE_MEDIATOR_ADAPTER: adapter },
      () => compileMessageMediator()
    );

    expect(mediator).toBeInstanceOf(BullMqMessageMediatorAdapter);
  });
});

/**
 * The configuration the compiler assembles for the brokers.
 *
 * Read back off the adapter, because this is the half of those adapters that
 * runs without a broker — and the half where a wrong port or a dropped password
 * actually comes from. What the adapters then do with a live broker is not
 * covered here or anywhere else in unit tests; both files carry
 * `istanbul ignore file`, which is a statement about what a unit test can
 * honestly reach rather than a coverage convenience.
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
    { AAA_MESSAGE_MEDIATOR_ADAPTER: 'rabbitmq', AAA_RABBITMQ_URL: 'amqp://127.0.0.1:5672', ...env },
    () => compileMessageMediator()
  );

  const bull = (env: Record<string, string | undefined>) => withEnvironment(
    { AAA_MESSAGE_MEDIATOR_ADAPTER: 'bullmq', ...env },
    () => compileMessageMediator()
  );

  it('passes the RabbitMQ url, exchange and queue through', async () => {
    expect.hasAssertions();

    const mediator = await rabbit({
      AAA_RABBITMQ_URL: 'amqp://user:pass@broker.internal:5672/vhost',
      AAA_RABBITMQ_EXCHANGE: 'orders',
      AAA_RABBITMQ_REQUEST_QUEUE: 'orders.requests'
    });

    expect(optionsOf(mediator)).toMatchObject({
      url: 'amqp://user:pass@broker.internal:5672/vhost',
      exchangeName: 'orders',
      defaultRequestQueue: 'orders.requests'
    });
  });

  it('reads the RabbitMQ prefetch', async () => {
    expect.hasAssertions();

    expect(optionsOf(await rabbit({ AAA_RABBITMQ_PREFETCH: '50' })).prefetch).toBe(50);
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

      expect(optionsOf(await rabbit({ AAA_RABBITMQ_PREFETCH: value })).prefetch).toBe(10);
    }
  );

  it('reads the BullMQ redis connection', async () => {
    expect.hasAssertions();

    const mediator = await bull({
      AAA_BULLMQ_REDIS_HOST: 'redis.internal',
      AAA_BULLMQ_REDIS_PORT: '6380',
      AAA_BULLMQ_REDIS_USERNAME: 'worker',
      AAA_BULLMQ_REDIS_PASSWORD: 'secret',
      AAA_BULLMQ_REDIS_DB: '3',
      AAA_BULLMQ_REQUEST_QUEUE: 'jobs'
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
      AAA_BULLMQ_REDIS_HOST: undefined,
      AAA_BULLMQ_REDIS_PORT: undefined,
      AAA_BULLMQ_REDIS_PASSWORD: undefined,
      AAA_REDIS_HOST: 'shared.internal',
      AAA_REDIS_PORT: '6381',
      AAA_REDIS_PASSWORD: 'shared-secret'
    });

    expect(optionsOf(mediator).connection).toMatchObject({
      host: 'shared.internal', port: 6381, password: 'shared-secret'
    });
  });

  it('prefers the BullMQ-specific settings over the shared ones', async () => {
    expect.hasAssertions();

    const mediator = await bull({
      AAA_BULLMQ_REDIS_HOST: 'bull.internal',
      AAA_BULLMQ_REDIS_PORT: '6390',
      AAA_REDIS_HOST: 'shared.internal',
      AAA_REDIS_PORT: '6381'
    });

    expect(optionsOf(mediator).connection).toMatchObject({
      host: 'bull.internal', port: 6390
    });
  });

  it('defaults to loopback on 6379 when nothing is configured', async () => {
    expect.hasAssertions();

    const mediator = await bull({
      AAA_BULLMQ_REDIS_HOST: undefined,
      AAA_BULLMQ_REDIS_PORT: undefined,
      AAA_REDIS_HOST: undefined,
      AAA_REDIS_PORT: undefined
    });

    expect(optionsOf(mediator).connection).toMatchObject({ host: '127.0.0.1', port: 6379 });
  });

  it('leaves the database unset when none is configured', async () => {
    expect.hasAssertions();

    const mediator = await bull({ AAA_BULLMQ_REDIS_DB: undefined });

    // Undefined, not 0: the driver's own default is not necessarily database 0,
    // and choosing one here would be a decision made by accident.
    expect(optionsOf(mediator).connection?.db).toBeUndefined();
  });
});
