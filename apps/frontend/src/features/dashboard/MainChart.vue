<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { CChart } from '@coreui/vue-chartjs'
import { getStyle } from '@coreui/utils'

const random = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min)

interface ChartComponentRef {
  chart: {
    update: () => void
    options: {
      scales: {
        x: { grid: { borderColor?: string; color?: string }; ticks: { color?: string } }
        y: { grid: { borderColor?: string; color?: string }; ticks: { color?: string } }
      }
    }
  }
}

const mainChartRef = ref<ChartComponentRef>()

const data = {
  labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
  datasets: [
    {
      label: 'My First dataset',
      backgroundColor: `rgba(${getStyle('--cui-info-rgb')}, .1)`,
      borderColor: getStyle('--cui-info'),
      pointHoverBackgroundColor: getStyle('--cui-info'),
      borderWidth: 2,
      data: Array.from({ length: 7 }, () => random(50, 200)),
      fill: true,
    },
    {
      label: 'My Second dataset',
      backgroundColor: 'transparent',
      borderColor: getStyle('--cui-success'),
      pointHoverBackgroundColor: getStyle('--cui-success'),
      borderWidth: 2,
      data: Array.from({ length: 7 }, () => random(50, 200)),
    },
    {
      label: 'My Third dataset',
      backgroundColor: 'transparent',
      borderColor: getStyle('--cui-danger'),
      pointHoverBackgroundColor: getStyle('--cui-danger'),
      borderWidth: 1,
      borderDash: [8, 5],
      data: [65, 65, 65, 65, 65, 65, 65],
    },
  ],
}

const options = {
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: {
      grid: { color: getStyle('--cui-border-color-translucent'), drawOnChartArea: false },
      ticks: { color: getStyle('--cui-body-color') },
    },
    y: {
      beginAtZero: true,
      border: { color: getStyle('--cui-border-color-translucent') },
      grid: { color: getStyle('--cui-border-color-translucent') },
      max: 250,
      ticks: { color: getStyle('--cui-body-color'), maxTicksLimit: 5, stepSize: 50 },
    },
  },
  elements: {
    line: { tension: 0.4 },
    point: { radius: 0, hitRadius: 10, hoverRadius: 4, hoverBorderWidth: 3 },
  },
}

const syncChartColors = () => {
  const chart = mainChartRef.value?.chart
  if (!chart) {
    return
  }
  const gridColor = getStyle('--cui-border-color-translucent')
  const tickColor = getStyle('--cui-body-color')
  chart.options.scales.x.grid.borderColor = gridColor
  chart.options.scales.x.grid.color = gridColor
  chart.options.scales.x.ticks.color = tickColor
  chart.options.scales.y.grid.borderColor = gridColor
  chart.options.scales.y.grid.color = gridColor
  chart.options.scales.y.ticks.color = tickColor
  chart.update()
}

onMounted(() => {
  document.documentElement.addEventListener('ColorSchemeChange', syncChartColors)
})

onUnmounted(() => {
  document.documentElement.removeEventListener('ColorSchemeChange', syncChartColors)
})
</script>

<template>
  <CChart type="line" :data="data" :options="options" ref="mainChartRef" />
</template>
