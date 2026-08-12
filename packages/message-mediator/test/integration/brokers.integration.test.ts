import {
  BullMqMessageMediatorAdapter,
  RabbitMqMessageMediatorAdapter
} from '../../src';
import type { IMessage, IMessageResponse } from '../../src';

/**
 * Wait for a condition, with a bound (JUM-679, Requirement 134 §2).
 *
 * A broker delivers when it delivers; the old form waited a flat second for the
 * binding and two more for the message. That is a guess about how fast the
 * container is, and it spends the full time even when delivery was instant.
 * This returns the moment the condition holds and names what never happened
 * when it does not.
 */
async function until(
  condition: () => boolean | Promise<boolean>,
  { timeoutMs = 15000, stepMs = 25, describe = 'condition' } = {}
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    if (await condition()) return;
    if (Date.now() > deadline) {
      throw new Error(`Timed out after ${timeoutMs}ms waiting for ${describe}`);
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => { setTimeout(resolve, stepMs); });
  }
}

/**
 * The broker adapters against real brokers (Requirement 112 §1).
 *
 * What these adapters do is talk to a broker; the unit suite covers compiler
 * configuration, and this suite is the live measurement against the brokers in
 * `apps/backend-template/docker-compose-messaging.yml` under
 * `RUN_BROKER_INTEGRATION`. The coverage gate runs it under the Jest instrument
 * so the adapter sources are counted, not ignored.
 *
 * What is worth testing here is exactly what the in-memory mediator cannot
 * show: that a request survives being serialised, put on a queue, taken off it
 * by a consumer and correlated back to the caller that is waiting. Every step
 * of that is absent from a mediator that resolves handlers out of a map.
 */

const RUNNING = process.env.RUN_BROKER_INTEGRATION === '1';

/**
 * Skipped, not passed, when the brokers are absent — a suite that reports
 * success without the thing it tests is the false green this repository keeps
 * finding.
 *
 */
const suite = RUNNING ? describe : describe.skip;

const RABBIT_URL = process.env.JUMENTIX_RABBITMQ_URL || 'amqp://127.0.0.1:5672';
const REDIS_HOST = process.env.JUMENTIX_BULLMQ_REDIS_HOST || '127.0.0.1';
const REDIS_PORT = Number(process.env.JUMENTIX_BULLMQ_REDIS_PORT || 6379);

let sequence = 0;
/** A contract no other run of this suite will use. */
const contract = (name: string) => {
  sequence += 1;
  return `integration.${name}.${Date.now().toString(36)}.${sequence}`;
};

const message = (name: string, payload: Record<string, unknown> = {}): IMessage => ({
  contract: name,
  version: '1.0.0',
  payload,
  metadata: { requestId: `r-${sequence}` }
});

suite('RabbitMQ mediator against a real broker', () => {
  let mediator: RabbitMqMessageMediatorAdapter;

  beforeAll(async () => {
    mediator = new RabbitMqMessageMediatorAdapter({
      url: RABBIT_URL,
      exchangeName: `integration-exchange-${Date.now().toString(36)}`,
      defaultRequestQueue: `integration-requests-${Date.now().toString(36)}`,
      prefetch: 10
    });
    await mediator.connect();
  }, 60000);

  afterAll(async () => {
    await mediator?.disconnect();
  }, 60000);

  /**
   * The round trip. A handler registered here is consuming from a queue on the
   * broker, and the response comes back over a reply queue correlated by id —
   * none of which the in-memory mediator has.
   */
  it('carries a request to a handler and the response back', async () => {
    expect.hasAssertions();

    const name = contract('round-trip');
    mediator.registerHandler(name, async (incoming) => ({
      contract: incoming.contract,
      result: { seen: incoming.payload }
    }));

    const response = await mediator.request(message(name, { id: 7 }), { timeoutMs: 20000 });

    expect(response.result).toStrictEqual({ seen: { id: 7 } });
  }, 60000);

  /**
   * The payload crosses the wire as bytes, so anything the serialiser drops is
   * dropped silently. The in-memory mediator hands the same object through and
   * can never show this.
   */
  it('preserves the payload through serialisation', async () => {
    expect.hasAssertions();

    const name = contract('payload');
    const sent = {
      text: 'a string',
      number: 42,
      float: 1.5,
      flag: false,
      nested: { list: [1, 2, 3], empty: {} },
      nulled: null
    };

    mediator.registerHandler(name, async (incoming) => ({
      contract: incoming.contract,
      result: incoming.payload
    }));

    const response = await mediator.request(message(name, sent), { timeoutMs: 20000 });

    expect(response.result).toStrictEqual(sent);
  }, 60000);

  it('carries the metadata that correlates a response to its request', async () => {
    expect.hasAssertions();

    const name = contract('metadata');
    mediator.registerHandler(name, async (incoming) => ({
      contract: incoming.contract,
      result: { requestId: incoming.metadata?.requestId }
    }));

    const sent = message(name);
    const response = await mediator.request(sent, { timeoutMs: 20000 });

    expect(response.result).toStrictEqual({ requestId: sent.metadata?.requestId });
  }, 60000);

  /**
   * Two handlers, two contracts, one connection. A broker adapter that routed
   * by anything coarser than the contract would answer the wrong caller, and
   * with a single handler registered no test can tell.
   */
  it('routes each contract to its own handler', async () => {
    expect.hasAssertions();

    const first = contract('first');
    const second = contract('second');
    mediator.registerHandler(first, async () => ({ contract: first, result: 'from-first' }));
    mediator.registerHandler(second, async () => ({ contract: second, result: 'from-second' }));

    const [one, two] = await Promise.all([
      mediator.request(message(first), { timeoutMs: 20000 }),
      mediator.request(message(second), { timeoutMs: 20000 })
    ]);

    expect(one.result).toBe('from-first');
    expect(two.result).toBe('from-second');
  }, 60000);

  it('delivers a published event to a subscriber', async () => {
    expect.hasAssertions();

    const name = contract('event');
    const delivered: unknown[] = [];
    mediator.subscribe(name, (event) => { delivered.push(event.payload); });

    // Subscription is asynchronous on a broker: the binding has to exist before
    // the publish, which is a step the in-memory mediator does not have. The
    // publish is retried until one lands rather than waiting a flat second for
    // the binding to appear (JUM-679).
    await until(async () => {
      await mediator.publish({
        name, payload: { id: 1 }, occurredAt: new Date().toISOString()
      });
      return delivered.length > 0;
    }, { describe: 'the broker to bind the subscription and deliver' });

    expect(delivered).toStrictEqual([{ id: 1 }]);
  }, 60000);

  /**
   * A request nobody consumes must time out and be reported, not wait forever.
   * This is the failure mode a broker introduces and an in-memory map cannot
   * have: there is no handler to find and no error to raise, only silence.
   */
  it('reports a timeout when no handler is listening', async () => {
    expect.hasAssertions();

    const response: IMessageResponse = await mediator.request(
      message(contract('unclaimed')),
      { timeoutMs: 2000 }
    );

    expect(response.error).toBeDefined();
  }, 60000);

  it('is a no-op to connect or disconnect twice', async () => {
    expect.hasAssertions();

    await mediator.connect();
    await mediator.disconnect();
    await mediator.disconnect();
    await mediator.connect();
    expect(mediator).toBeInstanceOf(RabbitMqMessageMediatorAdapter);
  }, 60000);

  it('registers handlers by route key and queue name', async () => {
    expect.hasAssertions();

    const name = contract('routed');
    const queueName = `integration-routed-${Date.now().toString(36)}`;
    mediator.registerHandler(
      name,
      async () => ({ contract: name, result: 'routed' }),
      { routeKey: `${name}.key`, queueName }
    );

    const response = await mediator.request(message(name), {
      timeoutMs: 20000,
      routeKey: `${name}.key`,
      queueName
    });

    expect(response.result).toBe('routed');
  }, 60000);

  it('reports a handler that throws', async () => {
    expect.hasAssertions();

    const name = contract('rabbit-throw');
    mediator.registerHandler(name, async () => {
      throw new Error('rabbit handler failed');
    });

    const response = await mediator.request(message(name), { timeoutMs: 20000 });
    expect(response.error).toBeDefined();
    expect((response.error as { message?: string }).message).toMatch(/rabbit handler failed/);

    const nonErrorName = contract('rabbit-throw-non-error');
    mediator.registerHandler(nonErrorName, async () => {
      // Intentional: covers the adapter branch for non-Error rejections.
      // eslint-disable-next-line prefer-promise-reject-errors
      return Promise.reject('rabbit string failure');
    });
    const nonError = await mediator.request(message(nonErrorName), { timeoutMs: 20000 });
    expect((nonError.error as { message?: string }).message).toMatch(/rabbit string failure/);
  }, 60000);

  it('survives broker cancel frames on reply and request consumers', async () => {
    expect.hasAssertions();

    const { channel } = mediator as unknown as {
      channel: { consumers: Map<string, (msg: null) => unknown> };
    };

    await Promise.all([...channel.consumers.values()].map((consumer) => consumer(null)));

    expect(channel.consumers.size).toBeGreaterThan(0);
  });

  it('reconnects through ensureConnected after a disconnect', async () => {
    expect.hasAssertions();

    await mediator.disconnect();
    const name = contract('rabbit-ensure-connected');
    mediator.registerHandler(name, async () => ({
      contract: name,
      result: 'rabbit-reconnected'
    }));

    const response = await mediator.request(message(name), { timeoutMs: 20000 });
    expect(response.result).toBe('rabbit-reconnected');
  }, 60000);

  it('publishes when nobody subscribed locally and fills omitted response fields', async () => {
    expect.hasAssertions();

    await mediator.publish({
      name: contract('rabbit-unsubscribed-event'),
      payload: { id: 11 },
      occurredAt: new Date().toISOString()
    });

    const name = contract('rabbit-sparse-response');
    mediator.registerHandler(name, async () => ({ result: 'sparse' } as IMessageResponse));
    const response = await mediator.request(message(name), { timeoutMs: 20000 });
    expect(response.contract).toBe(name);
    expect(response.result).toBe('sparse');
  }, 60000);

  it('parses invalid JSON from the broker as the fallback payload', async () => {
    expect.hasAssertions();

    // Private helper, exercised through the real adapter class so the catch
    // branch that keeps a corrupt frame from crashing the consumer is measured.
    const parsed = (RabbitMqMessageMediatorAdapter as unknown as {
      parseMessage: (content: Buffer, fallback: unknown) => unknown;
    }).parseMessage(Buffer.from('not-json{'), { contract: 'fallback' });

    expect(parsed).toStrictEqual({ contract: 'fallback' });
  });

  it('acks reply-queue frames that cannot be correlated', async () => {
    expect.hasAssertions();

    const { replyQueue } = mediator as unknown as { replyQueue: string };
    const { channel } = mediator as unknown as {
      channel: {
        sendToQueue: (
          queue: string,
          content: Buffer,
          options?: Record<string, unknown>
        ) => boolean;
      };
    };

    channel.sendToQueue(replyQueue, Buffer.from('{}'), {});
    channel.sendToQueue(replyQueue, Buffer.from('{}'), { correlationId: 'missing-pending' });
    channel.sendToQueue(
      (mediator as unknown as { defaultRequestQueue: string }).defaultRequestQueue,
      Buffer.from('not-json{'),
      { replyTo: replyQueue, correlationId: 'orphan' }
    );

    await until(() => replyQueue.length > 0, {
      describe: 'the adapter to answer the malformed request'
    });

    expect(replyQueue.length).toBeGreaterThan(0);
  }, 60000);

  it('resolves a handler registered only by queue name after reconnect', async () => {
    expect.hasAssertions();

    await mediator.disconnect();
    await mediator.connect();

    const name = contract('rabbit-queue-only');
    const queueName = `integration-rabbit-queue-only-${Date.now().toString(36)}`;
    mediator.registerHandler(
      name,
      async () => ({ contract: name, result: 'rabbit-queue-only' }),
      { queueName }
    );

    const response = await mediator.request(message(name), {
      timeoutMs: 20000,
      queueName
    });
    expect(response.result).toBe('rabbit-queue-only');
  }, 60000);
});

suite('BullMQ mediator against a real Redis', () => {
  let mediator: BullMqMessageMediatorAdapter;

  beforeAll(async () => {
    mediator = new BullMqMessageMediatorAdapter({
      connection: { host: REDIS_HOST, port: REDIS_PORT },
      defaultRequestQueue: `integration-jobs-${Date.now().toString(36)}`
    });
    await mediator.connect();
  }, 60000);

  afterAll(async () => {
    await mediator?.disconnect();
  }, 60000);

  it('carries a request to a handler and the response back', async () => {
    expect.hasAssertions();

    const name = contract('bull-round-trip');
    mediator.registerHandler(name, async (incoming) => ({
      contract: incoming.contract,
      result: { seen: incoming.payload }
    }));

    const response = await mediator.request(message(name, { id: 9 }), { timeoutMs: 20000 });

    expect(response.result).toStrictEqual({ seen: { id: 9 } });
  }, 60000);

  it('preserves the payload through the queue', async () => {
    expect.hasAssertions();

    const name = contract('bull-payload');
    const sent = { text: 'a string', nested: { list: [1, 2] }, flag: true };

    mediator.registerHandler(name, async (incoming) => ({
      contract: incoming.contract,
      result: incoming.payload
    }));

    const response = await mediator.request(message(name, sent), { timeoutMs: 20000 });

    expect(response.result).toStrictEqual(sent);
  }, 60000);

  /**
   * The result has to survive the worker finishing first (JUM-621).
   *
   * `waitUntilFinished` subscribes to the completion event, then polls
   * `isFinished` once to cover a job that finished before the subscription
   * existed. Under `removeOnComplete: true` the job is already deleted by then
   * and that poll returns `Missing key for job <id>`, so a request whose
   * handler answered correctly fails — a race between worker and caller, which
   * is why it showed up as one intermittent test rather than a broken feature.
   *
   * This case exercises that path against a real broker. It is **not** the
   * deterministic guard — the race is timing-dependent and this passed against
   * the unmended adapter on the run I measured. The guards are the two unit
   * cases in `message-mediator.test.ts`, which pin the retention window and the
   * error wording without a broker; both fail if the fix is reverted.
   */
  it('does not lose the reply when the handler finishes before the caller waits', async () => {
    expect.hasAssertions();

    const name = contract('bull-fast-handler');
    mediator.registerHandler(name, async (incoming) => ({
      contract: incoming.contract,
      result: 'answered'
    }));

    // Warm the queue infrastructure so the worker is attached and idle, and the
    // job is picked up the instant it is added.
    await mediator.request(message(contract('bull-warmup')), { timeoutMs: 20000 });

    const response = await mediator.request(message(name), { timeoutMs: 20000 });

    expect(response.error).toBeUndefined();
    expect(response.result).toBe('answered');
  }, 60000);

  /**
   * A handler that throws must come back as an error response, not as a job
   * that vanishes. BullMQ retries and eventually parks a failed job, so a
   * caller waiting on the reply learns nothing unless the adapter reports it.
   */
  it('reports a handler that failed rather than leaving the caller waiting', async () => {
    expect.hasAssertions();

    const name = contract('bull-failure');
    mediator.registerHandler(name, async () => { throw new Error('handler failed'); });

    const response = await mediator.request(message(name), { timeoutMs: 20000 });

    expect(response.error).toBeDefined();
    expect((response.error as { message?: string }).message).toMatch(/handler failed/);

    const nonErrorName = contract('bull-throw-non-error');
    mediator.registerHandler(nonErrorName, async () => {
      // Intentional: covers the adapter branch for non-Error rejections.
      // eslint-disable-next-line prefer-promise-reject-errors
      return Promise.reject('bull string failure');
    });
    const nonError = await mediator.request(message(nonErrorName), { timeoutMs: 20000 });
    expect((nonError.error as { message?: string }).message).toMatch(/bull string failure/);
  }, 60000);

  it('reports a timeout when no worker is listening', async () => {
    expect.hasAssertions();

    const response = await mediator.request(message(contract('bull-unclaimed')), {
      timeoutMs: 2000
    });

    expect(response.error).toBeDefined();
  }, 60000);

  it('reports a timeout when the handler never finishes', async () => {
    expect.hasAssertions();

    // waitUntilFinished throws on timeout only when a worker has accepted the
    // job but not completed it — an unclaimed contract finishes immediately
    // with a "no handler" payload and never enters the catch.
    const name = contract('bull-slow');
    // JUM-679: the handler is held open by this test rather than by a 60-second
    // sleep. A minute-long timer left running is a handle the runner has to
    // survive, and the number was only ever "much larger than 500ms".
    let releaseHandler: () => void = () => undefined;
    const handlerWork = new Promise<void>((resolve) => { releaseHandler = resolve; });
    mediator.registerHandler(name, async () => {
      await handlerWork;
      return { contract: name, result: 'late' };
    });

    const response = await mediator.request(message(name), { timeoutMs: 500 });
    releaseHandler();

    expect(response.error).toBeDefined();
    const errorMessage = String((response.error as Error).message);
    expect(errorMessage).toMatch(/timed out/);
  }, 60000);

  it('is a no-op to connect twice and still disconnects cleanly', async () => {
    expect.hasAssertions();

    await mediator.connect();
    await mediator.disconnect();
    await mediator.connect();
    expect(mediator).toBeInstanceOf(BullMqMessageMediatorAdapter);
  }, 60000);

  it('delivers a published event to a local subscriber and the event queue', async () => {
    expect.hasAssertions();

    const name = contract('bull-event');
    const delivered: unknown[] = [];
    mediator.subscribe(name, (event) => { delivered.push(event.payload); });
    mediator.subscribe(name, () => undefined);

    await mediator.publish({
      name,
      payload: { id: 3 },
      occurredAt: new Date().toISOString()
    });

    expect(delivered).toStrictEqual([{ id: 3 }]);
  }, 60000);

  it('registers handlers by route key and queue name', async () => {
    expect.hasAssertions();

    const name = contract('bull-routed');
    const queueName = `integration-bull-routed-${Date.now().toString(36)}`;
    mediator.registerHandler(
      name,
      async () => ({ contract: name, result: 'bull-routed' }),
      { routeKey: `${name}.key`, queueName }
    );

    const byRoute = await mediator.request(message(name), {
      timeoutMs: 20000,
      routeKey: `${name}.key`,
      queueName
    });
    expect(byRoute.result).toBe('bull-routed');

    // Queue-name resolution without a route key (resolveHandler line for queueName).
    const byQueueOnly = contract('bull-queue-only');
    const queueOnly = `integration-bull-queue-only-${Date.now().toString(36)}`;
    mediator.registerHandler(
      byQueueOnly,
      async () => ({ contract: byQueueOnly, result: 'queue-only' }),
      { queueName: queueOnly }
    );
    const queued = await mediator.request(message(byQueueOnly), {
      timeoutMs: 20000,
      queueName: queueOnly
    });
    expect(queued.result).toBe('queue-only');
  }, 60000);

  it('reports when no handler is registered for a delivered job', async () => {
    expect.hasAssertions();

    const name = contract('bull-missing-handler');
    mediator.registerHandler(name, async () => ({ contract: name, result: 'x' }));
    (mediator as unknown as {
      handlersByContract: Record<string, unknown>;
      handlersByRouteKey: Record<string, unknown>;
      handlersByQueueName: Record<string, unknown>;
    }).handlersByContract = {};
    (mediator as unknown as {
      handlersByRouteKey: Record<string, unknown>;
    }).handlersByRouteKey = {};
    (mediator as unknown as {
      handlersByQueueName: Record<string, unknown>;
    }).handlersByQueueName = {};

    const response = await mediator.request(message(name), { timeoutMs: 20000 });
    // Wire form is `{ name, message }` so the reason survives Redis JSON.
    expect(response.error).toBeDefined();
    expect(JSON.stringify(response.error)).toMatch(/No handler/);
  }, 60000);

  it('publishes without local subscribers and honours caller correlation id', async () => {
    expect.hasAssertions();

    await mediator.publish({
      name: contract('bull-unsubscribed-event'),
      payload: { id: 4 },
      occurredAt: new Date().toISOString()
    });

    const name = contract('bull-correlation');
    mediator.registerHandler(name, async (incoming) => ({
      result: incoming.metadata?.correlationId
    } as IMessageResponse));

    const correlationId = `corr-${Date.now().toString(36)}`;
    const response = await mediator.request(
      {
        ...message(name),
        metadata: { requestId: `r-${sequence}`, correlationId }
      },
      { timeoutMs: 20000 }
    );

    expect(response.contract).toBe(name);
    expect(response.result).toBe(correlationId);
  }, 60000);

  it('reconnects through ensureConnected after a disconnect', async () => {
    expect.hasAssertions();

    await mediator.disconnect();
    const name = contract('bull-reconnect');
    mediator.registerHandler(name, async () => ({ contract: name, result: 'reconnected' }));
    const response = await mediator.request(message(name), { timeoutMs: 20000 });
    expect(response.result).toBe('reconnected');
  }, 60000);
});

suite('broker adapter loader failures', () => {
  it('explains a missing bullmq package instead of swallowing the import error', async () => {
    expect.hasAssertions();

    const adapter = new BullMqMessageMediatorAdapter({
      connection: { host: REDIS_HOST, port: REDIS_PORT }
    });
    const original = BullMqMessageMediatorAdapter.importBullMq;
    BullMqMessageMediatorAdapter.importBullMq = async () => {
      throw new Error('bullmq-not-installed');
    };

    try {
      await expect(adapter.connect()).rejects.toThrow(/BullMQ adapter requires package/);
    } finally {
      BullMqMessageMediatorAdapter.importBullMq = original;
    }
  });

  it('explains a missing amqplib package instead of swallowing the import error', async () => {
    expect.hasAssertions();

    const adapter = new RabbitMqMessageMediatorAdapter({ url: RABBIT_URL });
    const original = RabbitMqMessageMediatorAdapter.importAmqpLib;
    RabbitMqMessageMediatorAdapter.importAmqpLib = async () => {
      throw new Error('amqplib-not-installed');
    };

    try {
      await expect(adapter.connect()).rejects.toThrow(/RabbitMQ adapter requires package/);
    } finally {
      RabbitMqMessageMediatorAdapter.importAmqpLib = original;
    }
  });
});
