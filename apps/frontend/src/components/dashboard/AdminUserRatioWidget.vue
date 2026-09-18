<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { CSpinner } from '@coreui/vue';

import { can } from '@/contracts/rbac';
import { formatApiError } from '@/contracts/errors';
import { usePermissions } from '@/contracts/usePermissions';
import { useI18n } from '@/i18n';
import { useProfileStore } from '@/stores/profile';

import { loadMetrics } from './loadMetrics';
import type { DashboardWidget } from './types';

const props = defineProps<{ widget: DashboardWidget }>();
const { t } = useI18n();
const profile = useProfileStore();
const permissions = usePermissions();

const loading = ref(true);
const allowed = ref(false);
const error = ref('');
const adminCount = ref(0);
const userCount = ref(0);

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
    const result = await loadMetrics(query);
    adminCount.value = result.buckets
      .filter((bucket) => bucket.key === 'admin' || bucket.key === 'superadmin')
      .reduce((sum, bucket) => sum + bucket.count, 0);
    userCount.value = result.buckets.find((bucket) => bucket.key === 'user')?.count ?? 0;
  } catch (caught) {
    error.value = formatApiError(caught);
  }
  loading.value = false;
});
</script>

<template>
  <div data-widget="users:admin-user-ratio">
    <CSpinner v-if="loading && allowed" size="sm" />
    <template v-else-if="!allowed">
      <div class="small text-body-secondary">{{ t('dashboard.noAccess') }}</div>
    </template>
    <template v-else-if="error">
      <div class="small text-danger">{{ error }}</div>
    </template>
    <template v-else>
      <div class="fs-4 fw-semibold" data-ratio>
        {{ adminCount }} / {{ userCount }}
      </div>
      <div class="small text-body-secondary">{{ t('dashboard.adminUserRatioHint') }}</div>
    </template>
  </div>
</template>
