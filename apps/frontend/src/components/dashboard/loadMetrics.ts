import { runMetricsQuery, type IMetricsQuery } from '@jumentix/persistence-contracts';

import { getSharedApiClient } from '@/contracts/apiClient';
import { toQueryParams } from '@/contracts/listSchema';
import {
  asMetricsResult,
  metricsSpecForListOperation,
  type MetricsResult
} from '@/contracts/metricsSchema';
import { isCanaOpen } from '@/data/db';
import { listLocal } from '@/data/localRepository';
import { useAuthStore } from '@/stores/auth';

import type { DashboardMetricsQuery } from './types';

const sinceFilter = (since: string | undefined): Record<string, unknown> | undefined => {
  if (!since) return undefined;
  return { createdAt: { operator: 'gte', value: since } };
};

const localRecords = async (
  schemaName: string,
  since?: string
): Promise<Array<Record<string, unknown>>> => {
  const head = await listLocal(schemaName, { page: 1, size: 1 });
  const page = await listLocal(schemaName, { page: 1, size: Math.max(head.total, 1) });
  if (!since) return page.result;
  const start = Date.parse(since);
  return page.result.filter((row) => Date.parse(String(row.createdAt ?? '')) >= start);
};

export const loadMetrics = async (query: DashboardMetricsQuery): Promise<MetricsResult> => {
  const spec = metricsSpecForListOperation(query.listOperationId);
  const capabilities = spec?.capabilities ?? { groupable: [], series: [] };
  if (isCanaOpen()) {
    const records = await localRecords(query.schemaName, query.since);
    const metricsQuery: IMetricsQuery = {
      metric: query.metric,
      field: query.field,
      interval: query.interval,
      filters: undefined
    };
    return runMetricsQuery(records, metricsQuery, capabilities);
  }
  const response = await getSharedApiClient().request<unknown>({
    operationId: query.metricsOperationId,
    query: {
      metric: query.metric,
      ...(query.field ? { field: query.field } : {}),
      ...(query.interval ? { interval: query.interval } : {}),
      ...toQueryParams({ filter: sinceFilter(query.since) })
    },
    headers: { Authorization: useAuthStore().token }
  });
  return asMetricsResult(response);
};

export const countPendingLocal = async (schemaName: string): Promise<number> => {
  if (!isCanaOpen()) return 0;
  const records = await localRecords(schemaName);
  return records.filter((row) => row._sync === 'pending').length;
};
