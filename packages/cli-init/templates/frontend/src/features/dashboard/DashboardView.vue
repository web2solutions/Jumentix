<script setup lang="ts">
import { CCard, CCardBody, CCol, CRow } from '@coreui/vue';
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import DashboardGrid from '@/components/dashboard/DashboardGrid.vue';
import { genericWidgetsForModule } from '@/components/dashboard/genericWidgets';
import { hasSuperadmin } from '@/contracts/rbac';
import { useI18n } from '@/i18n';
import { findModule } from '@/modules/manifest';
import { useAuthStore } from '@/stores/auth';
import { useProfileStore } from '@/stores/profile';

/**
 * Module dashboard (JUM-811/812): generic OAS metrics plus domain widgets
 * registered on the module manifest. Totals used to come from list envelopes;
 * they now come from GET …/metrics (or Cana + runMetricsQuery offline).
 */
const route = useRoute();
const auth = useAuthStore();
const profile = useProfileStore();
const { t } = useI18n();

const moduleId = computed(() => (
  typeof route.params.moduleId === 'string' ? route.params.moduleId : 'users'
));
const mod = computed(() => findModule(moduleId.value) ?? findModule('users'));
const widgets = computed(() => [
  ...genericWidgetsForModule(mod.value),
  ...(mod.value?.dashboard?.widgets ?? [])
]);

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

    <DashboardGrid :widgets="widgets" />
  </div>
</template>
