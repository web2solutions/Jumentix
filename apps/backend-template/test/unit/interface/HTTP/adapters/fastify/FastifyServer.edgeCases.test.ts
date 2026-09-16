/* eslint-disable @typescript-eslint/no-explicit-any */

import { FastifyServer } from '@src/interface/HTTP/adapters/fastify/FastifyServer';

const CORS_ORIGINS_ENV = 'JUMENTIX_CORS_ALLOWED_ORIGINS';

/**
 * The two paths the lifecycle suite beside this one cannot take: an origin the
 * allow list refuses, and a `listen` that fails.
 *
 * The CORS allow list is empty in every test environment, which makes every
 * origin acceptable and turns the rejection branch into dead code — until a
 * deployment sets `JUMENTIX_CORS_ALLOWED_ORIGINS` and the branch becomes the
 * only thing standing between the API and a cross-origin caller.
 */
describe('fastify server origin rejection and startup failure', () => {
  afterEach(() => {
    delete process.env[CORS_ORIGINS_ENV];
  });

  it('rejects a request whose origin is outside the allow list', async () => {
    expect.hasAssertions();

    process.env[CORS_ORIGINS_ENV] = 'https://allowed.example';

    const server = FastifyServer.compile() as any;
    server.endPointRegister({
      method: 'get',
      path: '/fastify-cors-origin-probe',
      handler: () => Promise.resolve({ ok: true })
    });
    await server.application.ready();

    const denied = await server.application.inject({
      method: 'GET',
      url: '/fastify-cors-origin-probe',
      headers: { origin: 'https://denied.example' }
    });
    expect(denied.statusCode).toBe(500);
    expect(denied.json()).toMatchObject({ message: 'Not allowed by CORS' });

    const allowed = await server.application.inject({
      method: 'GET',
      url: '/fastify-cors-origin-probe',
      headers: { origin: 'https://allowed.example' }
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json()).toStrictEqual({ ok: true });
  });

  it('logs the failure, stops and rethrows when listening fails', async () => {
    expect.hasAssertions();

    const server = FastifyServer.compile() as any;
    const failure = new Error('port already in use');
    const listen = jest.spyOn(server.application, 'listen').mockRejectedValue(failure);
    const errorLog = jest.spyOn(console, 'error').mockImplementation();
    // Keeping `stop` a double protects the shared application instance the
    // suites in this process still need; the rejection and the log line are
    // the observable contract.
    const stop = jest.spyOn(server, 'stop').mockResolvedValue(undefined);

    await expect(server.start()).rejects.toThrow('port already in use');

    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('An error occurred'));
    expect(stop).toHaveBeenCalledTimes(1);

    listen.mockRestore();
    errorLog.mockRestore();
    stop.mockRestore();
  });
});
