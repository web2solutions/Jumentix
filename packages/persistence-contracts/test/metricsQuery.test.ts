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

  it('builds month and week series from Date, epoch and string values', () => {
    expect.hasAssertions();
    const recs = [
      { id: '1', createdAt: new Date('2026-01-05T00:00:00.000Z') },
      { id: '2', createdAt: Date.parse('2026-01-08T00:00:00.000Z') },
      { id: '3', createdAt: '2026-02-10T00:00:00.000Z' }
    ];
    expect(runMetricsQuery(recs, { metric: 'series', field: 'createdAt', interval: 'month' }, capabilities).buckets)
      .toStrictEqual([
        { key: '2026-01', count: 2 },
        { key: '2026-02', count: 1 }
      ]);
    expect(runMetricsQuery(recs, { metric: 'series', field: 'createdAt', interval: 'week' }, capabilities).buckets)
      .toStrictEqual([
        { key: '2026-W01', count: 1 },
        { key: '2026-W02', count: 1 },
        { key: '2026-W06', count: 1 }
      ]);
    const defaulted = runMetricsQuery(recs, { metric: 'series', field: 'createdAt' }, capabilities);
    expect(defaulted.interval).toBe('day');
    expect(defaulted.buckets).toStrictEqual([
      { key: '2026-01-05', count: 1 },
      { key: '2026-01-08', count: 1 },
      { key: '2026-02-10', count: 1 }
    ]);
  });

  it('skips records whose series field is not a parseable date', () => {
    expect.hasAssertions();
    const recs = [
      { id: '1', createdAt: 'not-a-date' },
      { id: '2', createdAt: new Date('not-a-date') },
      { id: '3', createdAt: true },
      { id: '4', createdAt: null },
      { id: '5', createdAt: '2026-01-01T00:00:00.000Z' }
    ];
    expect(runMetricsQuery(recs, { metric: 'series', field: 'createdAt', interval: 'day' }, capabilities).buckets)
      .toStrictEqual([{ key: '2026-01-01', count: 1 }]);
  });

  it('requires field for groupBy and series and validates the series contract', () => {
    expect.hasAssertions();
    expect(() => runMetricsQuery(rows, { metric: 'groupBy' }, capabilities))
      .toThrow('The parameter field is required for groupBy and series.');
    expect(() => runMetricsQuery(rows, { metric: 'series' }, capabilities))
      .toThrow('The parameter field is required for groupBy and series.');
    expect(() => runMetricsQuery(rows, { metric: 'series', field: 'organization' }, capabilities))
      .toThrow('The metrics field "organization" is not a series field. Accepted: createdAt.');
    expect(() => runMetricsQuery(rows, { metric: 'series', field: 'createdAt', interval: 'hour' as never }, capabilities))
      .toThrow('The parameter interval is not accepted. Accepted: day, week, month.');
  });

  it('names (none) when a capability list is empty', () => {
    expect.hasAssertions();
    const empty = { groupable: [], series: [] };
    expect(() => runMetricsQuery(rows, { metric: 'groupBy', field: 'id' }, empty))
      .toThrow('Accepted: (none).');
    expect(() => runMetricsQuery(rows, { metric: 'series', field: 'createdAt' }, empty))
      .toThrow('Accepted: (none).');
  });

  it('treats empty-string tombstones as live and skips empty group keys', () => {
    expect.hasAssertions();
    const recs = [
      { id: '1', organization: '', deletedAt: '' },
      { id: '2', organization: null },
      { id: '3', organization: 'org-a' },
      { id: '4', organization: 7 }
    ];
    expect(runMetricsQuery(recs, { metric: 'count' }, capabilities).buckets)
      .toStrictEqual([{ key: 'total', count: 4 }]);
    expect(runMetricsQuery(recs, { metric: 'groupBy', field: 'organization' }, capabilities).buckets)
      .toStrictEqual([
        { key: 'org-a', count: 1 },
        { key: '7', count: 1 }
      ]);
  });
});
