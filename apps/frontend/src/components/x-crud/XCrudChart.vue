<script setup lang="ts">
import { CChart } from '@coreui/vue-chartjs';

/**
 * XCrudChart (JUM-772): aggregate bar chart (per enum facet or numeric
 * groupBy) using @coreui/vue-chartjs — a dependency the app already has.
 */
defineProps<{
  title: string;
  breakdown: Array<{ label: string; value: number }>;
}>();
</script>

<template>
  <div class="xcrud-chart">
    <div class="text-body-secondary small mb-2">{{ title }}</div>
    <CChart
      v-if="breakdown.length"
      type="bar"
      :data="{
        labels: breakdown.map((b) => b.label),
        datasets: [{ label: title, data: breakdown.map((b) => b.value), backgroundColor: '#4a5cd4' }]
      }"
      :options="{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }"
    />
    <div v-else class="text-body-secondary small">Sem dados.</div>
  </div>
</template>
