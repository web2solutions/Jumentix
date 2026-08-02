import {
  BullMqMessageMediatorAdapter,
  RabbitMqMessageMediatorAdapter
} from '../../src';
import type { IMessage, IMessageResponse } from '../../src';

/**
 * The broker adapters against real brokers (Requirement 112 §1).
 *
 * Both files carry `istanbul ignore file`, and the unit suite says why: what
 * they do is talk to a broker, and there is no honest way to test that without
 * one. This is the other half of that sentence — the brokers from
 * `apps/backend-template/docker-compose-messaging.yml`, a real RabbitMQ and a
 * real Redis, under `RUN_BROKER_INTEGRATION`.
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

const RABBIT_URL = process.env.AAA_RABBITMQ_URL || 'amqp://127.0.0.1:5672';
const REDIS_HOST = process.env.AAA_BULLMQ_REDIS_HOST || '127.0.0.1';
const REDIS_PORT = Number(process.env.AAA_BULLMQ_REDIS_PORT || 6379);

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
    // the publish, which is a step the in-memory mediator does not have.
    await new Promise((resolve) => { setTimeout(resolve, 1000); });
    await mediator.publish({
      name, payload: { id: 1 }, occurredAt: new Date().toISOString()
    });

    await new Promise((resolve) => { setTimeout(resolve, 2000); });

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
  }, 60000);

  it('reports a timeout when no worker is listening', async () => {
    expect.hasAssertions();

    const response = await mediator.request(message(contract('bull-unclaimed')), {
      timeoutMs: 2000
    });

    expect(response.error).toBeDefined();
  }, 60000);
});
