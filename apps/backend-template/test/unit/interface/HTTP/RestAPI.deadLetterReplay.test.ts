import { RestAPI } from '@src/interface/HTTP/RestAPI';

/**
 * JUM-53 — the worker's life is the server's life.
 *
 * The composition builds the replay worker stopped, on purpose: a background
 * timer belongs to the runtime. Nothing started it, which made the queue a
 * slower way of losing the write. These assert the two halves — it runs while
 * the server runs, and it is stopped before the store it drains is closed.
 */
/**
 * A `RestAPI` instance without its constructor.
 *
 * Typed loosely on purpose: intersecting the real class reduces to `never`,
 * because `started` is private, and Jest typechecks while Bun does not — so
 * that mistake passes one runner and fails the other.
 */
type LifecycleApi = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  started: boolean;
};

function apiWith(worker?: { start: jest.Mock; stop: jest.Mock }) {
  const api = Object.create(RestAPI.prototype) as Record<string, unknown>;
  const order: string[] = [];
  const composition = worker ? { deadLetterWorker: worker } : {};

  api.started = false;
  api.databaseClient = {
    connect: jest.fn(),
    disconnect: jest.fn(() => { order.push('database'); })
  };
  api.keyValueStorageClient = {
    connect: jest.fn(),
    disconnect: jest.fn(() => { order.push('key-value'); })
  };
  api.server = { start: jest.fn(), stop: jest.fn() };
  api.usersComposition = composition;
  api.composeUsersModule = () => composition;

  return { api: api as unknown as LifecycleApi, order };
}

describe('restAPI dead-letter replay lifecycle (JUM-53)', () => {
  it('starts the worker when the server starts', async () => {
    expect.hasAssertions();

    const worker = {
      start: jest.fn(),
      stop: jest.fn()
    };
    const { api } = apiWith(worker);

    await api.start();

    expect(worker.start).toHaveBeenCalledTimes(1);
    expect(api.started).toBe(true);
  });

  it('stops the worker before the store it drains is disconnected', async () => {
    expect.hasAssertions();

    // Order is the assertion. Stopping after the client closes would let a
    // drain run against a disconnected store and report a failure that means
    // nothing.
    const order: string[] = [];
    const worker = {
      start: jest.fn(),
      stop: jest.fn(() => { order.push('worker'); })
    };
    const { api, order: clientOrder } = apiWith(worker);

    await api.start();
    await api.stop();

    expect(worker.stop).toHaveBeenCalledTimes(1);
    expect([...order, ...clientOrder]).toStrictEqual(['worker', 'key-value', 'database']);
  });

  it('does nothing when no queue was composed', async () => {
    expect.hasAssertions();

    // Without a key-value client there is no shared store, so the composition
    // returns no worker and the service keeps its previous behaviour.
    const { api } = apiWith();

    await expect(api.start()).resolves.toBeUndefined();
    await expect(api.stop()).resolves.toBeUndefined();
  });

  it('does not start a second timer when start is called twice', async () => {
    expect.hasAssertions();

    const worker = { start: jest.fn(), stop: jest.fn() };
    const { api } = apiWith(worker);

    await api.start();
    await api.start();

    expect(worker.start).toHaveBeenCalledTimes(1);
  });
});
