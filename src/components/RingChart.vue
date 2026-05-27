<script setup>
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js'

// 只注册需要的 Chart.js 组件（tree-shaking 优化）
Chart.register(ArcElement, Tooltip, Legend)

const props = defineProps({
  value: { type: Number, default: 0 },
  max: { type: Number, default: 100 },
  label: { type: String, default: '' },
  unit: { type: String, default: '%' },
  color: { type: String, default: '#3b82f6' },
  size: { type: Number, default: 120 },
})

const percent = computed(() => {
  if (props.max === 0) return 0
  return Math.min(Math.round((props.value / props.max) * 100), 100)
})

const colorClass = computed(() => {
  const p = percent.value
  if (p >= 90) return 'text-red-600'
  if (p >= 70) return 'text-amber-600'
  return 'text-green-600'
})

const chartData = computed(() => ({
  datasets: [{
    data: [percent.value, 100 - percent.value],
    backgroundColor: [props.color, 'rgba(229, 231, 235, 0.5)'],
    borderWidth: 0,
    cutout: '78%',
    borderRadius: 6,
  }]
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: { legend: { display: false }, tooltip: { enabled: false } },
  animation: { duration: 800, easing: 'easeOutQuart' },
}
</script>

<template>
  <div class="flex flex-col items-center gap-2">
    <div class="relative" :style="{ width: size + 'px', height: size + 'px' }">
      <Doughnut :data="chartData" :options="chartOptions" />
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <span class="text-xl font-bold" :class="colorClass">{{ value }}<span class="text-xs font-normal text-gray-400">{{ unit }}</span></span>
      </div>
    </div>
    <span class="text-xs text-gray-500 font-medium">{{ label }}</span>
  </div>
</template>
