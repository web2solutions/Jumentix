import getUsersMetrics from '@src/modules/Users/interface/restapi/frameworks/express/handlers/getUsersMetrics';
import getOrganizationsMetrics from '@src/modules/Users/interface/restapi/frameworks/express/handlers/getOrganizationsMetrics';
import { ValidationError } from '@src/infra/exceptions';

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn()
});

describe('express entity metrics handlers', () => {
  it('returns 200 for count and 400 when metric is not accepted', async () => {
    expect.hasAssertions();
    const controller = {
      getUsersMetrics: jest.fn()
        .mockResolvedValueOnce({ result: { metric: 'count', buckets: [{ key: 'total', count: 2 }] } })
        .mockRejectedValueOnce(new ValidationError(
          'The parameter metric is not accepted. Accepted: count, groupBy, series.'
        ))
    };
    const endpoint = getUsersMetrics({
      endPointConfig: { 'x-metrics-capabilities': { groupable: [], series: [] } },
      controller
    } as any);
    expect(endpoint.path).toBe('/users/metrics');

    const ok = makeRes();
    await endpoint.handler({
      query: { metric: 'count' },
      headers: { authorization: 'Bearer token' }
    } as any, ok as any);
    expect(ok.status).toHaveBeenCalledWith(200);
    expect(ok.json).toHaveBeenCalledWith({ metric: 'count', buckets: [{ key: 'total', count: 2 }] });

    const bad = makeRes();
    await endpoint.handler({
      query: { metric: 'avg' },
      headers: { authorization: 'Bearer token' }
    } as any, bad as any);
    expect(bad.status).toHaveBeenCalledWith(400);
    expect(bad.json).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Accepted: count, groupBy, series')
    }));
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
    expect(res.status).toHaveBeenCalledWith(200);
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
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
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
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('can not be empty')
    }));
  });

  it('rethrows a resolved service error through the error response path', async () => {
    expect.hasAssertions();
    const usersController = {
      getUsersMetrics: jest.fn().mockResolvedValue({
        error: new ValidationError('The parameter metric is not accepted. Accepted: count.')
      })
    };
    const usersEndpoint = getUsersMetrics({
      endPointConfig: {}, controller: usersController
    } as any);
    const usersRes = makeRes();
    await usersEndpoint.handler({
      query: { metric: 'avg' },
      headers: { authorization: 'Bearer token' }
    } as any, usersRes as any);
    expect(usersRes.status).toHaveBeenCalledWith(400);

    const organizationsController = {
      getOrganizationsMetrics: jest.fn().mockResolvedValue({
        error: new ValidationError('The parameter metric is not accepted. Accepted: count.')
      })
    };
    const organizationsEndpoint = getOrganizationsMetrics({
      endPointConfig: {},
      controller: organizationsController
    } as any);
    const organizationsRes = makeRes();
    await organizationsEndpoint.handler({
      query: { metric: 'avg' },
      headers: { authorization: 'Bearer token' }
    } as any, organizationsRes as any);
    expect(organizationsRes.status).toHaveBeenCalledWith(400);
  });
});
