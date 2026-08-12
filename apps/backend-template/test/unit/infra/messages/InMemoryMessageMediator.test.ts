import { InMemoryMessageMediator } from '@src/infra/messages/InMemoryMessageMediator';

describe('in-memory message mediator', () => {
  it('handles request/response and pub/sub contracts', async () => {
    expect.hasAssertions();
    const mediator = InMemoryMessageMediator.compile();
    const eventListener = jest.fn();

    mediator.registerHandler('users.auth.authorize', async (message) => ({
      contract: message.contract,
      result: { authorized: true, userId: 'u1' }
    }));

    const response = await mediator.request({
      contract: 'users.auth.authorize',
      payload: { authorization: 'Bearer token' }
    });

    mediator.subscribe('users.user.created', eventListener);
    await mediator.publish({
      name: 'users.user.created',
      payload: { id: 'u1' },
      occurredAt: new Date().toISOString()
    });

    expect(response.result).toStrictEqual({ authorized: true, userId: 'u1' });
    expect(eventListener).toHaveBeenCalledWith(expect.objectContaining({
      name: 'users.user.created'
    }));
  });

  it('returns error when handler is not registered', async () => {
    expect.hasAssertions();
    const mediator = InMemoryMessageMediator.compile();
    const response = await mediator.request({
      contract: 'unknown.contract',
      payload: {}
    });

    expect(response.error).toBeInstanceOf(Error);
    expect((response.error as Error).message).toContain('No handler registered');
  });

  it('supports broker-like handler resolution and timeout options', async () => {
    expect.hasAssertions();
    const mediator = InMemoryMessageMediator.compile();

    mediator.registerHandler(
      'users.auth.ensure-access',
      async (message) => ({
        contract: message.contract,
        metadata: message.metadata,
        result: { ok: true }
      }),
      {
        queueName: 'users.auth',
        routeKey: 'users.auth.ensure-access',
        concurrency: 4,
        durable: true
      }
    );

    const routeResponse = await mediator.request(
      {
        contract: 'users.auth.ensure-access',
        payload: {},
        metadata: { correlationId: 'corr-1' }
      },
      { routeKey: 'users.auth.ensure-access', timeoutMs: 100 }
    );
    expect(routeResponse.result).toStrictEqual({ ok: true });
    expect(routeResponse.metadata).toStrictEqual({ correlationId: 'corr-1' });

    const queueResponse = await mediator.request(
      {
        contract: 'users.auth.ensure-access',
        payload: {}
      },
      { queueName: 'users.auth', timeoutMs: 100 }
    );
    expect(queueResponse.result).toStrictEqual({ ok: true });

    // JUM-679: the handler is held open by the test rather than by a 25ms
    // sleep. The old form raced the 5ms timeout with a wall clock — it only
    // worked because 25 is comfortably more than 5, and "comfortably" is a
    // statement about a quiet machine. Here the handler cannot finish until
    // this test lets it, so the timeout is the only clock in the assertion.
    let releaseSlowHandler: () => void = () => undefined;
    const slowHandler = new Promise<void>((resolve) => { releaseSlowHandler = resolve; });
    mediator.registerHandler(
      'users.auth.slow',
      async () => {
        await slowHandler;
        return { contract: 'users.auth.slow', result: { ok: true } };
      }
    );

    const timeoutResponse = await mediator.request(
      { contract: 'users.auth.slow', payload: {} },
      { timeoutMs: 5 }
    );
    // Let the handler finish, so nothing is left pending after the test.
    releaseSlowHandler();
    expect(timeoutResponse.error).toBeInstanceOf(Error);
    expect((timeoutResponse.error as Error).message).toContain('timed out');
  });
});
