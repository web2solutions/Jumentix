import { setFilter } from '@src/modules/port/setFilter';
import { BaseDomainEvent } from '@src/modules/port/BaseDomainEvent';
import { ValidationError } from '@src/infra/exceptions';
import { Security } from '@src/infra/security';
import type { IMetricsCapabilities, IMetricsQuery, TMetricsKind } from '@jumentix/persistence-contracts';

const METRICS: TMetricsKind[] = ['count', 'groupBy', 'series'];
const INTERVALS = ['day', 'week', 'month'] as const;

export const readMetricsCapabilities = (
  schemaOAS: Record<string, any> | undefined
): IMetricsCapabilities => {
  const raw = schemaOAS?.['x-metrics-capabilities'];
  return {
    groupable: Array.isArray(raw?.groupable) ? raw.groupable : [],
    series: Array.isArray(raw?.series) ? raw.series : []
  };
};

export const setMetricsQuery = (
  event: BaseDomainEvent
): { query: IMetricsQuery; filters: Record<string, any>; capabilities: IMetricsCapabilities } => {
  const capabilities = readMetricsCapabilities(event.schemaOAS);
  const raw = event.queryString ?? {};
  const metric = Security.xss(String(raw.metric ?? '')) as TMetricsKind;
  if (!METRICS.includes(metric)) {
    throw new ValidationError(
      `The parameter metric is not accepted. Accepted: ${METRICS.join(', ')}.`
    );
  }
  const field = raw.field === undefined ? undefined : Security.xss(String(raw.field));
  const intervalRaw = raw.interval === undefined
    ? undefined
    : Security.xss(String(raw.interval));
  if (intervalRaw && !INTERVALS.includes(intervalRaw as typeof INTERVALS[number])) {
    throw new ValidationError(
      'The parameter interval is not accepted. Accepted: day, week, month.'
    );
  }
  return {
    query: {
      metric,
      field,
      interval: intervalRaw as IMetricsQuery['interval'],
      filters: setFilter(event)
    },
    filters: setFilter(event),
    capabilities
  };
};
