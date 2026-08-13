import { RabbitMqMessageMediatorAdapter } from '../src';
import type { IMessage } from '../src';

/**
 * The RabbitMQ adapter's own paths, against a broker double (JUM-681).
 *
 * 41 uncovered branches lived here — the largest single cluster in the
 * repository — and the standing argument was that they are "reconnect and error
 * paths no unit run can reach". That is true of the socket. It is **not** true
 * of the code around it: the frames it acknowledges, the correlation ids it
 * cannot match, the handler that throws, the reply that has nowhere to go. All
 * of those are decisions this adapter makes, and a double is exactly what
 * Requirement 135 §5 permits for a broker.
 *
 * What stays with the integration suite is the wire: that amqplib connects, that
 * a topic exchange routes, that a durable queue survives. Nothing here claims
 * otherwise.
 */
type Consumer = (msg: unknown) => void | Promise<void>;

function fakeAmqp() {
  const consumers: Record<string, Consumer> = {};
  const sent: Array<{ queue: string; payload: unknown; options: any }> = [];
  const published: Array<{ exchange: string; key: string; payload: unknown }> = [];
  const acked: unknown[] = [];
  const closed: string[] = [];

  const channel = {
    prefetch: async (count: number) => Number(count),
    assertExchange: async () => undefined,
    assertQueue: async (name: string) => ({ queue: name || 'amq.gen-reply' }),
    consume: async (queue: string, consumer: Consumer) => {
      consumers[queue] = consumer;
      return { consumerTag: queue };
    },
    sendToQueue: (queue: string, payload: Buffer, options: any) => {
      sent.push({ queue, payload: JSON.parse(payload.toString()), options });
    },
    publish: (exchange: string, key: string, payload: Buffer) => {
      published.push({ exchange, key, payload: JSON.parse(payload.toString()) });
    },
    ack: (msg: unknown) => { acked.push(msg); },
    close: async () => { closed.push('channel'); }
  };

  const connection = {
    createChannel: async () => channel,
    close: async () => { closed.push('connection'); }
  };

  return {
    lib: { connect: async () => connection },
    channel,
    consumers,
    sent,
    published,
    acked,
    closed
  };
}

const frame = (body: unknown, properties: any = {}, fields: any = {}) => ({
  content: Buffer.from(JSON.stringify(body)),
  properties,
  fields
});

const message = (over: Partial<IMessage> = {}): IMessage => ({
  contract: 'orders.create',
  version: '1.0.0',
  payload: { id: 1 },
  ...over
});

describe('rabbitMQ adapter against a broker double (JUM-681)', () => {
  const originalImport = RabbitMqMessageMediatorAdapter.importAmqpLib;

  afterEach(() => {
    RabbitMqMessageMediatorAdapter.importAmqpLib = originalImport;
  });

  const connected = async () => {
    const broker = fakeAmqp();
    RabbitMqMessageMediatorAdapter.importAmqpLib = async () => broker.lib;
    const adapter = new RabbitMqMessageMediatorAdapter({ url: 'amqp://localhost' });
    await adapter.connect();
    return { adapter, broker };
  };

  it('says which package is missing when amqplib cannot be imported', async () => {
    expect.hasAssertions();

    // The message is the whole value of this path: "Cannot find module 'amqplib'"
    // from inside a mediator tells an operator nothing about what to install.
    const cause = new Error('Cannot find module amqplib');
    RabbitMqMessageMediatorAdapter.importAmqpLib = async () => { throw cause; };
    const adapter = new RabbitMqMessageMediatorAdapter({ url: 'amqp://localhost' });

    await expect(adapter.connect()).rejects.toThrow('bun add amqplib');
    // The original is kept as `cause`, so the operator can still see what the
    // resolver said — asserted directly rather than inside a `catch`, which
    // would pass just as well if nothing ever threw.
    const thrown = await adapter.connect().then(() => null, (error: any) => error);
    expect(thrown.cause).toBe(cause);
  });

  it('connects once, however many times it is asked', async () => {
    expect.hasAssertions();

    const broker = fakeAmqp();
    let connects = 0;
    RabbitMqMessageMediatorAdapter.importAmqpLib = async () => ({
      connect: async () => { connects += 1; return broker.lib.connect(); }
    });
    const adapter = new RabbitMqMessageMediatorAdapter({ url: 'amqp://localhost' });

    await adapter.connect();
    await adapter.connect();
    // `publish` connects on demand; that must not open a second connection.
    await adapter.publish({ name: 'orders.created', payload: {} } as never);

    expect(connects).toBe(1);
  });

  it('acknowledges a reply it cannot match instead of leaving it unacked', async () => {
    expect.hasAssertions();

    // An unacked frame is redelivered forever. Both of these are replies the
    // adapter has nothing to do with — no correlation id, or one whose caller
    // has already timed out — and dropping them silently would grow the queue.
    const { broker } = await connected();
    const replyQueue = Object.keys(broker.consumers).find((name) => name !== 'app.requests')!;

    await broker.consumers[replyQueue](null);
    expect(broker.acked).toHaveLength(0);

    const noCorrelation = frame({ ok: true });
    await broker.consumers[replyQueue](noCorrelation);
    const unknownCorrelation = frame({ ok: true }, { correlationId: 'nobody-waits-for-this' });
    await broker.consumers[replyQueue](unknownCorrelation);

    expect(broker.acked).toStrictEqual([noCorrelation, unknownCorrelation]);
  });

  it('resolves the caller waiting on a correlation id, and acknowledges the frame', async () => {
    expect.hasAssertions();

    const { adapter, broker } = await connected();
    const replyQueue = Object.keys(broker.consumers).find((name) => name !== 'app.requests')!;

    const pending = adapter.request(message({ metadata: { correlationId: 'abc' } } as never));
    // `request` awaits the connection before it sends, so the frame exists on
    // the next turn of the loop — not after a delay, which would be a sleep.
    await Promise.resolve();
    await Promise.resolve();
    // The request is in flight: the frame it sent carries the reply queue.
    expect(broker.sent[0].options.replyTo).toBe(replyQueue);

    await broker.consumers[replyQueue](frame(
      { contract: 'orders.create', version: '1.0.0', result: { created: true } },
      { correlationId: 'abc' }
    ));

    const response = await pending;

    expect(response.result).toStrictEqual({ created: true });
    expect(broker.acked).toHaveLength(1);
  });

  it('answers a request frame on its replyTo queue', async () => {
    expect.hasAssertions();

    const { adapter, broker } = await connected();
    adapter.registerHandler('orders.create', async (incoming) => ({
      contract: incoming.contract,
      version: incoming.version,
      result: { id: 7 }
    }));

    await broker.consumers['app.requests'](frame(
      message(),
      { replyTo: 'caller-queue', correlationId: 'zed' },
      { routingKey: 'orders.create' }
    ));

    const reply = broker.sent.find((entry) => entry.queue === 'caller-queue');

    expect(reply?.options.correlationId).toBe('zed');
    expect((reply?.payload as any).result).toStrictEqual({ id: 7 });
    expect(broker.acked).toHaveLength(1);
  });

  it('acknowledges a request with no replyTo rather than answering nowhere', async () => {
    expect.hasAssertions();

    const { adapter, broker } = await connected();
    adapter.registerHandler('orders.create', async () => ({ result: { id: 7 } } as never));

    await broker.consumers['app.requests'](frame(message(), {}, { routingKey: 'orders.create' }));
    await broker.consumers['app.requests'](null);

    // One ack for the frame with no replyTo; none for the null delivery.
    expect(broker.acked).toHaveLength(1);
    expect(broker.sent.filter((entry) => entry.queue === 'caller-queue')).toHaveLength(0);
  });

  it('falls back to the unknown contract when a frame is not JSON', async () => {
    expect.hasAssertions();

    // A malformed frame must not throw inside the consumer: that kills the
    // consumer and the queue stops draining.
    const { adapter, broker } = await connected();
    const seen: string[] = [];
    adapter.registerHandler('unknown.contract', async (incoming) => {
      seen.push(incoming.contract);
      return { result: {} } as never;
    });

    await broker.consumers['app.requests']({
      content: Buffer.from('{not json'),
      properties: {},
      fields: {}
    });

    expect(seen).toStrictEqual(['unknown.contract']);
  });

  it('reports a handler failure as a wire error the caller can read', async () => {
    expect.hasAssertions();

    // A native Error stringifies to `{}` over JSON, so the caller would receive
    // "something failed" with no name and no message.
    const { adapter, broker } = await connected();
    adapter.registerHandler('orders.create', async () => {
      throw new TypeError('handler exploded');
    });

    await broker.consumers['app.requests'](frame(
      message(),
      { replyTo: 'caller-queue' },
      { routingKey: 'orders.create' }
    ));

    const reply = broker.sent.find((entry) => entry.queue === 'caller-queue');

    expect((reply?.payload as any).error).toStrictEqual({
      name: 'TypeError', message: 'handler exploded'
    });
  });

  it('reports a thrown non-Error without losing what was thrown', async () => {
    expect.hasAssertions();

    const { adapter, broker } = await connected();
    // eslint-disable-next-line no-throw-literal
    adapter.registerHandler('orders.create', async () => { throw 'a bare string'; });

    await broker.consumers['app.requests'](frame(
      message(),
      { replyTo: 'caller-queue' },
      { routingKey: 'orders.create' }
    ));

    const reply = broker.sent.find((entry) => entry.queue === 'caller-queue');

    expect((reply?.payload as any).error).toStrictEqual({
      name: 'Error', message: 'a bare string'
    });
  });

  it('names the contract when nothing is registered for it', async () => {
    expect.hasAssertions();

    const { broker } = await connected();

    await broker.consumers['app.requests'](frame(
      message({ contract: 'nobody.handles.this' }),
      { replyTo: 'caller-queue' },
      { routingKey: 'nobody.handles.this' }
    ));

    const reply = broker.sent.find((entry) => entry.queue === 'caller-queue');

    expect((reply?.payload as any).error.message).toContain('nobody.handles.this');
  });

  it('prefers the route key, then the queue name, then the contract', async () => {
    expect.hasAssertions();

    // Three registrations for one contract, distinguished only by how the
    // request asks for them. Resolution order is the behaviour.
    const { adapter } = await connected();
    adapter.registerHandler('orders.create', async () => ({ result: 'by-route' } as never), {
      routeKey: 'route.a'
    });
    adapter.registerHandler('orders.create', async () => ({ result: 'by-queue' } as never), {
      queueName: 'queue.b'
    });
    // Registered last on purpose: each registration also claims the contract, so
    // the contract entry is whichever came last. The route and queue maps keep
    // theirs, which is what makes the precedence observable at all.
    adapter.registerHandler('orders.create', async () => ({ result: 'by-contract' } as never));

    const byRoute = await adapter.request(message(), { routeKey: 'route.a', timeoutMs: 5 });
    const byQueue = await adapter.request(message(), { queueName: 'queue.b', timeoutMs: 5 });
    const byContract = await adapter.request(message(), { timeoutMs: 5 });

    expect(byRoute.result).toBe('by-route');
    expect(byQueue.result).toBe('by-queue');
    expect(byContract.result).toBe('by-contract');
  });

  it('publishes to the exchange and to local listeners', async () => {
    expect.hasAssertions();

    const { adapter, broker } = await connected();
    const heard: string[] = [];
    adapter.subscribe('orders.created', (event) => { heard.push(event.name); });
    adapter.subscribe('orders.created', async (event) => { heard.push(`${event.name}-async`); });

    await adapter.publish({ name: 'orders.created', payload: { id: 1 } } as never);

    expect(heard).toStrictEqual(['orders.created', 'orders.created-async']);
    expect(broker.published[0]).toMatchObject({ exchange: 'app.events', key: 'orders.created' });
  });

  it('closes the channel before the connection, and only when connected', async () => {
    expect.hasAssertions();

    const idle = new RabbitMqMessageMediatorAdapter({ url: 'amqp://localhost' });
    // Disconnecting something that never connected must not touch a null channel.
    await expect(idle.disconnect()).resolves.toBeUndefined();

    const { adapter, broker } = await connected();
    await adapter.disconnect();

    expect(broker.closed).toStrictEqual(['channel', 'connection']);
  });

  it('honours the configured exchange, queue and prefetch', async () => {
    expect.hasAssertions();

    const broker = fakeAmqp();
    let prefetched = 0;
    broker.channel.prefetch = async (value: number) => { prefetched = value; return value; };
    RabbitMqMessageMediatorAdapter.importAmqpLib = async () => broker.lib;

    const adapter = new RabbitMqMessageMediatorAdapter({
      url: 'amqp://localhost',
      exchangeName: 'custom.events',
      defaultRequestQueue: 'custom.requests',
      prefetch: 3
    });
    await adapter.connect();
    await adapter.publish({ name: 'x', payload: {} } as never);

    expect(prefetched).toBe(3);
    expect(broker.published[0].exchange).toBe('custom.events');
    expect(Object.keys(broker.consumers)).toContain('custom.requests');
  });
});
