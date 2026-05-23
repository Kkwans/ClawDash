<script setup>
import { ref, computed } from 'vue'
import { Chart, registerables } from 'chart.js'
import { Bar, Doughnut } from 'vue-chartjs'

Chart.register(...registerables)

const props = defineProps({
  providers: { type: Array, default: () => [] }
})

const activeTab = ref('capacity')

const tabs = [
  { key: 'capacity', label: '容量对比', icon: '📊' },
  { key: 'cost', label: '成本分析', icon: '💰' },
  { key: 'overview', label: '能力概览', icon: '🔧' },
]

// 容量对比数据
const capacityData = computed(() => {
  const labels = []
  const contextData = []
  const maxTokenData = []
  const colors = [
    'rgba(59, 130, 246, 0.8)',
    'rgba(16, 185, 129, 0.8)',
    'rgba(245, 158, 11, 0.8)',
    'rgba(139, 92, 246, 0.8)',
    'rgba(239, 68, 68, 0.8)',
    'rgba(236, 72, 153, 0.8)',
  ]
  const bgColors = []

  props.providers.forEach((p, pi) => {
    (p.models || []).forEach((m, mi) => {
      labels.push(m.name || m.id)
      contextData.push((m.contextWindow || 0) / 1000)
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
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: '最大输出 (K tokens)',
        data: maxTokenData,
        backgroundColor: 'rgba(16, 185, 129, 0.7)',
        borderColor: 'rgba(16, 185, 129, 1)',
        borderWidth: 1,
        borderRadius: 4,
      }
    ]
  }
})

const capacityOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: { padding: 16, usePointStyle: true, pointStyle: 'rectRounded', font: { size: 12 } }
    },
    tooltip: {
      callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()}K tokens` }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: { callback: (v) => v.toLocaleString() + 'K', font: { size: 11 } },
      grid: { color: 'rgba(0,0,0,0.05)' }
    },
    x: {
      ticks: { font: { size: 11 }, maxRotation: 45 },
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
        reasoning: m.reasoning || false,
        vision: m.vision || false,
      })
    })
  })
  return items
})

// 成本图表数据
const costChartData = computed(() => {
  const items = costInfo.value.filter(m => m.input > 0 || m.output > 0)
  if (items.length === 0) return null
  return {
    labels: items.map(m => m.name),
    datasets: [
      {
        label: '输入 ($/1M)',
        data: items.map(m => m.input),
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
        borderRadius: 4,
      },
      {
        label: '输出 ($/1M)',
        data: items.map(m => m.output),
        backgroundColor: 'rgba(245, 158, 11, 0.7)',
        borderRadius: 4,
      }
    ]
  }
})

const costChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: { padding: 16, usePointStyle: true, pointStyle: 'rectRounded', font: { size: 12 } }
    },
    tooltip: {
      callbacks: { label: (ctx) => `${ctx.dataset.label}: $${ctx.parsed.y.toFixed(2)}` }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: { callback: (v) => '$' + v.toFixed(2), font: { size: 11 } },
      grid: { color: 'rgba(0,0,0,0.05)' }
    },
    x: {
      ticks: { font: { size: 11 }, maxRotation: 45 },
      grid: { display: false }
    }
  }
}

// 统计汇总
const summary = computed(() => {
  let totalModels = 0
  let reasoningCount = 0
  let visionCount = 0
  const providerSet = new Set()
  props.providers.forEach(p => {
    providerSet.add(p.id)
    (p.models || []).forEach(m => {
      totalModels++
      if (m.reasoning) reasoningCount++
      if (m.vision) visionCount++
    })
  })
  return { providers: providerSet.size, models: totalModels, reasoning: reasoningCount, vision: visionCount }
})

const hasData = computed(() => capacityData.value.labels.length > 0)
</script>

<template>
  <div class="space-y-6">
    <!-- 统计概览卡片 -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="bg-white rounded-xl border border-gray-200 p-4 text-center">
        <p class="text-2xl font-bold text-blue-600">{{ summary.providers }}</p>
        <p class="text-xs text-gray-500 mt-1">提供商</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4 text-center">
        <p class="text-2xl font-bold text-emerald-600">{{ summary.models }}</p>
        <p class="text-xs text-gray-500 mt-1">模型总数</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4 text-center">
        <p class="text-2xl font-bold text-purple-600">{{ summary.reasoning }}</p>
        <p class="text-xs text-gray-500 mt-1">支持推理</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4 text-center">
        <p class="text-2xl font-bold text-amber-600">{{ summary.vision }}</p>
        <p class="text-xs text-gray-500 mt-1">支持视觉</p>
      </div>
    </div>

    <!-- 图表区域 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <!-- Tab 切换 -->
      <div class="flex items-center gap-1 mb-5 bg-gray-100 rounded-lg p-1 w-fit">
        <button v-for="tab in tabs" :key="tab.key"
          @click="activeTab = tab.key"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
          :class="activeTab === tab.key
            ? 'bg-white text-gray-800 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'">
          <span>{{ tab.icon }}</span>
          <span>{{ tab.label }}</span>
        </button>
      </div>

      <!-- 容量对比 -->
      <div v-if="activeTab === 'capacity'">
        <h3 class="text-base font-semibold text-gray-800 mb-1">Token 容量对比</h3>
        <p class="text-xs text-gray-400 mb-4">各模型的上下文窗口与最大输出 token 数</p>
        <div v-if="!hasData" class="text-center py-8 text-gray-400 text-sm">暂无模型数据</div>
        <div v-else class="h-72">
          <Bar :data="capacityData" :options="capacityOptions" />
        </div>
      </div>

      <!-- 成本分析 -->
      <div v-if="activeTab === 'cost'">
        <h3 class="text-base font-semibold text-gray-800 mb-1">成本分析</h3>
        <p class="text-xs text-gray-400 mb-4">每个模型的 Token 单价（$/1M tokens）</p>
        <div v-if="!costChartData" class="text-center py-8 text-gray-400 text-sm">暂无成本数据</div>
        <div v-else>
          <div class="h-72 mb-6">
            <Bar :data="costChartData" :options="costChartOptions" />
          </div>
          <!-- 成本明细表 -->
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-gray-200">
                  <th class="text-left py-2 px-3 text-xs font-medium text-gray-500">模型</th>
                  <th class="text-left py-2 px-3 text-xs font-medium text-gray-500">提供商</th>
                  <th class="text-right py-2 px-3 text-xs font-medium text-gray-500">输入</th>
                  <th class="text-right py-2 px-3 text-xs font-medium text-gray-500">输出</th>
                  <th class="text-right py-2 px-3 text-xs font-medium text-gray-500">缓存读</th>
                  <th class="text-center py-2 px-3 text-xs font-medium text-gray-500">能力</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in costInfo" :key="m.name" class="border-b border-gray-50 hover:bg-gray-50">
                  <td class="py-2.5 px-3 font-medium text-gray-800">{{ m.name }}</td>
                  <td class="py-2.5 px-3 text-gray-500">{{ m.provider }}</td>
                  <td class="py-2.5 px-3 text-right text-gray-600">${{ m.input.toFixed(2) }}</td>
                  <td class="py-2.5 px-3 text-right text-gray-600">${{ m.output.toFixed(2) }}</td>
                  <td class="py-2.5 px-3 text-right text-gray-600">${{ m.cacheRead.toFixed(2) }}</td>
                  <td class="py-2.5 px-3 text-center">
                    <div class="flex items-center justify-center gap-1">
                      <span v-if="m.reasoning" class="px-1.5 py-0.5 rounded text-xs bg-purple-50 text-purple-700">推理</span>
                      <span v-if="m.vision" class="px-1.5 py-0.5 rounded text-xs bg-emerald-50 text-emerald-700">视觉</span>
                      <span v-if="!m.reasoning && !m.vision" class="text-gray-300">—</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 能力概览 -->
      <div v-if="activeTab === 'overview'">
        <h3 class="text-base font-semibold text-gray-800 mb-1">模型能力概览</h3>
        <p class="text-xs text-gray-400 mb-4">各模型的详细能力与参数</p>
        <div v-if="costInfo.length === 0" class="text-center py-8 text-gray-400 text-sm">暂无数据</div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                <div class="bg-blue-500 h-1.5 rounded-full transition-all"
                  :style="{ width: Math.min((m.contextWindow / 1000000) * 100, 100) + '%' }"></div>
              </div>
              <div class="flex justify-between text-xs">
                <span class="text-gray-500">最大输出</span>
                <span class="font-medium text-gray-700">{{ (m.maxTokens / 1000).toFixed(0) }}K</span>
              </div>
              <div class="w-full bg-gray-100 rounded-full h-1.5">
                <div class="bg-emerald-500 h-1.5 rounded-full transition-all"
                  :style="{ width: Math.min((m.maxTokens / 128000) * 100, 100) + '%' }"></div>
              </div>
              <div class="flex gap-1.5 mt-2">
                <span class="px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700">文本</span>
                <span v-if="m.vision" class="px-2 py-0.5 rounded text-xs bg-emerald-50 text-emerald-700">视觉</span>
                <span v-if="m.reasoning" class="px-2 py-0.5 rounded text-xs bg-purple-50 text-purple-700">推理</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
