/* global describe, it, expect, jest */
/**
 * Moved out of `test/integration/LoopBack/` by JUM-698.
 *
 * The directory was a claim this suite could not meet. It calls the handler
 * directly and asserts the payload — a real assertion, but the router, the
 * request context and the response adapter never run.
 *
 * It was not converted, and the reason is not effort: **`@loopback/rest` is not a
 * dependency of this repository.** `loopback/LoopbackServer`
 * requires it at construction, so no test here can start this adapter — the
 * server class cannot even be instantiated. Adonis-JS and Total-JS were
 * convertible because they are `find-my-way` routers underneath, and Cloudflare
 * Workers and Vercel Functions because Hono is installed.
 *
 * What that leaves untested is recorded on JUM-704, together with the
 * correlation-context defect the convertible four turned out to share: none of
 * them established the per-request store their handlers read, which made every
 * request answer 500. This adapter is very likely to have it too, and nothing
 * here can show that.
 */
import { infraHandlers } from '@src/interface/HTTP/adapters/loopback/handlers/infraHandlers';
import { Context } from '@src/infra/context/Context';

describe('loopback -> /localhost suite', () => {
  it('localhost should return 200 contract payload', async () => {
    expect.hasAssertions();

    const endpoint = infraHandlers.localhostGetHandlerFactory({} as any);
    const response = {
      statusCode: 200,
      json: jest.fn()
    };

    await new Promise<void>((resolve, reject) => {
      Context.run(new Map([['correlationId', 'loopback-correlation-id']]), () => {
        try {
          endpoint.handler({} as any, response as any);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });

    expect(response.json).toHaveBeenCalledWith({
      status: 'result',
      correlationId: 'loopback-correlation-id'
    });
  });
});
