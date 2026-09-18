import openApi from './openapi.json';

/**
 * Entity metrics from the contract (JUM-793 / JUM-812). Capabilities live on
 * `GET …/metrics` as `x-metrics-capabilities`; the frontend never invents
 * groupable or series fields.
 */

export type MetricsKind = 'count' | 'groupBy' | 'series';
export type MetricsInterval = 'day' | 'week' | 'month';

export interface MetricsCapabilities {
  groupable: string[];
  series: string[];
}

export interface MetricsBucket {
  key: string;
  count: number;
}

export interface MetricsResult {
  metric: MetricsKind;
  field?: string;
  interval?: MetricsInterval;
  buckets: MetricsBucket[];
}

interface RawOperation {
  operationId?: string;
  'x-metrics-capabilities'?: Partial<MetricsCapabilities>;
}

const document = openApi as { paths?: Record<string, Record<string, RawOperation>> };

const pathForOperation = (operationId: string): string | undefined => {
  for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
    for (const operation of Object.values(pathItem)) {
      if (operation?.operationId === operationId) return path;
    }
  }
  return undefined;
};

export const metricsSpecForListOperation = (
  listOperationId: string
): { operationId: string; capabilities: MetricsCapabilities } | undefined => {
  const listPath = pathForOperation(listOperationId);
  if (!listPath) return undefined;
  const metricsPath = `${listPath.replace(/\/$/, '')}/metrics`;
  const get = document.paths?.[metricsPath]?.get;
  if (!get?.operationId) return undefined;
  const raw = get['x-metrics-capabilities'];
  return {
    operationId: get.operationId,
    capabilities: {
      groupable: raw?.groupable ?? [],
      series: raw?.series ?? []
    }
  };
};

export const asMetricsResult = (response: unknown): MetricsResult => {
  const raw = (response ?? {}) as Partial<MetricsResult>;
  const buckets = Array.isArray(raw.buckets) ? raw.buckets : [];
  const metric: MetricsKind = raw.metric === 'groupBy' || raw.metric === 'series'
    ? raw.metric
    : 'count';
  let interval: MetricsResult['interval'];
  if (raw.interval === 'week' || raw.interval === 'month' || raw.interval === 'day') {
    interval = raw.interval;
  }
  return {
    metric,
    field: typeof raw.field === 'string' ? raw.field : undefined,
    interval,
    buckets: buckets.map((bucket) => ({
      key: String(bucket.key ?? ''),
      count: Number(bucket.count) || 0
    }))
  };
};
