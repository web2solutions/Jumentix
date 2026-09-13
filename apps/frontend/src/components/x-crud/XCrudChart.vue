<script setup lang="ts">
import { CChart } from '@coreui/vue-chartjs';

import { t } from '@/i18n';

/**
 * XCrudChart (JUM-772): aggregate bar chart (per enum facet or numeric
 * groupBy) using @coreui/vue-chartjs — a dependency the app already has.
 * The canvas gets an explicit height (JUM-781): Chart.js with
 * `maintainAspectRatio: false` inside a flex card rendered 0 px tall on
 * narrow viewports.
 */
defineProps<{
  title: string;
  breakdown: Array<{ label: string; value: number }>;
}>();
</script>

<template>
  <div class="xcrud-chart">
    <div class="text-body-secondary small mb-2">{{ title }}</div>
    <div v-if="breakdown.length" class="xcrud-chart-canvas">
      <CChart
        type="bar"
        :data="{
          labels: breakdown.map((b) => b.label),
          datasets: [{ label: title, data: breakdown.map((b) => b.value), backgroundColor: '#4a5cd4' }]
        }"
        :options="{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }"
      />
    </div>
    <div v-else class="text-body-secondary small">{{ t('app.noData') }}</div>
  </div>
</template>

<style scoped>
.xcrud-chart-canvas {
  position: relative;
  height: 180px;
  min-height: 180px;
  width: 100%;
}
</style>
