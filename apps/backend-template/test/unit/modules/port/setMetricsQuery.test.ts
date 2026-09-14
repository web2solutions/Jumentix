import { BaseDomainEvent } from '@src/modules/port/BaseDomainEvent';
import { setMetricsQuery } from '@src/modules/port/setMetricsQuery';
import { ValidationError } from '@src/infra/exceptions';

class TestEvent extends BaseDomainEvent<any> {}

const event = (queryString: Record<string, unknown>) => new TestEvent({
  queryString,
  schemaOAS: { 'x-metrics-capabilities': { groupable: ['roles'], series: ['createdAt'] } }
});

describe('setMetricsQuery', () => {
  it('parses a count query', () => {
    expect.hasAssertions();
    const parsed = setMetricsQuery(event({ metric: 'count' }));
    expect(parsed.query.metric).toBe('count');
    expect(parsed.capabilities).toStrictEqual({ groupable: ['roles'], series: ['createdAt'] });
  });

  it('names accepted metrics and intervals on 400-style ValidationError', () => {
    expect.hasAssertions();
    expect(() => setMetricsQuery(event({ metric: 'avg' }))).toThrow(ValidationError);
    expect(() => setMetricsQuery(event({ metric: 'avg' })))
      .toThrow('Accepted: count, groupBy, series');
    expect(() => setMetricsQuery(event({ metric: 'series', interval: 'year' })))
      .toThrow('Accepted: day, week, month.');
  });
});
