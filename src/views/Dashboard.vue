<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { authenticated, connecting, connectionError, statusText, statusColor, connect, disconnect, gwRequest, useGatewayEvent } from '../stores/gateway.js'
import RingChart from '../components/RingChart.vue'
import AppToast from '../components/AppToast.vue'
import AppConfirm from '../components/AppConfirm.vue'
import { Doughnut } from 'vue-chartjs'

const gatewayInfo = ref(null)
const healthData = ref(null)
const sessions = ref([])
const modelsInfo = ref(null)
const channelsInfo = ref(null)
const defaultModelProvider = ref('')
const defaultModelName = ref('')
const configData = ref(null)
const error = ref('')
const loading = ref(false)
const lastUpdate = ref(null)

useGatewayEvent('connected', (payload) => {
  gatewayInfo.value = payload
  loadAllData()
})

useGatewayEvent('auth-error', (payload) => {
  error.value = `认证失败: ${payload?.message || '请检查 Token'}`
})

async function loadAllData(silent = false) {
  if (!silent) loading.value = true
  error.value = ''
  try {
    const [health, sess, models, channels, config] = await Promise.allSettled([
      gwRequest('health'),
      gwRequest('sessions.list', { limit: 50 }),
      gwRequest('models.list'),
      gwRequest('channels.status'),
      gwRequest('config.get')
    ])
    if (health.status === 'fulfilled') healthData.value = health.value
    if (sess.status === 'fulfilled') {
      const d = sess.value
      sessions.value = d?.sessions || []
      if (d?.defaults) {
        defaultModelProvider.value = d.defaults.modelProvider || ''
        defaultModelName.value = d.defaults.model || ''
      }
    }
    if (models.status === 'fulfilled') modelsInfo.value = models.value
    if (channels.status === 'fulfilled') channelsInfo.value = channels.value
    if (config.status === 'fulfilled') configData.value = config.value
    lastUpdate.value = new Date()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

const controlling = ref(false)
const toastRef = ref(null)
const confirmRef = ref(null)

function showToast(msg) {
  toastRef.value?.show(msg)
}

async function showConfirm(msg) {
  return confirmRef.value?.confirm(msg) || false
}

async function doGatewayAction(action) {
  if (controlling.value) return
  const ok = await showConfirm(`确定要${action === 'stop' ? '停止' : '启动'} Gateway 吗？`)
  if (!ok) return
  controlling.value = true
  try {
    await gwRequest(`gateway.${action}`)
    showToast(`Gateway ${action === 'stop' ? '已停止' : '已启动'}`)
    setTimeout(() => { loadAllData(); controlling.value = false }, 2000)
  } catch (e) {
    showToast('操作失败: ' + e.message)
    controlling.value = false
  }
}

function formatUptime(ms) {
  if (!ms) return '-'
  const sec = Math.floor(ms / 1000)
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (d > 0) return `${d}天 ${h}小时`
  if (h > 0) return `${h}小时 ${m}分钟`
  return `${m}分钟`
}

const channelCount = computed(() => Object.keys(channelsInfo.value?.channels || {}).length)
const modelCount = computed(() => modelsInfo.value?.models?.length || 0)
const eventLoop = computed(() => channelsInfo.value?.eventLoop || null)
const eventLoopUtil = computed(() => Math.round((eventLoop.value?.utilization || 0) * 100))
const sessionCount = computed(() => sessions.value.length)
const eventLoopColor = computed(() => {
  const u = eventLoopUtil.value
  if (u >= 90) return '#ef4444'
  if (u >= 70) return '#f59e0b'
  return '#10b981'
})

// 会话分布
const sessionKinds = computed(() => {
  const map = {}
  sessions.value.forEach(s => {
    const k = s.kind || 'unknown'
    map[k] = (map[k] || 0) + 1
  })
  return map
})
const sessionChartData = computed(() => {
  const labels = Object.keys(sessionKinds.value)
  const data = Object.values(sessionKinds.value)
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899']
  return {
    labels: labels.map(l => l === 'main' ? '主会话' : l === 'isolated' ? '独立会话' : l === 'subagent' ? '子Agent' : l),
    datasets: [{ data, backgroundColor: colors.slice(0, labels.length), borderWidth: 0, cutout: '60%' }]
  }
})
const sessionChartOptions = {
  responsive: true, maintainAspectRatio: true,
  plugins: { legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true, font: { size: 11 } } }, tooltip: { enabled: true } },
  animation: { duration: 600 }
}

// 模型统计
const providerModelCount = computed(() => {
  return providerEntries.value.map(p => ({
    name: p.name,
    count: p.models.length,
    reasoning: p.models.filter(m => m.reasoning).length
  }))
})
const channelEntries = computed(() => {
  const ch = channelsInfo.value?.channels || {}
  return Object.entries(ch).map(([id, info]) => ({ id, ...info }))
})

// 模型配置计算属性
const modelConfig = computed(() => {
  const cfg = configData.value?.parsed
  if (!cfg) return null
  const primary = cfg.agents?.defaults?.model?.primary || ''
  const fallbacks = cfg.agents?.defaults?.model?.fallbacks || []
  const providers = cfg.models?.providers || {}
  // 解析 primary: "mimo/mimo-v2.5-pro" → provider: mimo, model: mimo-v2.5-pro
  const [primaryProvider, ...primaryModelParts] = primary.split('/')
  const primaryModel = primaryModelParts.join('/')
  return { primary, primaryProvider, primaryModel, fallbacks, providers }
})

const providerEntries = computed(() => {
  if (!modelConfig.value) return []
  const providers = modelConfig.value.providers
  return Object.entries(providers).map(([name, p]) => ({
    name,
    api: p.api,
    baseUrl: p.baseUrl,
    models: p.models || []
  }))
})

let refreshTimer
onMounted(() => {
  if (authenticated.value) loadAllData()
  refreshTimer = setInterval(() => {
    if (authenticated.value) loadAllData(true)
  }, 30000)
})
onUnmounted(() => clearInterval(refreshTimer))
</script>

<template>
  <div class="space-y-5">
    <!-- 状态横幅 -->
    <div class="rounded-xl border p-5 transition-all"
      :class="authenticated
        ? 'bg-white border-green-200'
        : connectionError
          ? 'bg-white border-red-200'
          : 'bg-white border-gray-200'">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
            :class="authenticated ? 'bg-green-50' : connectionError ? 'bg-red-50' : 'bg-gray-50'">
            {{ authenticated ? '🟢' : connectionError ? '🔴' : '⏳' }}
          </div>
          <div>
            <h3 class="font-semibold text-gray-900">
              {{ authenticated ? 'Gateway 运行中' : connectionError ? '连接失败' : '正在连接...' }}
            </h3>
            <div class="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
              <span v-if="gatewayInfo?.server?.version">v{{ gatewayInfo.server.version }}</span>
              <span v-if="healthData?.uptime">运行 {{ formatUptime(healthData.uptime) }}</span>
              <span v-if="gatewayInfo?.protocol">协议 v{{ gatewayInfo.protocol }}</span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button @click="loadAllData()" :disabled="loading || !authenticated"
            class="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition">
            {{ loading ? '加载中...' : '刷新' }}
          </button>
          <button @click="doGatewayAction('stop')" :disabled="controlling || !authenticated"
            class="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 transition">
            停止
          </button>
          <button @click="doGatewayAction('start')" :disabled="controlling || authenticated"
            class="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500 text-white hover:bg-green-600 disabled:opacity-40 transition">
            启动
          </button>
        </div>
      </div>
    </div>

    <!-- 共享组件 -->
    <AppToast ref="toastRef" />
    <AppConfirm ref="confirmRef" />

    <!-- 错误提示 -->
    <div v-if="error" class="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-center gap-2">
      <span>⚠️</span> {{ error }}
      <button @click="error = ''; loadAllData()" class="ml-auto underline text-red-600">重试</button>
    </div>

    <!-- 系统状态环形图 -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div class="rounded-xl border border-gray-200 bg-white p-4 flex flex-col items-center">
        <RingChart :value="eventLoopUtil" :max="100" label="事件循环" unit="%" :color="eventLoopColor" :size="100" />
        <p class="text-xs mt-2" :class="eventLoop?.degraded ? 'text-amber-600' : 'text-green-600'">{{ eventLoop?.degraded ? '降级' : '正常' }}</p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-4 flex flex-col items-center">
        <RingChart :value="sessionCount" :max="50" label="活跃会话" unit="" color="#3b82f6" :size="100" />
        <p class="text-xs text-gray-400 mt-2">/ 50 上限</p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-4 flex flex-col items-center">
        <RingChart :value="modelCount" :max="20" label="模型数" unit="" color="#8b5cf6" :size="100" />
        <p class="text-xs text-gray-400 mt-2">{{ providerEntries.length }} 个提供商</p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-4 flex flex-col items-center">
        <RingChart :value="channelCount" :max="10" label="渠道" unit="" color="#f59e0b" :size="100" />
        <p class="text-xs mt-2" :class="healthData?.ok ? 'text-green-600' : 'text-gray-400'">{{ healthData?.ok ? '运行中' : '-' }}</p>
      </div>
    </div>

    <!-- 模型配置 -->
    <div v-if="modelConfig" class="rounded-xl border border-gray-200 bg-white p-5">
      <h4 class="text-sm font-semibold text-gray-700 mb-3">模型配置</h4>
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-xs text-gray-400">默认模型</span>
          <span class="text-sm font-medium text-gray-900">{{ modelConfig.primary }}</span>
        </div>
        <div v-if="modelConfig.fallbacks.length" class="flex items-start justify-between">
          <span class="text-xs text-gray-400">备选模型</span>
          <div class="text-right">
            <p v-for="f in modelConfig.fallbacks" :key="f" class="text-sm text-gray-700">{{ f }}</p>
          </div>
        </div>
        <div v-for="p in providerEntries" :key="p.name" class="border-t border-gray-100 pt-3">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-medium text-gray-600">{{ p.name }}</span>
            <span class="text-xs text-gray-400">{{ p.api }}</span>
          </div>
          <p class="text-xs text-gray-400 truncate">{{ p.baseUrl }}</p>
          <div class="flex flex-wrap gap-1.5 mt-2">
            <span v-for="m in p.models" :key="m.id"
              class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-gray-50 text-gray-600">
              {{ m.name }}
              <span v-if="m.reasoning" class="text-purple-500" title="支持推理">⚡</span>
              <span class="text-gray-300">{{ (m.contextWindow / 1000).toFixed(0) }}K</span>
            </span>
          </div>
        </div>
      </div>
    </div>
    <!-- 兜底：无 config 时只显示默认模型 -->
    <div v-else-if="defaultModelName" class="rounded-xl border border-gray-200 bg-white p-5">
      <h4 class="text-sm font-semibold text-gray-700 mb-3">当前模型</h4>
      <p class="text-base font-medium text-gray-900">{{ defaultModelProvider }}/{{ defaultModelName }}</p>
    </div>

    <!-- 会话分布 + 模型统计 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- 会话分布 -->
      <div v-if="sessions.length > 0" class="rounded-xl border border-gray-200 bg-white p-5">
        <h4 class="text-sm font-semibold text-gray-700 mb-3">会话分布</h4>
        <div class="flex items-center justify-center">
          <div class="w-48 h-48">
            <Doughnut :data="sessionChartData" :options="sessionChartOptions" />
          </div>
        </div>
      </div>
      <!-- 模型统计 -->
      <div v-if="providerModelCount.length > 0" class="rounded-xl border border-gray-200 bg-white p-5">
        <h4 class="text-sm font-semibold text-gray-700 mb-3">模型统计</h4>
        <div class="space-y-3">
          <div v-for="p in providerModelCount" :key="p.name" class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-xs font-bold text-blue-600">{{ p.name[0].toUpperCase() }}</div>
              <span class="text-sm font-medium text-gray-800">{{ p.name }}</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-xs text-gray-500">{{ p.count }} 模型</span>
              <span v-if="p.reasoning > 0" class="text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-600">{{ p.reasoning }} 推理</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 会话列表 -->
    <div v-if="sessions.length > 0" class="rounded-xl border border-gray-200 bg-white p-5">
      <h4 class="text-sm font-semibold text-gray-700 mb-3">活跃会话</h4>
      <div class="space-y-2">
        <div v-for="s in sessions.slice(0, 10)" :key="s.key || s.id"
          class="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-gray-800 truncate">{{ s.key || s.id }}</p>
            <p class="text-xs text-gray-400 mt-0.5">{{ s.model || '-' }}</p>
          </div>
          <span class="text-xs text-gray-400 ml-3 flex-shrink-0">{{ s.kind || '-' }}</span>
        </div>
      </div>
    </div>

    <!-- 模型列表 -->
    <div v-if="modelsInfo?.models?.length" class="rounded-xl border border-gray-200 bg-white p-5">
      <h4 class="text-sm font-semibold text-gray-700 mb-3">可用模型</h4>
      <div class="space-y-2">
        <div v-for="m in modelsInfo.models" :key="m.id"
          class="flex items-center justify-between p-3 rounded-lg bg-gray-50">
          <div class="min-w-0">
            <p class="text-sm font-medium text-gray-800 truncate">{{ m.provider }}/{{ m.id }}</p>
            <p class="text-xs text-gray-400">上下文 {{ (m.contextWindow / 1000).toFixed(0) }}K</p>
          </div>
          <div class="flex items-center gap-2 ml-3">
            <span v-if="m.reasoning" class="text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-600">推理</span>
            <span v-if="defaultModelName === m.id" class="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600">当前</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 渠道状态 -->
    <div v-if="channelsInfo" class="rounded-xl border border-gray-200 bg-white p-5">
      <h4 class="text-sm font-semibold text-gray-700 mb-3">渠道状态</h4>
      <!-- EventLoop 状态 -->
      <div v-if="eventLoop" class="flex items-center justify-between p-3 rounded-lg mb-3"
        :class="eventLoop.degraded ? 'bg-amber-50' : 'bg-green-50'">
        <div class="flex items-center gap-2">
          <span>{{ eventLoop.degraded ? '⚠️' : '✅' }}</span>
          <span class="text-sm" :class="eventLoop.degraded ? 'text-amber-700' : 'text-green-700'">
            事件循环{{ eventLoop.degraded ? '降级' : '正常' }}
          </span>
        </div>
        <div class="flex items-center gap-3 text-xs text-gray-500">
          <span v-if="eventLoop.utilization">利用率 {{ (eventLoop.utilization * 100).toFixed(0) }}%</span>
          <span v-if="eventLoop.delayP99Ms">P99 {{ eventLoop.delayP99Ms.toFixed(0) }}ms</span>
          <span v-if="eventLoop.intervalMs">间隔 {{ eventLoop.intervalMs }}ms</span>
        </div>
      </div>
      <!-- 渠道列表 -->
      <div v-if="channelEntries.length > 0" class="space-y-2">
        <div v-for="ch in channelEntries" :key="ch.id"
          class="flex items-center justify-between p-3 rounded-lg bg-gray-50">
          <div class="min-w-0">
            <p class="text-sm font-medium text-gray-800 truncate">{{ ch.id }}</p>
            <p class="text-xs text-gray-400">{{ ch.status || '-' }}</p>
          </div>
          <span class="text-xs px-2 py-0.5 rounded"
            :class="ch.connected ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'">
            {{ ch.connected ? '已连接' : '未连接' }}
          </span>
        </div>
      </div>
      <div v-else class="text-center py-4">
        <p class="text-sm text-gray-400">暂无渠道配置</p>
        <p class="text-xs text-gray-300 mt-1">可在系统设置中配置飞书、Telegram 等渠道</p>
      </div>
    </div>

    <!-- 未连接 -->
    <div v-if="!authenticated && !connecting" class="text-center py-12">
      <p class="text-4xl mb-3">🔌</p>
      <p class="text-sm text-gray-500">请配置 Gateway Token</p>
    </div>

    <!-- 最后更新 -->
    <p v-if="lastUpdate" class="text-xs text-gray-300 text-right">
      更新于 {{ lastUpdate.toLocaleTimeString('zh-CN') }}
    </p>
  </div>
</template>
