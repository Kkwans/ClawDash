<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { healthCheck, getProcessStatus, controlProcess, getProviders, getChannels, getDefaults } from '../api'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

const status = ref({ cpu: 0, cpuPercent: 0, memoryRss: 0, memoryVms: 0, uptimeSeconds: 0, state: 'checking' })
const gateway = ref({ status: 'checking', version: '2026.5.18', uptime: '' })
const providers = ref([])
const channels = ref([])
const defaults = ref({})
const error = ref('')
const controlling = ref(false)

// CPU/内存历史数据
const cpuHistory = ref([])
const memHistory = ref([])
const MAX_HISTORY = 120

let cpuChart = null
let memChart = null

function initCharts() {
  const cpuCtx = document.getElementById('cpuChart')
  const memCtx = document.getElementById('memChart')
  if (!cpuCtx || !memCtx) return

  cpuChart = new Chart(cpuCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'CPU %',
        data: [],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: { min: 0, max: 100, ticks: { callback: v => v + '%' } }
      }
    }
  })

  memChart = new Chart(memCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: '内存 %',
        data: [],
        borderColor: '#a855f7',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: { min: 0, max: 100, ticks: { callback: v => v + '%' } }
      }
    }
  })
}

function updateCharts() {
  if (cpuChart) {
    cpuChart.data.labels = cpuHistory.value.map(h => h.time)
    cpuChart.data.datasets[0].data = cpuHistory.value.map(h => h.value)
    cpuChart.update('none')
  }
  if (memChart) {
    memChart.data.labels = memHistory.value.map(h => h.time)
    memChart.data.datasets[0].data = memHistory.value.map(h => h.value)
    memChart.update('none')
  }
}

async function fetchHealth() {
  try {
    const d = await healthCheck()
    gateway.value.status = d.ok ? 'running' : 'error'
  } catch { gateway.value.status = 'error' }
}

async function fetchProcessStatus() {
  try {
    const d = await getProcessStatus()
    status.value = d
    const now = new Date()
    const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    cpuHistory.value.push({ time: timeStr, value: d.cpuPercent || 0 })
    if (cpuHistory.value.length > MAX_HISTORY) cpuHistory.value.shift()
    const memPercent = d.memoryRss ? (d.memoryRss / (d.memoryVms || 1)) * 100 : 0
    memHistory.value.push({ time: timeStr, value: memPercent })
    if (memHistory.value.length > MAX_HISTORY) memHistory.value.shift()
    updateCharts()
  } catch (e) { error.value = e.message }
}

async function fetchProviders() {
  try {
    const d = await getProviders()
    providers.value = Object.entries(d).map(([id, p]) => ({ id, ...p }))
  } catch {}
}

async function fetchChannels() {
  try {
    const d = await getChannels()
    channels.value = Object.entries(d).map(([id, ch]) => ({ id, ...ch }))
  } catch {}
}

async function fetchDefaults() {
  try {
    defaults.value = await getDefaults()
  } catch {}
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatUptime(seconds) {
  if (!seconds) return '-'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}天 ${h}小时`
  if (h > 0) return `${h}小时 ${m}分钟`
  return `${m}分钟`
}

async function doControl(action) {
  if (controlling.value) return
  if (!confirm(`确定要${action === 'restart' ? '重启' : action === 'stop' ? '停止' : '启动'} OpenClaw 吗？`)) return
  controlling.value = true
  try {
    await controlProcess(action)
    setTimeout(() => {
      fetchProcessStatus()
      fetchHealth()
      controlling.value = false
    }, 2000)
  } catch (e) {
    alert('操作失败: ' + e.message)
    controlling.value = false
  }
}

const channelIcons = { feishu: '🐦', qqbot: '🐧', telegram: '✈️', discord: '🎮' }
const totalModels = () => providers.value.reduce((s, p) => s + (p.models?.length || 0), 0)
const defaultModel = () => defaults.value?.model?.default || defaults.value?.defaultModel || '-'
const fallbackModel = () => defaults.value?.model?.fallback || defaults.value?.fallbackModel || '-'
const defaultThinking = () => defaults.value?.thinking?.level || defaults.value?.thinkingLevel || '-'

let timer
onMounted(async () => {
  fetchHealth()
  fetchProcessStatus()
  fetchProviders()
  fetchChannels()
  fetchDefaults()
  await nextTick()
  initCharts()
  timer = setInterval(() => {
    fetchHealth()
    fetchProcessStatus()
  }, 5000)
})
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <div class="space-y-6">
    <!-- 未认证提示 -->
    <div v-if="error === 'unauthorized'" class="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
      <p class="text-sm text-yellow-800">⚠️ 需要输入 Gateway Token 才能访问 API。请在<a href="#" @click.prevent="$root.currentTab='settings'" class="text-blue-600 underline">系统设置</a>中配置。</p>
    </div>

    <!-- 状态横幅 -->
    <div class="relative overflow-hidden rounded-2xl p-6 md:p-8 transition-all duration-500"
      :class="gateway.status === 'running'
        ? 'bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 shadow-lg shadow-green-200'
        : gateway.status === 'error'
          ? 'bg-gradient-to-br from-red-500 via-rose-500 to-red-600 shadow-lg shadow-red-200'
          : 'bg-gradient-to-br from-gray-400 via-slate-400 to-gray-500 shadow-lg shadow-gray-200'">
      <!-- 装饰性背景元素 -->
      <div class="absolute top-0 right-0 w-40 h-40 rounded-full opacity-10 -translate-y-1/2 translate-x-1/2"
        :class="gateway.status === 'running' ? 'bg-white' : 'bg-white'"></div>
      <div class="absolute bottom-0 left-1/3 w-24 h-24 rounded-full opacity-5 translate-y-1/2"
        :class="gateway.status === 'running' ? 'bg-white' : 'bg-white'"></div>

      <div class="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div class="flex items-center gap-4">
          <!-- 状态指示灯（带脉冲动画） -->
          <div class="relative">
            <div class="w-4 h-4 rounded-full"
              :class="gateway.status === 'running' ? 'bg-white' : gateway.status === 'error' ? 'bg-white/80' : 'bg-white/60'"></div>
            <div v-if="gateway.status === 'running'" class="absolute inset-0 w-4 h-4 rounded-full bg-white animate-ping opacity-40"></div>
          </div>
          <div>
            <h3 class="text-xl md:text-2xl font-bold text-white">
              {{ gateway.status === 'running' ? 'OpenClaw 运行正常' : gateway.status === 'error' ? 'OpenClaw 连接异常' : '正在检测...' }}
            </h3>
            <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-white/80">
              <span class="flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/></svg>
                v{{ gateway.version }}
              </span>
              <span class="flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                {{ formatUptime(status.uptimeSeconds) }}
              </span>
              <span class="flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
                PID {{ status.pid || '-' }}
              </span>
            </div>
          </div>
        </div>
        <!-- 右侧操作区 -->
        <div class="flex items-center gap-3">
          <button @click="doControl('stop')" :disabled="controlling || gateway.status !== 'running'"
            class="px-4 py-2 rounded-xl text-sm font-medium bg-white/15 backdrop-blur-sm text-white hover:bg-white/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
            {{ controlling ? '⏳' : '⏹️' }} 停止
          </button>
          <button @click="doControl('restart')" :disabled="controlling"
            class="px-4 py-2 rounded-xl text-sm font-medium bg-white/15 backdrop-blur-sm text-white hover:bg-white/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
            {{ controlling ? '⏳' : '🔄' }} 重启
          </button>
          <button @click="doControl('start')" :disabled="controlling || gateway.status === 'running'"
            class="px-4 py-2 rounded-xl text-sm font-medium bg-white/15 backdrop-blur-sm text-white hover:bg-white/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
            {{ controlling ? '⏳' : '▶️' }} 启动
          </button>
          <div class="hidden md:flex items-center justify-center w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-sm ml-1">
            <span class="text-3xl">{{ gateway.status === 'running' ? '🦞' : gateway.status === 'error' ? '⚠️' : '⏳' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 资源卡片 -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      <!-- CPU -->
      <div class="group relative bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 hover:shadow-md transition-all duration-300 overflow-hidden">
        <div class="absolute top-0 right-0 w-20 h-20 rounded-full bg-blue-50 -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform"></div>
        <div class="relative">
          <div class="flex items-center justify-between mb-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-lg shadow-sm shadow-blue-200">💻</div>
            <span class="text-xs font-medium px-2 py-0.5 rounded-full"
              :class="(status.cpuPercent || 0) > 80 ? 'bg-red-50 text-red-600' : (status.cpuPercent || 0) > 60 ? 'bg-yellow-50 text-yellow-600' : 'bg-blue-50 text-blue-600'">
              {{ (status.cpuPercent || 0) > 80 ? '高' : (status.cpuPercent || 0) > 60 ? '中' : '正常' }}
            </span>
          </div>
          <p class="text-xs text-gray-400 mb-0.5">CPU 使用率</p>
          <p class="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">{{ (status.cpuPercent || 0).toFixed(1) }}<span class="text-sm font-normal text-gray-400">%</span></p>
          <div class="w-full bg-gray-100 rounded-full h-2 mt-3">
            <div class="h-2 rounded-full transition-all duration-700 ease-out"
              :class="(status.cpuPercent || 0) > 80 ? 'bg-gradient-to-r from-red-400 to-red-500' : (status.cpuPercent || 0) > 60 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' : 'bg-gradient-to-r from-blue-400 to-blue-500'"
              :style="{ width: Math.min(status.cpuPercent || 0, 100) + '%' }"></div>
          </div>
        </div>
      </div>

      <!-- 内存 -->
      <div class="group relative bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 hover:shadow-md transition-all duration-300 overflow-hidden">
        <div class="absolute top-0 right-0 w-20 h-20 rounded-full bg-purple-50 -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform"></div>
        <div class="relative">
          <div class="flex items-center justify-between mb-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white text-lg shadow-sm shadow-purple-200">🧠</div>
            <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">RSS</span>
          </div>
          <p class="text-xs text-gray-400 mb-0.5">内存使用</p>
          <p class="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">{{ formatBytes(status.memoryRss) }}</p>
          <p class="text-xs text-gray-400 mt-2">虚拟: {{ formatBytes(status.memoryVms) }}</p>
        </div>
      </div>

      <!-- 模型 -->
      <div class="group relative bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 hover:shadow-md transition-all duration-300 overflow-hidden">
        <div class="absolute top-0 right-0 w-20 h-20 rounded-full bg-emerald-50 -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform"></div>
        <div class="relative">
          <div class="flex items-center justify-between mb-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white text-lg shadow-sm shadow-green-200">🤖</div>
            <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-600">{{ providers.length }} 个</span>
          </div>
          <p class="text-xs text-gray-400 mb-0.5">模型提供商</p>
          <p class="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">{{ totalModels() }}</p>
          <p class="text-xs text-gray-400 mt-2">个可用模型</p>
        </div>
      </div>

      <!-- 渠道 -->
      <div class="group relative bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 hover:shadow-md transition-all duration-300 overflow-hidden">
        <div class="absolute top-0 right-0 w-20 h-20 rounded-full bg-orange-50 -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform"></div>
        <div class="relative">
          <div class="flex items-center justify-between mb-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white text-lg shadow-sm shadow-orange-200">📡</div>
            <span class="text-xs font-medium px-2 py-0.5 rounded-full"
              :class="channels.filter(ch => ch.enabled !== false).length > 0 ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'">
              {{ channels.filter(ch => ch.enabled !== false).length }} 启用
            </span>
          </div>
          <p class="text-xs text-gray-400 mb-0.5">消息渠道</p>
          <p class="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">{{ channels.length }}</p>
          <p class="text-xs text-gray-400 mt-2">个已配置渠道</p>
        </div>
      </div>
    </div>

    <!-- 模型与渠道统计 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- 当前模型 -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-sm">🤖</div>
          <h4 class="text-sm font-semibold text-gray-700">当前模型配置</h4>
        </div>
        <div class="space-y-3">
          <div class="flex items-center justify-between p-3 rounded-xl bg-gray-50">
            <span class="text-xs text-gray-500">主模型</span>
            <span class="text-sm font-medium text-gray-800 truncate ml-2 max-w-[60%] text-right">{{ defaultModel() }}</span>
          </div>
          <div class="flex items-center justify-between p-3 rounded-xl bg-gray-50">
            <span class="text-xs text-gray-500">备用模型</span>
            <span class="text-sm font-medium text-gray-800 truncate ml-2 max-w-[60%] text-right">{{ fallbackModel() }}</span>
          </div>
          <div class="flex items-center justify-between p-3 rounded-xl bg-gray-50">
            <span class="text-xs text-gray-500">思考等级</span>
            <span class="text-sm font-medium text-gray-800">{{ defaultThinking() }}</span>
          </div>
        </div>
      </div>

      <!-- 渠道状态 -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white text-sm">📡</div>
          <h4 class="text-sm font-semibold text-gray-700">渠道状态</h4>
        </div>
        <div v-if="channels.length === 0" class="text-center py-6 text-gray-400 text-sm">暂无渠道配置</div>
        <div v-else class="space-y-2">
          <div v-for="ch in channels" :key="ch.id"
            class="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
            <div class="flex items-center gap-3">
              <span class="text-lg">{{ channelIcons[ch.id] || '📡' }}</span>
              <div>
                <p class="text-sm font-medium text-gray-800">{{ ch.id }}</p>
                <p class="text-xs text-gray-400">{{ ch.connectionMode || '-' }}</p>
              </div>
            </div>
            <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
              :class="ch.enabled !== false ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'">
              <span class="w-1.5 h-1.5 rounded-full" :class="ch.enabled !== false ? 'bg-green-500' : 'bg-gray-400'"></span>
              {{ ch.enabled !== false ? '在线' : '离线' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- CPU/内存折线图 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- CPU 折线图 -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h4 class="text-sm font-semibold text-gray-700 mb-4">💻 CPU 使用率趋势</h4>
        <div class="h-40">
          <canvas id="cpuChart"></canvas>
        </div>
        <div class="flex justify-between mt-2 text-xs text-gray-400">
          <span>{{ cpuHistory.length > 0 ? cpuHistory[0].time : '-' }}</span>
          <span>{{ cpuHistory.length }} 个数据点</span>
          <span>{{ cpuHistory.length > 0 ? cpuHistory[cpuHistory.length-1].time : '-' }}</span>
        </div>
      </div>

      <!-- 内存折线图 -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h4 class="text-sm font-semibold text-gray-700 mb-4">🧠 内存使用趋势</h4>
        <div class="h-40">
          <canvas id="memChart"></canvas>
        </div>
        <div class="flex justify-between mt-2 text-xs text-gray-400">
          <span>{{ memHistory.length > 0 ? memHistory[0].time : '-' }}</span>
          <span>{{ memHistory.length }} 个数据点</span>
          <span>{{ memHistory.length > 0 ? memHistory[memHistory.length-1].time : '-' }}</span>
        </div>
      </div>
    </div>

    <!-- 模型列表 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h4 class="text-sm font-semibold text-gray-700 mb-4">已配置模型</h4>
      <div v-if="providers.length === 0" class="text-center py-4 text-gray-400 text-sm">暂无模型配置</div>
      <div v-else class="space-y-3">
        <div v-for="p in providers" :key="p.id" class="flex items-center gap-3 p-3 rounded-lg border border-gray-100">
          <div class="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-sm">🤖</div>
          <div class="flex-1">
            <p class="text-sm font-medium text-gray-800">{{ p.id }}</p>
            <p class="text-xs text-gray-400">{{ p.baseUrl }}</p>
          </div>
          <div class="flex flex-wrap gap-1">
            <span v-for="m in (p.models || [])" :key="m.id"
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700">
              {{ m.name || m.id }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 渠道列表 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h4 class="text-sm font-semibold text-gray-700 mb-4">消息渠道</h4>
      <div v-if="channels.length === 0" class="text-center py-4 text-gray-400 text-sm">暂无渠道配置</div>
      <div v-else class="space-y-3">
        <div v-for="ch in channels" :key="ch.id" class="flex items-center justify-between p-3 rounded-lg border border-gray-100">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-sm">
              {{ channelIcons[ch.id] || '📡' }}
            </div>
            <div>
              <p class="text-sm font-medium text-gray-800">{{ ch.id }}</p>
              <p class="text-xs text-gray-400">{{ ch.connectionMode || '-' }}</p>
            </div>
          </div>
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
            :class="ch.enabled !== false ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'">
            <span class="w-1.5 h-1.5 rounded-full" :class="ch.enabled !== false ? 'bg-green-500' : 'bg-gray-400'"></span>
            {{ ch.enabled !== false ? '已启用' : '已禁用' }}
          </span>
        </div>
      </div>
    </div>

    <!-- 快捷操作 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h4 class="text-sm font-semibold text-gray-700 mb-4">快捷操作</h4>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <a href="/builtin/" target="_blank"
          class="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-all">
          <span class="text-xl">⚡</span>
          <div>
            <p class="text-sm font-medium text-gray-700">高级设置</p>
            <p class="text-xs text-gray-400">内置 Control UI</p>
          </div>
        </a>
        <a href="http://192.168.5.110:3000" target="_blank"
          class="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-all">
          <span class="text-xl">🎬</span>
          <div>
            <p class="text-sm font-medium text-gray-700">影视森林</p>
            <p class="text-xs text-gray-400">:3000</p>
          </div>
        </a>
        <a href="http://192.168.5.110:8888" target="_blank"
          class="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-all">
          <span class="text-xl">📁</span>
          <div>
            <p class="text-sm font-medium text-gray-700">文件管理</p>
            <p class="text-xs text-gray-400">:8888</p>
          </div>
        </a>
        <a href="http://192.168.5.110:9090" target="_blank"
          class="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-all">
          <span class="text-xl">🌐</span>
          <div>
            <p class="text-sm font-medium text-gray-700">代理面板</p>
            <p class="text-xs text-gray-400">:9090</p>
          </div>
        </a>
      </div>
    </div>
  </div>
</template>
