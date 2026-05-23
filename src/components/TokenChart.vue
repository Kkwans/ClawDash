<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { Chart, registerables } from 'chart.js'
import { Bar } from 'vue-chartjs'

Chart.register(...registerables)

const props = defineProps({
  providers: { type: Array, default: () => [] }
})

// 从 provider 配置中提取模型信息
const chartData = computed(() => {
  const labels = []
  const contextData = []
  const maxTokenData = []
  const bgColors = []
  const colors = [
    'rgba(59, 130, 246, 0.8)',   // blue
    'rgba(16, 185, 129, 0.8)',   // green
    'rgba(245, 158, 11, 0.8)',   // amber
    'rgba(139, 92, 246, 0.8)',   // purple
    'rgba(239, 68, 68, 0.8)',    // red
    'rgba(236, 72, 153, 0.8)',   // pink
  ]

  props.providers.forEach((p, pi) => {
    (p.models || []).forEach((m, mi) => {
      labels.push(m.name || m.id)
      contextData.push((m.contextWindow || 0) / 1000) // 转为 K
      maxTokenData.push((m.maxTokens || 0) / 1000)
      bgColors.push(colors[(pi * 3 + mi) % colors.length])
    })
  })

  return {
    labels,
    datasets: [
      {
        label: '上下文窗口 (K tokens)',
        data: contextData,
        backgroundColor: bgColors.map(c => c.replace('0.8', '0.6')),
        borderColor: bgColors,
        borderWidth: 1,
        borderRadius: 6,
      },
      {
        label: '最大输出 (K tokens)',
        data: maxTokenData,
        backgroundColor: bgColors.map(c => c.replace('0.8', '0.3')),
        borderColor: bgColors.map(c => c.replace('0.8', '0.6')),
        borderWidth: 1,
        borderRadius: 6,
      }
    ]
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        padding: 16,
        usePointStyle: true,
        pointStyle: 'rectRounded',
        font: { size: 12 }
      }
    },
    tooltip: {
      callbacks: {
        label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()}K tokens`
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        callback: (v) => v.toLocaleString() + 'K',
        font: { size: 11 }
      },
      grid: { color: 'rgba(0,0,0,0.05)' }
    },
    x: {
      ticks: { font: { size: 11 } },
      grid: { display: false }
    }
  }
}

// 成本信息
const costInfo = computed(() => {
  const items = []
  props.providers.forEach(p => {
    (p.models || []).forEach(m => {
      const cost = m.cost || {}
      items.push({
        name: m.name || m.id,
        provider: p.id,
        input: cost.input || 0,
        output: cost.output || 0,
        cacheRead: cost.cacheRead || 0,
        cacheWrite: cost.cacheWrite || 0,
        contextWindow: m.contextWindow || 0,
        maxTokens: m.maxTokens || 0,
        reasoning: m.reasoning || false
      })
    })
  })
  return items
})

const hasData = computed(() => chartData.value.labels.length > 0)
</script>

<template>
  <div class="space-y-6">
    <!-- Token 容量对比图 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 class="text-base font-semibold text-gray-800 mb-1">📊 模型 Token 容量对比</h3>
      <p class="text-xs text-gray-400 mb-4">各模型的上下文窗口与最大输出 token 数</p>

      <div v-if="!hasData" class="text-center py-8 text-gray-400 text-sm">暂无模型数据</div>
      <div v-else class="h-64">
        <Bar :data="chartData" :options="chartOptions" />
      </div>
    </div>

    <!-- 成本配置表 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 class="text-base font-semibold text-gray-800 mb-1">💰 模型成本配置</h3>
      <p class="text-xs text-gray-400 mb-4">每个模型的 Token 单价（$/1M tokens）</p>

      <div v-if="costInfo.length === 0" class="text-center py-4 text-gray-400 text-sm">暂无数据</div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-100">
              <th class="text-left py-2 px-3 text-xs font-medium text-gray-500">模型</th>
              <th class="text-left py-2 px-3 text-xs font-medium text-gray-500">提供商</th>
              <th class="text-right py-2 px-3 text-xs font-medium text-gray-500">上下文</th>
              <th class="text-right py-2 px-3 text-xs font-medium text-gray-500">最大输出</th>
              <th class="text-right py-2 px-3 text-xs font-medium text-gray-500">输入单价</th>
              <th class="text-right py-2 px-3 text-xs font-medium text-gray-500">输出单价</th>
              <th class="text-center py-2 px-3 text-xs font-medium text-gray-500">推理</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in costInfo" :key="m.name" class="border-b border-gray-50 hover:bg-gray-50">
              <td class="py-2.5 px-3 font-medium text-gray-800">{{ m.name }}</td>
              <td class="py-2.5 px-3 text-gray-500">{{ m.provider }}</td>
              <td class="py-2.5 px-3 text-right text-gray-600">{{ (m.contextWindow / 1000).toFixed(0) }}K</td>
              <td class="py-2.5 px-3 text-right text-gray-600">{{ (m.maxTokens / 1000).toFixed(0) }}K</td>
              <td class="py-2.5 px-3 text-right text-gray-600">${{ m.input.toFixed(2) }}</td>
              <td class="py-2.5 px-3 text-right text-gray-600">${{ m.output.toFixed(2) }}</td>
              <td class="py-2.5 px-3 text-center">
                <span v-if="m.reasoning" class="px-2 py-0.5 rounded text-xs bg-purple-50 text-purple-700">✓</span>
                <span v-else class="text-gray-300">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 模型能力概览 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 class="text-base font-semibold text-gray-800 mb-4">🔧 模型能力概览</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="m in costInfo" :key="m.name"
          class="p-4 rounded-xl border border-gray-200 hover:border-blue-300 transition-all">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-sm">🤖</div>
            <div>
              <p class="text-sm font-semibold text-gray-800">{{ m.name }}</p>
              <p class="text-xs text-gray-400">{{ m.provider }}</p>
            </div>
          </div>
          <div class="space-y-2">
            <div class="flex justify-between text-xs">
              <span class="text-gray-500">上下文窗口</span>
              <span class="font-medium text-gray-700">{{ (m.contextWindow / 1000).toFixed(0) }}K</span>
            </div>
            <div class="w-full bg-gray-100 rounded-full h-1.5">
              <div class="bg-blue-500 h-1.5 rounded-full"
                :style="{ width: Math.min((m.contextWindow / 1000000) * 100, 100) + '%' }"></div>
            </div>
            <div class="flex justify-between text-xs">
              <span class="text-gray-500">最大输出</span>
              <span class="font-medium text-gray-700">{{ (m.maxTokens / 1000).toFixed(0) }}K</span>
            </div>
            <div class="w-full bg-gray-100 rounded-full h-1.5">
              <div class="bg-green-500 h-1.5 rounded-full"
                :style="{ width: Math.min((m.maxTokens / 128000) * 100, 100) + '%' }"></div>
            </div>
            <div class="flex gap-1.5 mt-2">
              <span v-if="m.reasoning" class="px-2 py-0.5 rounded text-xs bg-purple-50 text-purple-700">推理</span>
              <span class="px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700">文本</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
