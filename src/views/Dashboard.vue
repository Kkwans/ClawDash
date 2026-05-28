<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue'
import { authenticated, connecting, connectionError, gwRequest, useGatewayEvent } from '../stores/gateway.js'
import RingChart from '../components/RingChart.vue'
import AppToast from '../components/AppToast.vue'
import AppConfirm from '../components/AppConfirm.vue'
import AppButton from '../components/AppButton.vue'
import AppBadge from '../components/AppBadge.vue'
import { Doughnut } from 'vue-chartjs'
import { useEnterAnim } from '../composables/useEnterAnim.js'

const props = defineProps({
  refreshKey: { type: Number, default: 0 }
})

// 入场动画
const { entered } = useEnterAnim()

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
const copying = ref(false)

function showToast(msg, type = 'info') {
  toastRef.value?.show(msg, type)
}

async function copySystemInfo() {
  if (copying.value) return
  copying.value = true
  const info = [
    `ClawDash System Info`,
    `Time: ${new Date().toLocaleString('zh-CN')}`,
    `Gateway: ${authenticated.value ? 'Connected' : 'Disconnected'}`,
    `Version: ${gatewayInfo.value?.server?.version || '-'}`,
    `Uptime: ${formatUptime(healthData.value?.uptime)}`,
    `Sessions: ${sessionCount.value}`,
    `Models: ${modelCount.value}`,
    `Channels: ${channelCount.value}`,
    `Event Loop: ${eventLoopUtil.value}% (${eventLoop.value?.degraded ? 'Degraded' : 'Normal'})`,
  ].join('\n')
  try {
    await navigator.clipboard.writeText(info)
    showToast('系统信息已复制')
  } catch (e) {
    showToast('复制失败', 'error')
  }
  copying.value = false
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
    showToast('操作失败: ' + e.message, 'error')
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
watch(() => props.refreshKey, () => {
  if (authenticated.value) loadAllData()
})

function startPolling() {
  clearInterval(refreshTimer)
  refreshTimer = setInterval(() => {
    if (authenticated.value && !document.hidden) loadAllData(true)
  }, 30000)
}

function onVisibilityChange() {
  if (document.hidden) {
    clearInterval(refreshTimer)
  } else {
    // 回到标签页时立即刷新一次，然后恢复轮询
    if (authenticated.value) loadAllData(true)
    startPolling()
  }
}

onMounted(() => {
  if (authenticated.value) loadAllData()
  startPolling()
  document.addEventListener('visibilitychange', onVisibilityChange)
})
onUnmounted(() => {
  clearInterval(refreshTimer)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<style scoped>
/* Dashboard 使用 shared-animations.css 中的 .enter-anim / .is-entered */
</style>

<template>
  <div class="space-y-5">
    <!-- 状态横幅 -->
    <div class="rounded-2xl border p-5 transition-all shadow-sm"
      :class="[
        'enter-anim',
        { 'is-entered': entered },
        authenticated
          ? 'bg-gradient-to-r from-white to-green-50/30 border-green-200/60'
          : connectionError
            ? 'bg-gradient-to-r from-white to-red-50/30 border-red-200/60'
            : 'bg-white border-gray-200'
      ]"
      style="--delay: 0ms">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="w-11 h-11 rounded-xl flex items-center justify-center text-xl shadow-sm"
            :class="authenticated ? 'bg-green-50 ring-1 ring-green-200/50' : connectionError ? 'bg-red-50 ring-1 ring-red-200/50' : 'bg-gray-50 ring-1 ring-gray-200/50'">
            {{ authenticated ? '🟢' : connectionError ? '🔴' : '⏳' }}
          </div>
          <div>
            <h3 class="font-bold text-gray-900 tracking-tight">
              {{ authenticated ? 'Gateway 运行中' : connectionError ? '连接失败' : '正在连接...' }}
            </h3>
            <div class="flex items-center gap-3 text-xs text-gray-400 mt-1">
              <span v-if="gatewayInfo?.server?.version" class="inline-flex items-center gap-1">
                <span class="w-1 h-1 rounded-full bg-gray-300"></span>v{{ gatewayInfo.server.version }}
              </span>
              <span v-if="healthData?.uptime" class="inline-flex items-center gap-1">
                <span class="w-1 h-1 rounded-full bg-gray-300"></span>运行 {{ formatUptime(healthData.uptime) }}
              </span>
              <span v-if="gatewayInfo?.protocol" class="inline-flex items-center gap-1">
                <span class="w-1 h-1 rounded-full bg-gray-300"></span>协议 v{{ gatewayInfo.protocol }}
              </span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <AppButton size="sm" :disabled="loading || !authenticated" @click="loadAllData()">
            {{ loading ? '加载中...' : '刷新' }}
          </AppButton>
          <AppButton size="sm" variant="danger" :disabled="controlling || !authenticated" @click="doGatewayAction('stop')">
            停止
          </AppButton>
          <AppButton size="sm" variant="primary" :disabled="controlling || authenticated" @click="doGatewayAction('start')">
            启动
          </AppButton>
        </div>
      </div>
    </div>

    <!-- 共享组件 -->
    <AppToast ref="toastRef" />
    <AppConfirm ref="confirmRef" />

    <!-- 错误提示 -->
    <Transition name="slide-up">
      <div v-if="error" class="rounded-xl p-4 text-sm flex items-center gap-2"
        :style="{ backgroundColor: 'var(--danger-light)', borderColor: 'var(--danger-text)', color: 'var(--danger-text)' }">
        <span>⚠️</span> {{ error }}
        <AppButton variant="ghost" size="xs" @click="error = ''; loadAllData()" class="ml-auto">重试</AppButton>
      </div>
    </Transition>

    <!-- 系统状态环形图 -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div v-for="(card, idx) in [
        { value: eventLoopUtil, max: 100, label: '事件循环', unit: '%', color: eventLoopColor, sub: eventLoop?.degraded ? '降级' : '正常', subClass: eventLoop?.degraded ? 'text-amber-600' : 'text-green-600' },
        { value: sessionCount, max: 50, label: '活跃会话', unit: '', color: '#3b82f6', sub: '/ 50 上限', subClass: 'text-gray-400' },
        { value: modelCount, max: 20, label: '模型数', unit: '', color: '#8b5cf6', sub: providerEntries.length + ' 个提供商', subClass: 'text-gray-400' },
        { value: channelCount, max: 10, label: '渠道', unit: '', color: '#f59e0b', sub: healthData?.ok ? '运行中' : '-', subClass: healthData?.ok ? 'text-green-600' : 'text-gray-400' }
      ]" :key="card.label"
        class="ring-card enter-anim rounded-2xl border border-gray-200/60 bg-white p-5 flex flex-col items-center shadow-sm"
        :class="{ 'is-entered': entered }"
        :style="{ '--delay': (80 + idx * 60) + 'ms' }">
        <RingChart :value="card.value" :max="card.max" :label="card.label" :unit="card.unit" :color="card.color" :size="100" />
        <p class="text-xs mt-2.5 font-medium" :class="card.subClass">{{ card.sub }}</p>
      </div>
    </div>

    <!-- 模型配置 -->
    <div v-if="modelConfig" class="card-accent enter-anim card-hover rounded-2xl border border-gray-200/60 bg-white p-5 shadow-sm" :class="{ 'is-entered': entered }"
      style="--delay: 320ms">
      <h4 class="text-sm font-bold text-gray-800 mb-4 tracking-tight">模型配置</h4>
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
    <div v-else-if="defaultModelName" class="card-accent enter-anim card-hover rounded-2xl border border-gray-200/60 bg-white p-5 shadow-sm" :class="{ 'is-entered': entered }"
      style="--delay: 320ms">
      <h4 class="text-sm font-bold text-gray-800 mb-4 tracking-tight">当前模型</h4>
      <p class="text-base font-medium text-gray-900">{{ defaultModelProvider }}/{{ defaultModelName }}</p>
    </div>

    <!-- 会话分布 + 模型统计 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- 会话分布 -->
      <div v-if="sessions.length > 0" class="card-accent enter-anim card-hover rounded-2xl border border-gray-200/60 bg-white p-5 shadow-sm" :class="{ 'is-entered': entered }"
        style="--delay: 400ms">
        <h4 class="text-sm font-bold text-gray-800 mb-4 tracking-tight">会话分布</h4>
        <div class="flex items-center justify-center">
          <div class="w-48 h-48">
            <Doughnut :data="sessionChartData" :options="sessionChartOptions" />
          </div>
        </div>
      </div>
      <!-- 模型统计 -->
      <div v-if="providerModelCount.length > 0" class="card-accent enter-anim card-hover rounded-2xl border border-gray-200/60 bg-white p-5 shadow-sm" :class="{ 'is-entered': entered }"
        style="--delay: 480ms">
        <h4 class="text-sm font-bold text-gray-800 mb-4 tracking-tight">模型统计</h4>
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
    <div v-if="sessions.length > 0" class="card-accent enter-anim card-hover rounded-2xl border border-gray-200/60 bg-white p-5 shadow-sm" :class="{ 'is-entered': entered }"
      style="--delay: 560ms">
      <h4 class="text-sm font-bold text-gray-800 mb-4 tracking-tight">活跃会话</h4>
      <div class="space-y-2">
        <div v-for="s in sessions.slice(0, 10)" :key="s.key || s.id"
          class="list-item flex items-center justify-between p-3.5 rounded-xl bg-gray-50/70 hover:bg-indigo-50/40 cursor-default">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-gray-800 truncate">{{ s.key || s.id }}</p>
            <p class="text-xs text-gray-400 mt-0.5">{{ s.model || '-' }}</p>
          </div>
          <span class="text-xs text-gray-400 ml-3 flex-shrink-0">{{ s.kind || '-' }}</span>
        </div>
      </div>
    </div>

    <!-- 模型列表 -->
    <div v-if="modelsInfo?.models?.length" class="card-accent enter-anim card-hover rounded-2xl border border-gray-200/60 bg-white p-5 shadow-sm" :class="{ 'is-entered': entered }"
      style="--delay: 640ms">
      <h4 class="text-sm font-bold text-gray-800 mb-4 tracking-tight">可用模型</h4>
      <div class="space-y-2">
        <div v-for="m in modelsInfo.models" :key="m.id"
          class="list-item flex items-center justify-between p-3.5 rounded-xl bg-gray-50/70 hover:bg-indigo-50/40">
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
    <div v-if="channelsInfo" class="card-accent enter-anim card-hover rounded-2xl border border-gray-200/60 bg-white p-5 shadow-sm" :class="{ 'is-entered': entered }"
      style="--delay: 720ms">
      <h4 class="text-sm font-bold text-gray-800 mb-4 tracking-tight">渠道状态</h4>
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
      <div class="w-16 h-16 mx-auto bg-gray-50 rounded-2xl flex items-center justify-center text-3xl mb-4 ring-1 ring-gray-200/50">
        🔌
      </div>
      <p class="text-sm font-medium text-gray-600">请配置 Gateway Token</p>
      <p class="text-xs text-gray-400 mt-1">在系统设置中配置 Token 后即可管理 Gateway</p>
    </div>

    <!-- 快速操作 -->
    <div class="enter-anim rounded-2xl border border-gray-200/60 bg-white p-5 shadow-sm"
      :class="{ 'is-entered': entered }"
      style="--delay: 800ms">
      <h4 class="text-sm font-bold text-gray-800 mb-4 tracking-tight">快速操作</h4>
      <div class="flex flex-wrap gap-2">
        <AppButton size="sm" :disabled="loading" @click="loadAllData()">🔄 刷新数据</AppButton>
        <AppButton size="sm" :disabled="copying" @click="copySystemInfo()">📋 复制系统信息</AppButton>
        <a href="/builtin/" target="_blank"
          class="btn-press px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200/80 text-gray-600 hover:bg-gray-50 transition-all shadow-sm">
          ⚡ 内置 UI
        </a>
        <AppButton size="sm" variant="danger" :disabled="controlling || !authenticated" @click="doGatewayAction('stop')">⏹ 停止</AppButton>
        <AppButton size="sm" variant="primary" :disabled="controlling || authenticated" @click="doGatewayAction('start')">▶ 启动</AppButton>
      </div>
    </div>

    <!-- 最后更新 -->
    <p v-if="lastUpdate" class="text-xs text-gray-300 text-right">
      更新于 {{ lastUpdate.toLocaleTimeString('zh-CN') }}
    </p>

    <!-- 空状态 -->
    <div v-if="!loading && !error && !authenticated && !connecting" class="text-center py-16">
      <div class="w-20 h-20 mx-auto bg-gray-50 rounded-3xl flex items-center justify-center text-4xl mb-5 ring-1 ring-gray-200/50">
        🦞
      </div>
      <h3 class="text-lg font-semibold text-gray-800 mb-2">欢迎使用 ClawDash</h3>
      <p class="text-sm text-gray-500 max-w-md mx-auto">
        这是 OpenClaw 的 Web 控制台。请先配置 Gateway Token 以开始使用。
      </p>
      <div class="flex items-center justify-center gap-3 mt-6">
        <a href="/builtin/" target="_blank"
          class="btn-press px-4 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all">
          ⚡ 内置 UI
        </a>
      </div>
    </div>
  </div>
</template>
