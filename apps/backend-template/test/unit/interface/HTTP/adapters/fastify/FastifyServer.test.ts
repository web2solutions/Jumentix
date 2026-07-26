import { FastifyServer } from '@src/interface/HTTP/adapters/fastify/FastifyServer';
import { HTTPBaseServer } from '@src/interface/HTTP/ports/HTTPBaseServer';

describe('fastify server', () => {
  it('composes repeatedly while registering both static documentation roots once', async () => {
    expect.hasAssertions();
    const first = FastifyServer.compile();
    const second = FastifyServer.compile();

    expect(second).toBe(first);
    first.endPointRegister({
      method: 'get',
      path: '/fastify-lifecycle-probe',
      handler: () => Promise.resolve({ ok: true })
    });
    HTTPBaseServer.compile();

    const { application } = first;
    await application.ready();
    expect(application.hasReplyDecorator('sendFile')).toBe(true);

    const [openApiDocs, asyncApiDocs, asyncApiRedirect, lifecycleProbe] = await Promise.all([
      application.inject({ method: 'GET', url: '/OASdoc/index.html' }),
      application.inject({ method: 'GET', url: '/AsyncAPIdoc/index.html' }),
      application.inject({ method: 'GET', url: '/docs/asyncapi' }),
      application.inject({ method: 'GET', url: '/fastify-lifecycle-probe' })
    ]);

    expect([
      openApiDocs.statusCode,
      asyncApiDocs.statusCode,
      asyncApiRedirect.statusCode,
      lifecycleProbe.statusCode
    ]).toStrictEqual([200, 200, 302, 200]);

    const listen = jest.spyOn(application, 'listen').mockResolvedValue(undefined as never);
    const log = jest.spyOn(console, 'log').mockImplementation();
    await first.start();
    expect(listen).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Fastify App Listening'));

    await first.stop();
  });
});
