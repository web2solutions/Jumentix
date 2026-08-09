/* eslint-disable @typescript-eslint/no-explicit-any */
import { Context } from '@src/infra/context/Context';
import { _DOCS_PREFIX_ } from '@src/config/constants';
import localhostGetHandlerFactory from '@src/interface/HTTP/adapters/express/handlers/localhost.get';
import apiVersionsGetHandlerFactory from '@src/interface/HTTP/adapters/express/handlers/apiversions.get';
import apiDocGetHandlerFactory from '@src/interface/HTTP/adapters/express/handlers/apiDocGetHandlerFactory';

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
  it('localhost answers with the request correlation id from the context store', () => {
    expect.hasAssertions();
    const endpoint = localhostGetHandlerFactory({} as any);
    expect(endpoint.path).toBe('/');
    const res = makeRes();
    Context.run(new Map([['correlationId', 'cid-1']]), () => {
      endpoint.handler({} as any, res as any);
    });
    expect(res.json).toHaveBeenCalledWith({ status: 'result', correlationId: 'cid-1' });
  });

  it('localhost declares the error through sendErrorResponse without a context store', () => {
    expect.hasAssertions();
    const endpoint = localhostGetHandlerFactory({} as any);
    const res = makeRes();
    endpoint.handler({} as any, res as any);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.any(String) })
    );
  });

  it('apiVersions maps every registered spec version to its docs path', () => {
    expect.hasAssertions();
    const endpoint = apiVersionsGetHandlerFactory({
      apiDocs: new Map([['1.0.0', {}], ['2.0.0', {}]])
    } as any);
    expect(endpoint.path).toBe('/versions');
    const res = makeRes();
    endpoint.handler({} as any, res as any);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      versions: {
        '1.0.0': `${_DOCS_PREFIX_}/1.0.0`,
        '2.0.0': `${_DOCS_PREFIX_}/2.0.0`
      }
    });
  });

  it('apiVersions answers an empty document when no specs are injected', () => {
    expect.hasAssertions();
    const endpoint = apiVersionsGetHandlerFactory({} as any);
    const res = makeRes();
    endpoint.handler({} as any, res as any);
    expect(res.json).toHaveBeenCalledWith({ versions: {} });
  });

  it('apiDocGet answers the spec it was built with', () => {
    expect.hasAssertions();
    const spec = { openapi: '3.1.0', info: { version: '1.0.0' } };
    const endpoint = apiDocGetHandlerFactory({ spec, version: '1.0.0' } as any);
    expect(endpoint.path).toBe('/1.0.0');
    const res = makeRes();
    endpoint.handler({} as any, res as any);
    expect(res.json).toHaveBeenCalledWith(spec);
  });

  it('apiDocGet declares the error through sendErrorResponse when serialization fails', () => {
    expect.hasAssertions();
    const endpoint = apiDocGetHandlerFactory({ spec: {}, version: '1.0.0' } as any);
    const res = makeRes();
    res.json.mockImplementationOnce(() => {
      throw new Error('serialization failed');
    });
    endpoint.handler({} as any, res as any);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
