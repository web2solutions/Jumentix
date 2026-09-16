import getUsersMetrics from '@src/modules/Users/interface/restapi/frameworks/fastify/handlers/getUsersMetrics';
import getOrganizationsMetrics from '@src/modules/Users/interface/restapi/frameworks/fastify/handlers/getOrganizationsMetrics';
import { ValidationError } from '@src/infra/exceptions';

const makeRes = () => ({
  code: jest.fn().mockReturnThis(),
  send: jest.fn()
});

describe('fastify entity metrics handlers', () => {
  it('returns 200 and the buckets for an accepted metric', async () => {
    expect.hasAssertions();
    const controller = {
      getUsersMetrics: jest.fn().mockResolvedValue({
        result: { metric: 'count', buckets: [{ key: 'total', count: 2 }] }
      })
    };
    const endpoint = getUsersMetrics({
      endPointConfig: { 'x-metrics-capabilities': { groupable: [], series: [] } },
      controller
    } as any);
    expect(endpoint.path).toBe('/users/metrics');
    expect(endpoint.method).toBe('get');

    const res = makeRes();
    const payload = await endpoint.handler({
      query: { metric: 'count' },
      headers: { authorization: 'Bearer token' }
    } as any, res as any);
    expect(res.code).toHaveBeenCalledWith(200);
    expect(payload).toStrictEqual({ metric: 'count', buckets: [{ key: 'total', count: 2 }] });
  });

  it('registers organizations metrics on GET /organizations/metrics', async () => {
    expect.hasAssertions();
    const controller = {
      getOrganizationsMetrics: jest.fn().mockResolvedValue({
        result: { metric: 'count', buckets: [{ key: 'total', count: 1 }] }
      })
    };
    const endpoint = getOrganizationsMetrics({
      endPointConfig: {},
      controller
    } as any);
    expect(endpoint.path).toBe('/organizations/metrics');
    const res = makeRes();
    await endpoint.handler({
      query: { metric: 'count' },
      headers: { authorization: 'Bearer token' }
    } as any, res as any);
    expect(res.code).toHaveBeenCalledWith(200);
  });

  it('defaults a missing query string and authorization header on users metrics', async () => {
    expect.hasAssertions();
    const controller = {
      getUsersMetrics: jest.fn().mockResolvedValue({
        result: { metric: 'count', buckets: [{ key: 'total', count: 0 }] }
      })
    };
    const endpoint = getUsersMetrics({ endPointConfig: {}, controller } as any);
    const res = makeRes();
    await endpoint.handler({ headers: {} } as any, res as any);
    expect(res.code).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('can not be empty')
    }));
  });

  it('defaults a missing query string and authorization header on organizations metrics', async () => {
    expect.hasAssertions();
    const controller = {
      getOrganizationsMetrics: jest.fn().mockResolvedValue({
        result: { metric: 'count', buckets: [{ key: 'total', count: 0 }] }
      })
    };
    const endpoint = getOrganizationsMetrics({ endPointConfig: {}, controller } as any);
    const res = makeRes();
    await endpoint.handler({ headers: {} } as any, res as any);
    expect(res.code).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('can not be empty')
    }));
  });

  it('rethrows a resolved service error through the error response path', async () => {
    expect.hasAssertions();
    const usersEndpoint = getUsersMetrics({
      endPointConfig: {},
      controller: {
        getUsersMetrics: jest.fn().mockResolvedValue({
          error: new ValidationError('The parameter metric is not accepted. Accepted: count.')
        })
      }
    } as any);
    const usersRes = makeRes();
    await usersEndpoint.handler({
      query: { metric: 'avg' },
      headers: { authorization: 'Bearer token' }
    } as any, usersRes as any);
    expect(usersRes.code).toHaveBeenCalledWith(400);

    const organizationsEndpoint = getOrganizationsMetrics({
      endPointConfig: {},
      controller: {
        getOrganizationsMetrics: jest.fn().mockResolvedValue({
          error: new ValidationError('The parameter metric is not accepted. Accepted: count.')
        })
      }
    } as any);
    const organizationsRes = makeRes();
    await organizationsEndpoint.handler({
      query: { metric: 'avg' },
      headers: { authorization: 'Bearer token' }
    } as any, organizationsRes as any);
    expect(organizationsRes.code).toHaveBeenCalledWith(400);
  });
});
