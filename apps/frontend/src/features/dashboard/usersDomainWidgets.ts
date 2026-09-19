import MetricWidget from '@/components/dashboard/MetricWidget.vue';
import AdminUserRatioWidget from '@/components/dashboard/AdminUserRatioWidget.vue';
import type { DashboardWidget } from '@/components/dashboard/types';
import { metricsSpecForListOperation } from '@/contracts/metricsSchema';
import { usersCrudConfig } from '@/features/users/usersCrudConfig';

const usersMetrics = metricsSpecForListOperation(usersCrudConfig.operations.list);

const daysAgo = (days: number): string => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
};

export const usersDomainWidgets = (): DashboardWidget[] => {
  if (!usersMetrics) return [];
  return [
    {
      id: 'users:members-per-org',
      title: { en: 'Members per organization', 'pt-BR': 'Membros por organização' },
      size: 'md',
      component: MetricWidget,
      query: {
        listOperationId: usersCrudConfig.operations.list,
        metricsOperationId: usersMetrics.operationId,
        schemaName: usersCrudConfig.entity,
        metric: 'groupBy',
        field: 'organization'
      }
    },
    {
      id: 'users:admin-user-ratio',
      title: { en: 'Admin / user ratio', 'pt-BR': 'Razão admin / usuário' },
      size: 'sm',
      component: AdminUserRatioWidget,
      query: {
        listOperationId: usersCrudConfig.operations.list,
        metricsOperationId: usersMetrics.operationId,
        schemaName: usersCrudConfig.entity,
        metric: 'groupBy',
        field: 'roles'
      }
    },
    {
      id: 'users:signups-30d',
      title: { en: 'Sign-ups (30 days)', 'pt-BR': 'Cadastros (30 dias)' },
      size: 'sm',
      component: MetricWidget,
      query: {
        listOperationId: usersCrudConfig.operations.list,
        metricsOperationId: usersMetrics.operationId,
        schemaName: usersCrudConfig.entity,
        metric: 'count',
        since: daysAgo(30),
        metricKey: 'signups-30d'
      }
    }
  ];
};
