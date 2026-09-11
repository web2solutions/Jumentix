<script setup lang="ts">
import { CCard, CCardBody } from '@coreui/vue';

import XCrudChart from '@/components/x-crud/XCrudChart.vue';
import type { useXCrud } from '@/components/x-crud/useXCrud';

/**
 * XCrudPanels (JUM-772): aggregate cards + one aggregate chart, computed from
 * the config's `aggregates` (enum facet counts and numeric sum/avg/min/max).
 */
defineProps<{ crud: ReturnType<typeof useXCrud> }>();

const formatValue = (value: number): string => (
  Number.isInteger(value) ? String(value) : value.toFixed(2)
);
</script>

<template>
  <div class="row g-3 xcrud-panels">
    <div v-for="aggregate in crud.config.aggregates ?? []" :key="aggregate.field + aggregate.op" class="col-auto">
      <CCard class="text-center">
        <CCardBody>
          <div class="fs-4 fw-semibold">{{ formatValue(crud.aggregateValue(aggregate)) }}</div>
          <div class="text-body-secondary small">
            {{ aggregate.label ?? `${aggregate.op} ${aggregate.field}` }}
          </div>
        </CCardBody>
      </CCard>
    </div>
    <div
      v-for="aggregate in (crud.config.aggregates ?? []).filter((a) => a.groupBy)"
      :key="`chart-${aggregate.field}`"
      class="col-12 col-md-6"
    >
      <CCard>
        <CCardBody>
          <XCrudChart
            :title="aggregate.label ?? `${aggregate.field} by ${aggregate.groupBy}`"
            :breakdown="crud.aggregateBreakdown(aggregate)"
          />
        </CCardBody>
      </CCard>
    </div>
  </div>
</template>
