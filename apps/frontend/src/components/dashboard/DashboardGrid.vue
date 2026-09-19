<script setup lang="ts">
import { CCard, CCardBody, CCardHeader, CCol, CRow } from '@coreui/vue';
import { reactive } from 'vue';

import { useI18n } from '@/i18n';

import type { DashboardWidget, DashboardWidgetSize } from './types';

const props = defineProps<{ widgets: DashboardWidget[] }>();
const { t, localized } = useI18n();
const collapsed = reactive<Record<string, boolean>>({});

const colFor = (size: DashboardWidgetSize): { md: number; lg: number } => {
  if (size === 'lg') return { md: 12, lg: 12 };
  if (size === 'md') return { md: 12, lg: 6 };
  return { md: 6, lg: 4 };
};

const toggle = (id: string): void => {
  collapsed[id] = !collapsed[id];
};
</script>

<template>
  <div class="dashboard-grid" data-dashboard-grid>
    <p v-if="props.widgets.length === 0" class="text-body-secondary" data-dashboard-empty>
      {{ t('dashboard.empty') }}
    </p>
    <CRow v-else class="g-3">
      <CCol
        v-for="widget in props.widgets"
        :key="widget.id"
        :xs="12"
        :md="colFor(widget.size).md"
        :lg="colFor(widget.size).lg"
        :data-widget-size="widget.size"
      >
        <CCard class="border-0 shadow-sm h-100" :data-widget-card="widget.id">
          <CCardHeader class="bg-transparent d-flex justify-content-between align-items-center gap-2">
            <span class="fw-semibold">{{ localized(widget.title) }}</span>
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary"
              :aria-expanded="collapsed[widget.id] ? 'false' : 'true'"
              :aria-controls="`dashboard-widget-${widget.id.replace(/:/g, '-')}`"
              @click="toggle(widget.id)"
            >
              {{ collapsed[widget.id] ? t('dashboard.expand') : t('dashboard.collapse') }}
            </button>
          </CCardHeader>
          <CCardBody v-show="!collapsed[widget.id]" :id="`dashboard-widget-${widget.id.replace(/:/g, '-')}`">
            <component :is="widget.component" :widget="widget" />
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  </div>
</template>
