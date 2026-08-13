/*
 * The double mirrors BullMQ's constructor surface — `new Queue(...)`,
 * `new QueueEvents(...)`, `new Worker(...)` — so three classes and their empty
 * constructors are the shape the library dictates, not a style choice.
 */
/* eslint-disable max-classes-per-file, no-useless-constructor, no-empty-function */
/* eslint-disable class-methods-use-this, object-curly-newline */
import { BullMqMessageMediatorAdapter } from '../src';
import type { IMessage } from '../src';

/**
 * The BullMQ adapter's own paths, against a queue double (JUM-681).
 *
 * 23 uncovered branches, and the same argument as RabbitMQ's 41: they are not
 * the socket. They are the retention window that decides whether a finished
 * job survives long enough to be read, the failure translation that used to
 * report a 3ms missing-key rejection as a 15-second timeout (JUM-621), and the
 * infrastructure bookkeeping that must not leave a half-built queue behind. All
 * of those are decisions this adapter makes, and Requirement 135 §5 allows a
 * double precisely for a broker.
 *
 * What stays with the integration suite is Redis itself: that a worker really
 * picks the job up, that `waitUntilFinished` really resolves across processes.
 */
type JobHandler = (job: { data: any }) => Promise<unknown>;

function fakeBullMq() {
  const closed: string[] = [];
  const added: Array<{ queue: string; name: string; data: any; options: any }> = [];
  const workers: Record<string, JobHandler> = {};
  let failWith: Error | null = null;
  let readyFailure: Error | null = null;

  class Queue {
    public constructor(public readonly name: string) {}

    public async add(name: string, data: any, options: any) {
      added.push({ queue: this.name, name, data, options });
      return {
        waitUntilFinished: async () => {
          if (failWith) throw failWith;
          return workers[this.name]({ data });
        }
      };
    }

    public async close() { closed.push(`queue:${this.name}`); }
  }

  class QueueEvents {
    public constructor(public readonly name: string) {}

    public async waitUntilReady() {
      if (readyFailure) throw readyFailure;
    }

    public async close() { closed.push(`events:${this.name}`); }
  }

  class Worker {
    public constructor(public readonly name: string, handler: JobHandler) {
      workers[name] = handler;
    }

    public async waitUntilReady() { return undefined; }

    public async close() { closed.push(`worker:${this.name}`); }
  }

  return {
    lib: { Queue, QueueEvents, Worker },
    added,
    closed,
    failNextWait: (error: Error) => { failWith = error; },
    failReadiness: (error: Error) => { readyFailure = error; }
  };
}

const message = (over: Partial<IMessage> = {}): IMessage => ({
  contract: 'orders.create',
  version: '1.0.0',
  payload: { id: 1 },
  ...over
});

describe('bullMQ adapter against a queue double (JUM-681)', () => {
  const originalImport = BullMqMessageMediatorAdapter.importBullMq;

  afterEach(() => {
    BullMqMessageMediatorAdapter.importBullMq = originalImport;
  });

  const connected = async () => {
    const broker = fakeBullMq();
    BullMqMessageMediatorAdapter.importBullMq = async () => broker.lib;
    const adapter = new BullMqMessageMediatorAdapter({ connection: {} } as never);
    await adapter.connect();
    return { adapter, broker };
  };

  it('says which package is missing when bullmq cannot be imported', async () => {
    expect.hasAssertions();

    const cause = new Error('Cannot find module bullmq');
    BullMqMessageMediatorAdapter.importBullMq = async () => { throw cause; };
    const adapter = new BullMqMessageMediatorAdapter({ connection: {} } as never);

    await expect(adapter.connect()).rejects.toThrow('bun add bullmq');
  });

  it('builds the queue infrastructure once per queue name', async () => {
    expect.hasAssertions();

    const { adapter, broker } = await connected();
    adapter.registerHandler('orders.create', async () => ({ result: 'ok' } as never));

    await adapter.request(message());
    await adapter.request(message());
    await adapter.request(message(), { queueName: 'other.queue' });

    // Two requests on the default queue, one on another: three jobs, and the
    // second request must not rebuild what the first already made.
    expect(broker.added.map((entry) => entry.queue))
      .toStrictEqual(['app.requests', 'app.requests', 'other.queue']);
    await adapter.disconnect();
    expect(broker.closed.filter((entry) => entry.startsWith('queue:'))).toHaveLength(2);
  });

  it('keeps a finished job long enough for the caller to read it', async () => {
    expect.hasAssertions();

    // JUM-621: `removeOnComplete: true` deletes the job the instant the worker
    // finishes, and the caller's one poll then fails with a missing key. The
    // retention window is the request timeout, with a floor.
    const { adapter, broker } = await connected();
    adapter.registerHandler('orders.create', async () => ({ result: 'ok' } as never));

    await adapter.request(message(), { timeoutMs: 120_000 });
    await adapter.request(message(), { timeoutMs: 500 });

    expect(broker.added[0].options.removeOnComplete).toStrictEqual({ age: 120, count: 1000 });
    // The floor: a 500ms timeout would otherwise ask for a 1-second window.
    expect(broker.added[1].options.removeOnComplete).toStrictEqual({ age: 60, count: 1000 });
    expect(broker.added[1].options.removeOnFail).toStrictEqual({ age: 60, count: 1000 });
  });

  it('reports the failure that happened, not the one it assumed', async () => {
    expect.hasAssertions();

    // The defect JUM-621 was filed against: every rejection was reported as a
    // timeout, including a missing-key rejection that arrives in milliseconds.
    const { adapter, broker } = await connected();
    adapter.registerHandler('orders.create', async () => ({ result: 'ok' } as never));
    broker.failNextWait(new Error('Missing key for job 12. isFinished'));

    const failed = await adapter.request(message(), { timeoutMs: 15_000 });

    expect((failed.error as Error).message)
      .toBe('Message request failed: Missing key for job 12. isFinished');
    expect((failed.error as Error).message).not.toContain('timed out');
  });

  it('still reports a real timeout as a timeout', async () => {
    expect.hasAssertions();

    const { adapter, broker } = await connected();
    adapter.registerHandler('orders.create', async () => ({ result: 'ok' } as never));
    broker.failNextWait(new Error('job timed out before finishing'));

    const failed = await adapter.request(message(), { timeoutMs: 15_000 });

    expect((failed.error as Error).message).toBe('Message request timed out after 15000ms');
  });

  it('reports a non-Error rejection without losing it', async () => {
    expect.hasAssertions();

    const { adapter, broker } = await connected();
    adapter.registerHandler('orders.create', async () => ({ result: 'ok' } as never));
    broker.failNextWait('redis went away' as unknown as Error);

    const failed = await adapter.request(message());

    expect((failed.error as Error).message).toBe('Message request failed: redis went away');
  });

  it('closes what it built and forgets the queue when readiness fails', async () => {
    expect.hasAssertions();

    // A half-built queue left in the map is worse than none: the next request
    // would use it and wait on events nothing publishes.
    const broker = fakeBullMq();
    BullMqMessageMediatorAdapter.importBullMq = async () => broker.lib;
    broker.failReadiness(new Error('redis refused the connection'));
    const adapter = new BullMqMessageMediatorAdapter({ connection: {} } as never);

    await expect(adapter.connect()).rejects.toThrow('redis refused the connection');
    expect(broker.closed).toStrictEqual(['queue:app.requests', 'events:app.requests']);

    // And the failure is not cached: a second attempt rebuilds rather than
    // resolving the rejected promise the first one stored.
    broker.failReadiness(null as unknown as Error);
    await expect(adapter.connect()).resolves.toBeUndefined();
  });

  it('runs the handler the worker was given, and answers through the job', async () => {
    expect.hasAssertions();

    const { adapter } = await connected();
    adapter.registerHandler('orders.create', async (incoming) => ({
      contract: incoming.contract,
      result: { echoed: (incoming.payload as any).id }
    }));

    const response = await adapter.request(message());

    expect(response.result).toStrictEqual({ echoed: 1 });
    expect(response.contract).toBe('orders.create');
  });

  it('reports a handler failure as a wire error', async () => {
    expect.hasAssertions();

    // BullMQ persists the worker's return value as JSON, and a native Error
    // becomes `{}` there.
    const { adapter } = await connected();
    adapter.registerHandler('orders.create', async () => {
      throw new RangeError('handler exploded');
    });

    const response = await adapter.request(message());

    expect(response.error).toStrictEqual({ name: 'RangeError', message: 'handler exploded' });
  });

  it('names the contract when nothing is registered for it', async () => {
    expect.hasAssertions();

    const { adapter } = await connected();

    const response = await adapter.request(message({ contract: 'nobody.handles.this' }));

    expect((response.error as Error).message).toContain('nobody.handles.this');
  });

  it('publishes to a per-event queue and to local listeners', async () => {
    expect.hasAssertions();

    const { adapter, broker } = await connected();
    const heard: string[] = [];
    adapter.subscribe('orders.created', (event) => { heard.push(event.name); });

    await adapter.publish({ name: 'orders.created', payload: { id: 1 } } as never);

    expect(heard).toStrictEqual(['orders.created']);
    expect(broker.added.find((entry) => entry.queue === 'events.orders.created')?.options)
      .toStrictEqual({ removeOnComplete: true });
  });

  it('disconnects cleanly when nothing was ever connected', async () => {
    expect.hasAssertions();

    const idle = new BullMqMessageMediatorAdapter({ connection: {} } as never);

    await expect(idle.disconnect()).resolves.toBeUndefined();
  });
});
