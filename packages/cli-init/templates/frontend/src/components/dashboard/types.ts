import type { Component } from 'vue';

import type { MetricsInterval, MetricsKind } from '@/contracts/metricsSchema';
import type { XCrudText } from '@/components/x-crud/xCrudTypes';

export type DashboardWidgetSize = 'sm' | 'md' | 'lg';

export interface DashboardMetricsQuery {
  listOperationId: string;
  metricsOperationId: string;
  schemaName: string;
  metric: MetricsKind;
  field?: string;
  interval?: MetricsInterval;
  since?: string;
  showPending?: boolean;
  metricKey?: string;
}

export interface DashboardWidget {
  id: string;
  title: XCrudText;
  size: DashboardWidgetSize;
  component: Component;
  query?: DashboardMetricsQuery;
}
