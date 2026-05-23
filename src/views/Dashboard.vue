<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { healthCheck, getProcessStatus, getProviders, getChannels, getDefaults } from '../api'

const status = ref({ cpu: 0, cpuPercent: 0, memoryRss: 0, memoryVms: 0, uptimeSeconds: 0, state: 'checking' })
const gateway = ref({ status: 'checking', version: '2026.5.18', uptime: '' })
const providers = ref([])
const channels = ref([])
const defaults = ref({})
const error = ref('')

// CPU/内存历史数据（用于图表）
const cpuHistory = ref([])
const memHistory = ref([])
const MAX_HISTORY = 60

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
    // 记录历史
    const now = new Date()
    const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    cpuHistory.value.push({ time: timeStr, value: d.cpuPercent || 0 })
    if (cpuHistory.value.length > MAX_HISTORY) cpuHistory.value.shift()
    const memPercent = d.memoryRss ? (d.memoryRss / (d.memoryVms || 1)) * 100 : 0
    memHistory.value.push({ time: timeStr, value: memPercent })
    if (memHistory.value.length > MAX_HISTORY) memHistory.value.shift()
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

const channelIcons = { feishu: '🐦', qqbot: '🐧', telegram: '✈️', discord: '🎮' }

// 计算总模型数
const totalModels = () => providers.value.reduce((s, p) => s + (p.models?.length || 0), 0)

let timer
onMounted(() => {
  fetchHealth()
  fetchProcessStatus()
  fetchProviders()
  fetchChannels()
  fetchDefaults()
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
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center justify-between"
      :class="gateway.status === 'running' ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-red-500'">
      <div class="flex items-start gap-4">
        <div class="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
          :class="gateway.status === 'running' ? 'bg-green-500' : 'bg-red-500'"></div>
        <div>
          <h3 class="text-lg font-bold text-gray-900">
            {{ gateway.status === 'running' ? 'OpenClaw 运行正常' : gateway.status === 'error' ? 'OpenClaw 连接异常' : '正在检测...' }}
          </h3>
          <p class="text-sm text-gray-500 mt-1">
            版本: {{ gateway.version }} · 运行时长: {{ formatUptime(status.uptimeSeconds) }} · PID: {{ status.pid || '-' }}
          </p>
        </div>
      </div>
    </div>

    <!-- 资源卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- CPU -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-2xl">💻</div>
          <div class="flex-1">
            <p class="text-xs text-gray-400 mb-1">CPU 使用率</p>
            <p class="text-2xl font-bold text-gray-900">{{ (status.cpuPercent || 0).toFixed(1) }}<span class="text-sm font-normal text-gray-400">%</span></p>
            <div class="w-full bg-gray-100 rounded-full h-1.5 mt-2">
              <div class="h-1.5 rounded-full transition-all duration-500"
                :class="(status.cpuPercent || 0) > 80 ? 'bg-red-500' : (status.cpuPercent || 0) > 60 ? 'bg-yellow-500' : 'bg-blue-500'"
                :style="{ width: Math.min(status.cpuPercent || 0, 100) + '%' }"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 内存 -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-2xl">🧠</div>
          <div class="flex-1">
            <p class="text-xs text-gray-400 mb-1">内存使用</p>
            <p class="text-2xl font-bold text-gray-900">{{ formatBytes(status.memoryRss) }}</p>
            <p class="text-xs text-gray-400 mt-1">虚拟内存: {{ formatBytes(status.memoryVms) }}</p>
          </div>
        </div>
      </div>

      <!-- 模型 -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-2xl">🤖</div>
          <div class="flex-1">
            <p class="text-xs text-gray-400 mb-1">模型提供商</p>
            <p class="text-2xl font-bold text-gray-900">{{ providers.length }}</p>
            <p class="text-xs text-gray-400 mt-1">{{ totalModels() }} 个模型</p>
          </div>
        </div>
      </div>

      <!-- 渠道 -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-2xl">📡</div>
          <div class="flex-1">
            <p class="text-xs text-gray-400 mb-1">消息渠道</p>
            <p class="text-2xl font-bold text-gray-900">{{ channels.length }}</p>
            <p class="text-xs text-gray-400 mt-1">已启用: {{ channels.filter(ch => ch.enabled !== false).length }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- CPU/内存曲线 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- CPU 曲线 -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h4 class="text-sm font-semibold text-gray-700 mb-4">💻 CPU 使用率趋势</h4>
        <div class="h-32 flex items-end gap-0.5">
          <div v-for="(item, i) in cpuHistory" :key="i"
            class="flex-1 rounded-t-sm transition-all duration-300"
            :class="item.value > 80 ? 'bg-red-400' : item.value > 60 ? 'bg-yellow-400' : 'bg-blue-400'"
            :style="{ height: Math.max(item.value, 2) + '%' }"
            :title="item.time + ' - ' + item.value.toFixed(1) + '%'">
          </div>
        </div>
        <div class="flex justify-between mt-2 text-xs text-gray-400">
          <span>{{ cpuHistory.length > 0 ? cpuHistory[0].time : '-' }}</span>
          <span>{{ cpuHistory.length > 0 ? cpuHistory[cpuHistory.length-1].time : '-' }}</span>
        </div>
      </div>

      <!-- 内存曲线 -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h4 class="text-sm font-semibold text-gray-700 mb-4">🧠 内存使用趋势</h4>
        <div class="h-32 flex items-end gap-0.5">
          <div v-for="(item, i) in memHistory" :key="i"
            class="flex-1 bg-purple-400 rounded-t-sm transition-all duration-300"
            :style="{ height: Math.max(item.value, 2) + '%' }"
            :title="item.time + ' - ' + item.value.toFixed(1) + '%'">
          </div>
        </div>
        <div class="flex justify-between mt-2 text-xs text-gray-400">
          <span>{{ memHistory.length > 0 ? memHistory[0].time : '-' }}</span>
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
          <div class="flex gap-1">
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
