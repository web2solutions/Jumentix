<script setup lang="ts">
import { computed } from 'vue';

import XCrudChart from '@/components/x-crud/XCrudChart.vue';
import type { useXCrud } from '@/components/x-crud/useXCrud';

/**
 * XCrudPanels (JUM-772 redesign): aggregate widgets in the CWidgetStatsA
 * style (colored background, big value, small label) + one chart card per
 * groupBy aggregate. Only real data from the loaded list.
 */
const props = defineProps<{ crud: ReturnType<typeof useXCrud> }>();

const WIDGET_COLORS = ['primary', 'info', 'warning', 'danger', 'success'];

const widgets = computed(() => (props.crud.config.aggregates ?? []).map((aggregate, index) => ({
  aggregate,
  color: WIDGET_COLORS[index % WIDGET_COLORS.length],
  value: props.crud.aggregateValue(aggregate)
})));

const formatValue = (value: number): string => (
  Number.isInteger(value) ? String(value) : value.toFixed(2)
);
</script>

<template>
  <div class="row g-3 mb-3 xcrud-panels">
    <div v-for="widget in widgets" :key="widget.aggregate.field + widget.aggregate.op" class="col-6 col-md-3">
      <div class="card text-white border-0 shadow-sm" :class="`bg-${widget.color}`">
        <div class="card-body pb-2">
          <div class="fs-3 fw-semibold">{{ formatValue(widget.value) }}</div>
          <div class="small text-white-50">
            {{ widget.aggregate.label ?? `${widget.aggregate.op} ${widget.aggregate.field}` }}
          </div>
        </div>
      </div>
    </div>
    <div
      v-for="aggregate in (crud.config.aggregates ?? []).filter((a) => a.groupBy)"
      :key="`chart-${aggregate.field}`"
      class="col-12 col-md-6"
    >
      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <XCrudChart
            :title="aggregate.label ?? `${aggregate.field} by ${aggregate.groupBy}`"
            :breakdown="crud.aggregateBreakdown(aggregate)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
