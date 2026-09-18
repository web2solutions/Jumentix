<script setup lang="ts">
import { CSpinner } from '@coreui/vue';
import { onMounted, ref } from 'vue';

import { formatApiError } from '@/contracts/errors';
import type { MetricsResult } from '@/contracts/metricsSchema';
import { can } from '@/contracts/rbac';
import { usePermissions } from '@/contracts/usePermissions';
import { useI18n } from '@/i18n';
import { useProfileStore } from '@/stores/profile';

import ChartCard from './ChartCard.vue';
import { countPendingLocal, loadMetrics } from './loadMetrics';
import type { DashboardWidget } from './types';

const props = defineProps<{ widget: DashboardWidget }>();
const { t, localized } = useI18n();
const profile = useProfileStore();
const permissions = usePermissions();

const loading = ref(true);
const allowed = ref(false);
const error = ref('');
const result = ref<MetricsResult>({ metric: 'count', buckets: [] });
const pending = ref(0);

const total = (): number => result.value.buckets.find((bucket) => bucket.key === 'total')?.count
  ?? result.value.buckets.reduce((sum, bucket) => sum + bucket.count, 0);

onMounted(async () => {
  await permissions.ensure();
  const query = props.widget.query;
  if (!query) {
    loading.value = false;
    return;
  }
  allowed.value = can(profile.record?.roles ?? [], query.listOperationId);
  if (!allowed.value) {
    loading.value = false;
    return;
  }
  try {
    result.value = await loadMetrics(query);
    if (query.showPending) pending.value = await countPendingLocal(query.schemaName);
  } catch (caught) {
    error.value = formatApiError(caught);
  }
  loading.value = false;
});
</script>

<template>
  <div
    class="metric-widget"
    :data-metric="widget.query?.metricKey"
    :data-widget="widget.id"
  >
    <CSpinner v-if="loading && allowed" size="sm" />
    <template v-else-if="!allowed">
      <div class="fs-3 fw-semibold">—</div>
      <div class="small text-body-secondary">{{ t('dashboard.noAccess') }}</div>
    </template>
    <template v-else-if="error">
      <div class="small text-danger">{{ error }}</div>
    </template>
    <template v-else-if="widget.query?.metric === 'count'">
      <div class="fs-3 fw-semibold">{{ total() }}</div>
      <div class="small text-body-secondary">{{ localized(widget.title) }}</div>
      <div v-if="pending > 0" class="small text-warning" data-pending-count>
        {{ t('dashboard.pendingCount', { count: pending }) }}
      </div>
    </template>
    <ChartCard
      v-else
      :title="localized(widget.title)"
      :buckets="result.buckets"
      :kind="widget.query?.metric === 'series' ? 'line' : 'bar'"
    />
  </div>
</template>
