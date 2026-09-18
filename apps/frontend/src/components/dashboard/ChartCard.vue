<script setup lang="ts">
import { CChart } from '@coreui/vue-chartjs';
import { computed, ref } from 'vue';

import type { MetricsBucket } from '@/contracts/metricsSchema';
import { useI18n } from '@/i18n';

/**
 * ChartCard (JUM-812): Chart.js via the already-vendored CoreUI wrapper.
 * Labels on the axis carry the series names so colour is never the only
 * encoding. Table fallback is always in the DOM for the screen-reader path.
 */
const props = defineProps<{
  title: string;
  buckets: MetricsBucket[];
  kind?: 'bar' | 'line';
}>();

const { t } = useI18n();
const tableVisible = ref(false);

const PALETTE = ['#4a5cd4', '#39f', '#2eb85c', '#f9b115', '#e55353', '#9da5b1'];

const labels = computed(() => props.buckets.map((bucket) => bucket.key));
const values = computed(() => props.buckets.map((bucket) => bucket.count));
const colors = computed(() => props.buckets.map((_, index) => PALETTE[index % PALETTE.length]));
</script>

<template>
  <div class="chart-card">
    <div class="d-flex justify-content-between align-items-center mb-2 gap-2">
      <div class="text-body-secondary small">{{ title }}</div>
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary"
        :aria-pressed="tableVisible ? 'true' : 'false'"
        :aria-label="t('dashboard.showTable')"
        data-chart-table-toggle
        @click="tableVisible = !tableVisible"
      >
        {{ tableVisible ? t('dashboard.showChart') : t('dashboard.showTable') }}
      </button>
    </div>
    <div v-if="buckets.length && !tableVisible" class="chart-card-canvas" aria-hidden="true">
      <CChart
        :type="kind === 'line' ? 'line' : 'bar'"
        :data="{
          labels,
          datasets: [{
            label: title,
            data: values,
            backgroundColor: colors,
            borderColor: colors
          }]
        }"
        :options="{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { autoSkip: false } },
            y: { beginAtZero: true, ticks: { precision: 0 } }
          }
        }"
      />
    </div>
    <p v-else-if="!buckets.length" class="text-body-secondary small mb-0">{{ t('app.noData') }}</p>
    <table
      class="table table-sm mb-0"
      :class="{ 'visually-hidden': buckets.length > 0 && !tableVisible }"
      data-chart-table
    >
      <caption class="visually-hidden">{{ title }}</caption>
      <thead>
        <tr>
          <th scope="col">{{ t('dashboard.bucket') }}</th>
          <th scope="col">{{ t('dashboard.count') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="bucket in buckets" :key="bucket.key">
          <td>{{ bucket.key }}</td>
          <td>{{ bucket.count }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.chart-card-canvas {
  position: relative;
  height: 180px;
  min-height: 180px;
  width: 100%;
}
</style>
