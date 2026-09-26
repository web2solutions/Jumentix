import { DOCS_PREFIX } from '@src/config/constants';
import { Context } from '@src/infra/context/Context';
import apiDocGetHandlerFactory from '@src/interface/HTTP/adapters/express/handlers/apiDocGetHandlerFactory';
import apiVersionsGetHandlerFactory from '@src/interface/HTTP/adapters/express/handlers/apiversions.get';
import localhostGetHandlerFactory from '@src/interface/HTTP/adapters/express/handlers/localhost.get';

/**
 * Unit suite for the express infra handlers registered by every RestAPI boot
 * (JUM-491 pulled them into the unit coverage set via the RestAPI wiring
 * suite): the REAL factories and handlers run against stubbed express
 * response objects — what is pinned is the correlation-id contract of
 * `/localhost`, the versions document of `/versions` and the spec passthrough
 * of the doc handler, including their error paths.
 */

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn()
});

describe('express infra handlers', () => {
  it('localhost answers with the request correlation id from the context store', async () => {
    expect.hasAssertions();
    const endpoint = localhostGetHandlerFactory({} as any);
    expect(endpoint.path).toBe('/');
    const res = makeRes();
    await Context.run(new Map([['correlationId', 'cid-1']]), () =>
      endpoint.handler({} as any, res as any)
    );
    expect(res.json).toHaveBeenCalledWith({ status: 'result', correlationId: 'cid-1' });
  });

  it('localhost declares the error through sendErrorResponse without a context store', async () => {
    expect.hasAssertions();
    const endpoint = localhostGetHandlerFactory({} as any);
    const res = makeRes();
    await endpoint.handler({} as any, res as any);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it('apiVersions maps every registered spec version to its docs path', async () => {
    expect.hasAssertions();
    const endpoint = apiVersionsGetHandlerFactory({
      apiDocs: new Map([
        ['1.0.0', {}],
        ['2.0.0', {}]
      ])
    } as any);
    expect(endpoint.path).toBe('/versions');
    const res = makeRes();
    await endpoint.handler({} as any, res as any);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      versions: {
        '1.0.0': `${DOCS_PREFIX}/1.0.0`,
        '2.0.0': `${DOCS_PREFIX}/2.0.0`
      }
    });
  });

  it('apiVersions answers an empty document when no specs are injected', async () => {
    expect.hasAssertions();
    const endpoint = apiVersionsGetHandlerFactory({} as any);
    const res = makeRes();
    await endpoint.handler({} as any, res as any);
    expect(res.json).toHaveBeenCalledWith({ versions: {} });
  });

  it('apiDocGet answers the spec it was built with', async () => {
    expect.hasAssertions();
    const spec = { openapi: '3.1.0', info: { version: '1.0.0' } };
    const endpoint = apiDocGetHandlerFactory({ spec, version: '1.0.0' } as any);
    expect(endpoint.path).toBe('/1.0.0');
    const res = makeRes();
    await endpoint.handler({} as any, res as any);
    expect(res.json).toHaveBeenCalledWith(spec);
  });

  it('apiDocGet declares the error through sendErrorResponse when serialization fails', async () => {
    expect.hasAssertions();
    const endpoint = apiDocGetHandlerFactory({ spec: {}, version: '1.0.0' } as any);
    const res = makeRes();
    res.json.mockImplementationOnce(() => {
      throw new Error('serialization failed');
    });
    await endpoint.handler({} as any, res as any);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
