import { applyListFilters, type TListFilters } from './listQuery';

export type TMetricsKind = 'count' | 'groupBy' | 'series';
export type TMetricsInterval = 'day' | 'week' | 'month';

export interface IMetricsCapabilities {
  groupable: string[];
  series: string[];
}

export interface IMetricsQuery {
  metric: TMetricsKind;
  field?: string;
  interval?: TMetricsInterval;
  filters?: TListFilters | Record<string, string | number>;
}

export interface IMetricsBucket {
  key: string;
  count: number;
}

export interface IMetricsResult {
  metric: TMetricsKind;
  field?: string;
  interval?: TMetricsInterval;
  buckets: IMetricsBucket[];
}

const list = (values: string[]): string => (values.length ? values.join(', ') : '(none)');

const asDate = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
};

const seriesKey = (value: unknown, interval: TMetricsInterval): string | null => {
  const date = asDate(value);
  if (!date) return null;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  if (interval === 'day') return `${year}-${month}-${day}`;
  if (interval === 'month') return `${year}-${month}`;
  const jan1 = Date.UTC(year, 0, 1);
  const week = Math.floor((date.getTime() - jan1) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
};

const groupKeys = (value: unknown): string[] => {
  if (value === null || value === undefined || value === '') return [];
  if (Array.isArray(value)) return value.map((entry) => String(entry));
  return [String(value)];
};

export const runMetricsQuery = <T extends Record<string, unknown>>(
  records: T[],
  query: IMetricsQuery,
  capabilities: IMetricsCapabilities
): IMetricsResult => {
  const { metric } = query;
  if (metric !== 'count' && metric !== 'groupBy' && metric !== 'series') {
    throw new Error('The parameter metric is not accepted. Accepted: count, groupBy, series.');
  }
  const live = records.filter((record) => record.deletedAt == null || record.deletedAt === '');
  const filtered = applyListFilters(live, query.filters);

  if (metric === 'count') {
    return {
      metric,
      buckets: [{ key: 'total', count: filtered.length }]
    };
  }

  const { field } = query;
  if (!field) {
    throw new Error('The parameter field is required for groupBy and series.');
  }

  if (metric === 'groupBy') {
    if (!capabilities.groupable.includes(field)) {
      throw new Error(
        `The metrics field "${field}" is not groupable. Accepted: ${list(capabilities.groupable)}.`
      );
    }
    const counts = new Map<string, number>();
    for (const record of filtered) {
      for (const key of groupKeys(record[field])) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return {
      metric,
      field,
      buckets: [...counts.entries()].map(([key, count]) => ({ key, count }))
    };
  }

  if (!capabilities.series.includes(field)) {
    throw new Error(
      `The metrics field "${field}" is not a series field. Accepted: ${list(capabilities.series)}.`
    );
  }
  const interval = query.interval ?? 'day';
  if (interval !== 'day' && interval !== 'week' && interval !== 'month') {
    throw new Error('The parameter interval is not accepted. Accepted: day, week, month.');
  }
  const counts = new Map<string, number>();
  for (const record of filtered) {
    const key = seriesKey(record[field], interval);
    if (key) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return {
    metric,
    field,
    interval,
    buckets: [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, count]) => ({ key, count }))
  };
};
