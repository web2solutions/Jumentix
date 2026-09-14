import { runMetricsQuery } from '../src';

const rows = [
  {
    id: '1', roles: ['admin'], organization: 'org-a', createdAt: '2026-01-01T10:00:00.000Z'
  },
  {
    id: '2', roles: ['user'], organization: 'org-a', createdAt: '2026-01-02T10:00:00.000Z'
  },
  {
    id: '3',
    roles: ['admin', 'user'],
    organization: 'org-b',
    createdAt: '2026-02-01T10:00:00.000Z'
  },
  {
    id: '4',
    roles: ['admin'],
    organization: 'org-b',
    createdAt: '2026-02-02T10:00:00.000Z',
    deletedAt: '2026-03-01T00:00:00.000Z'
  }
];

const capabilities = { groupable: ['roles', 'organization'], series: ['createdAt'] };

describe('runMetricsQuery', () => {
  it('counts live records only', () => {
    expect.hasAssertions();
    expect(runMetricsQuery(rows, { metric: 'count' }, capabilities)).toStrictEqual({
      metric: 'count',
      buckets: [{ key: 'total', count: 3 }]
    });
  });

  it('groups by enum and by array field', () => {
    expect.hasAssertions();
    const orgs = runMetricsQuery(
      rows,
      { metric: 'groupBy', field: 'organization' },
      capabilities
    ).buckets;
    expect(orgs).toContainEqual({ key: 'org-a', count: 2 });
    expect(orgs).toContainEqual({ key: 'org-b', count: 1 });
    const roles = runMetricsQuery(rows, { metric: 'groupBy', field: 'roles' }, capabilities).buckets;
    expect(roles.find((b) => b.key === 'admin')?.count).toBe(2);
    expect(roles.find((b) => b.key === 'user')?.count).toBe(2);
  });

  it('builds a day series and applies filters', () => {
    expect.hasAssertions();
    const series = runMetricsQuery(rows, {
      metric: 'series',
      field: 'createdAt',
      interval: 'day',
      filters: { organization: 'org-a' }
    }, capabilities);
    expect(series.buckets).toStrictEqual([
      { key: '2026-01-01', count: 1 },
      { key: '2026-01-02', count: 1 }
    ]);
  });

  it('names accepted values on invalid field or metric', () => {
    expect.hasAssertions();
    expect(() => runMetricsQuery(rows, { metric: 'nope' as never }, capabilities))
      .toThrow('Accepted: count, groupBy, series');
    expect(() => runMetricsQuery(rows, { metric: 'groupBy', field: 'id' }, capabilities))
      .toThrow('Accepted: roles, organization');
  });
});
