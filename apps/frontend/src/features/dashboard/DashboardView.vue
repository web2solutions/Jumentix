<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { CCard, CCardBody, CCardHeader, CCol, CRow, CSpinner } from '@coreui/vue';

import { getSharedApiClient } from '@/contracts/apiClient';
import { formatApiError } from '@/contracts/errors';
import { listCapabilities } from '@/contracts/listSchema';
import { asListPage } from '@/contracts/listSchema';
import { can, hasSuperadmin } from '@/contracts/rbac';
import { usePermissions } from '@/contracts/usePermissions';
import { isCanaOpen } from '@/data/db';
import { countLocal } from '@/data/localRepository';
import { organizationsCrudConfig } from '@/features/organizations/organizationsCrudConfig';
import { usersCrudConfig } from '@/features/users/usersCrudConfig';
import { useI18n } from '@/i18n';
import { useAuthStore } from '@/stores/auth';
import { useProfileStore } from '@/stores/profile';

/**
 * Dashboard (JUM-781): real numbers only. The CoreUI template landing
 * (traffic chart for 2023, fictional users, payment icons) is gone; what
 * renders here is read through the same contract the X-CRUD sub-apps use —
 * list totals from the paginated envelope (JUM-777) and the signed-in
 * profile. Anything the role cannot read shows an honest empty state.
 */
const auth = useAuthStore();
const profile = useProfileStore();
const permissions = usePermissions();
const { t } = useI18n();

interface Metric {
  key: string;
  operationId: string;
  labelKey: string;
  color: string;
  icon: string;
  to: string;
  value: number | null;
  error: string;
  allowed: boolean;
}

const metrics = ref<Metric[]>([
  {
    key: 'users',
    operationId: usersCrudConfig.operations.list,
    labelKey: 'dashboard.totalUsers',
    color: 'primary',
    icon: 'cil-people',
    to: '/users',
    value: null,
    error: '',
    allowed: false
  },
  {
    key: 'organizations',
    operationId: organizationsCrudConfig.operations.list,
    labelKey: 'dashboard.totalOrganizations',
    color: 'info',
    icon: 'cil-featured-playlist',
    to: '/organizations',
    value: null,
    error: '',
    allowed: false
  }
]);

const loading = ref(true);

const loadMetric = async (metric: Metric): Promise<void> => {
  metric.allowed = can(profile.record?.roles ?? [], metric.operationId);
  if (!metric.allowed) return;
  try {
    if (isCanaOpen()) {
      const entity = metric.key === 'users' ? 'User' : 'Organization';
      metric.value = await countLocal(entity);
      return;
    }
    const capabilities = listCapabilities(metric.operationId);
    const response = await getSharedApiClient().request<unknown>({
      operationId: metric.operationId,
      query: capabilities ? { page: 1, size: 1 } : undefined,
      headers: { Authorization: auth.token }
    });
    metric.value = asListPage(response, { page: 1, size: 1 }).total;
  } catch (error) {
    metric.error = formatApiError(error);
  }
};

onMounted(async () => {
  await permissions.ensure();
  await Promise.all(metrics.value.map(loadMetric));
  loading.value = false;
});

const roles = computed(() => profile.record?.roles ?? []);
const displayName = computed(() => (
  profile.record ? `${profile.record.firstName ?? ''} ${profile.record.lastName ?? ''}`.trim() : auth.username
));
const organizationLabel = computed(() => {
  const id = profile.record?.organization;
  if (!id) return hasSuperadmin(roles.value) ? '*' : '—';
  return String(id);
});
</script>

<template>
  <div class="dashboard">
    <h3 class="mb-3">{{ t('dashboard.welcome', { name: displayName || auth.username }) }}</h3>

    <CRow class="g-3 mb-3">
      <CCol v-for="metric in metrics" :key="metric.key" :sm="6" :xl="3">
        <RouterLink :to="metric.to" custom v-slot="{ navigate }">
          <CCard
            class="text-white border-0 shadow-sm h-100"
            :class="`bg-${metric.color}`"
            role="link"
            tabindex="0"
            :data-metric="metric.key"
            @click="navigate"
            @keyup.enter="navigate"
          >
            <CCardBody class="pb-2">
              <div class="d-flex align-items-center gap-2">
                <CIcon :icon="metric.icon" size="xl" />
                <div class="fs-3 fw-semibold">
                  <CSpinner v-if="loading && metric.allowed" size="sm" />
                  <template v-else-if="!metric.allowed">—</template>
                  <template v-else-if="metric.error">{{ t('dashboard.unavailable') }}</template>
                  <template v-else>{{ metric.value }}</template>
                </div>
              </div>
              <div class="small text-white-50">{{ t(metric.labelKey) }}</div>
              <div v-if="!metric.allowed && !loading" class="small text-white-50">{{ t('dashboard.noAccess') }}</div>
              <div v-else-if="metric.error" class="small text-white-50">{{ metric.error }}</div>
            </CCardBody>
          </CCard>
        </RouterLink>
      </CCol>
      <CCol :sm="6" :xl="3">
        <CCard class="border-0 shadow-sm h-100">
          <CCardBody class="pb-2">
            <div class="small text-body-secondary text-uppercase">{{ t('dashboard.myRoles') }}</div>
            <div class="mt-1">
              <span v-for="role in roles" :key="role" class="badge text-bg-primary me-1">{{ role }}</span>
              <span v-if="roles.length === 0" class="text-body-secondary">—</span>
            </div>
          </CCardBody>
        </CCard>
      </CCol>
      <CCol :sm="6" :xl="3">
        <CCard class="border-0 shadow-sm h-100">
          <CCardBody class="pb-2">
            <div class="small text-body-secondary text-uppercase">{{ t('dashboard.myOrganization') }}</div>
            <div class="mt-1 font-monospace small" :title="organizationLabel">{{ organizationLabel }}</div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>

    <CCard class="border-0 shadow-sm">
      <CCardHeader class="bg-transparent fw-semibold">{{ t('dashboard.quickLinks') }}</CCardHeader>
      <CCardBody class="d-flex flex-wrap gap-2">
        <RouterLink v-for="metric in metrics.filter((m) => m.allowed)" :key="metric.key" :to="metric.to" class="btn btn-outline-primary btn-sm">
          <CIcon :icon="metric.icon" size="sm" /> {{ t(metric.labelKey) }}
        </RouterLink>
        <RouterLink to="/profile" class="btn btn-outline-secondary btn-sm">
          <CIcon icon="cil-user" size="sm" /> {{ t('nav.profile') }}
        </RouterLink>
      </CCardBody>
    </CCard>
  </div>
</template>
