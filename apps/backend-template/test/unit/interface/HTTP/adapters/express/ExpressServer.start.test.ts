import request from 'supertest';
import { ExpressServer } from '@src/interface/HTTP/adapters/express/ExpressServer';
import { InternalServerError } from '@src/infra/exceptions';

describe('ExpressServer', () => {
  const previousPort = process.env.JUMENTIX_HTTP_PORT;
  const previousNodeEnv = process.env.NODE_ENV;
  const previousCors = process.env.JUMENTIX_CORS_ALLOWED_ORIGINS;

  afterEach(async () => {
    process.env.JUMENTIX_HTTP_PORT = previousPort;
    (process.env as { NODE_ENV?: string }).NODE_ENV = previousNodeEnv;
    process.env.JUMENTIX_CORS_ALLOWED_ORIGINS = previousCors;
  });

  it('composes as a singleton and serves docs, CORS, and request context', async () => {
    expect.hasAssertions();
    (process.env as { NODE_ENV?: string }).NODE_ENV = 'dev';
    delete process.env.JUMENTIX_CORS_ALLOWED_ORIGINS;

    const first = ExpressServer.compile();
    const second = ExpressServer.compile();
    expect(second).toBe(first);

    const { application } = first as unknown as { application: import('express').Express };
    application.get('/express-lifecycle-probe', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const [asyncApiRedirect, lifecycleProbe, corsAllowed] = await Promise.all([
      request(application).get('/docs/asyncapi'),
      request(application).get('/express-lifecycle-probe'),
      request(application)
        .get('/express-lifecycle-probe')
        .set('Origin', 'https://allowed.example')
        .set('Authorization', 'Bearer unit-token')
    ]);

    expect(asyncApiRedirect.status).toBe(302);
    expect(asyncApiRedirect.headers.location).toBe('/AsyncAPIdoc');
    expect(lifecycleProbe.status).toBe(200);
    expect(corsAllowed.status).toBe(200);

    (process.env as { NODE_ENV?: string }).NODE_ENV = 'production';
    process.env.JUMENTIX_CORS_ALLOWED_ORIGINS = 'https://allowed.example';
    const deniedInProd = await request(application)
      .get('/express-lifecycle-probe')
      .set('Origin', 'https://denied.example');
    expect(deniedInProd.status).toBeGreaterThanOrEqual(400);
  });

  it('listens on JUMENTIX_HTTP_PORT when set', async () => {
    expect.hasAssertions();
    process.env.JUMENTIX_HTTP_PORT = '0';
    const server = ExpressServer.compile();
    await server.start();
    const address = (server as any).server?.address?.();
    expect(address).toBeTruthy();
    await server.stop();
  });

  it('falls back to the configured HTTP port constant when env is unset', async () => {
    expect.hasAssertions();
    delete process.env.JUMENTIX_HTTP_PORT;
    const server = ExpressServer.compile() as any;
    const listen = jest.spyOn(server.application, 'listen').mockImplementation(
      (...args: unknown[]) => {
        const callback = args.find((value) => typeof value === 'function') as (() => void) | undefined;
        if (callback) callback();
        return { close: (cb?: () => void) => { if (cb) cb(); } };
      }
    );
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await server.start();
    expect(listen).toHaveBeenCalledWith(expect.any(Number), expect.any(Function));
    listen.mockRestore();
    log.mockRestore();
    server.server = undefined;
  });

  it('rejects start failures as InternalServerError and tolerates stop without a listener', async () => {
    expect.hasAssertions();
    const server = ExpressServer.compile() as any;
    const listen = jest.spyOn(server.application, 'listen').mockImplementation(() => {
      throw new Error('bind failed');
    });
    await expect(server.start()).rejects.toBeInstanceOf(InternalServerError);
    listen.mockRestore();

    server.server = undefined;
    await expect(server.stop()).resolves.toBeUndefined();
  });
});
