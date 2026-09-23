import apiDocGetHandlerFactory from '@src/interface/HTTP/adapters/fastify/handlers/apiDocGetHandlerFactory';

const makeRes = () => ({
  code: jest.fn().mockReturnThis(),
  send: jest.fn()
});

describe('fastify infra handlers', () => {
  it('returns the API document supplied to the factory', async () => {
    expect.hasAssertions();
    const spec = { openapi: '3.1.0', info: { version: '1.0.0' } };
    const endpoint = apiDocGetHandlerFactory({ spec, version: '1.0.0' } as any);
    const res = makeRes();
    res.send.mockResolvedValue(res);

    await expect(endpoint.handler({} as any, res as any)).resolves.toBe(res);

    expect(endpoint.path).toBe('/1.0.0');
    expect(endpoint.method).toBe('get');
    expect(res.send).toHaveBeenCalledWith(spec);
  });

  it('handles an asynchronous reply serialization failure', async () => {
    expect.hasAssertions();
    const endpoint = apiDocGetHandlerFactory({ spec: {}, version: '1.0.0' } as any);
    const res = makeRes();
    res.send
      .mockRejectedValueOnce(new Error('serialization failed'))
      .mockReturnValueOnce(res);

    await endpoint.handler({} as any, res as any);

    expect(res.code).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledTimes(2);
  });
});
