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
});
