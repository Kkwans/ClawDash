<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const status = ref({ cpu: 0, memory: { used: 0, total: 0, percent: 0 }, disk: { used: 0, total: 0, percent: 0 } })
const gateway = ref({ status: 'checking', version: '', uptime: '' })
const sessions = ref({ active: 0, total: 0 })
const stats = ref({ todayMessages: 0, monthMessages: 0, tokens: { input: 0, output: 0 } })

async function fetchHealth() {
  try {
    const r = await fetch('/api/healthz')
    const d = await r.json()
    gateway.value.status = d.ok ? 'running' : 'error'
  } catch { gateway.value.status = 'error' }
}

async function fetchStatus() {
  try {
    const r = await fetch('/api/status')
    const d = await r.json()
    if (d.cpu !== undefined) status.value.cpu = d.cpu
    if (d.memory) status.value.memory = d.memory
    if (d.disk) status.value.disk = d.disk
    if (d.version) gateway.value.version = d.version
    if (d.uptime) gateway.value.uptime = d.uptime
  } catch {}
}

async function fetchSessions() {
  try {
    const r = await fetch('/api/sessions')
    const d = await r.json()
    if (Array.isArray(d)) {
      sessions.value.active = d.filter(s => s.active).length
      sessions.value.total = d.length
    }
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

let timer
onMounted(() => {
  fetchHealth()
  fetchStatus()
  fetchSessions()
  timer = setInterval(() => {
    fetchHealth()
    fetchStatus()
    fetchSessions()
  }, 10000)
})
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <div class="space-y-6">
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
            版本: {{ gateway.version || '-' }} · 运行时长: {{ formatUptime(gateway.uptime) }}
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
            <p class="text-2xl font-bold text-gray-900">{{ status.cpu.toFixed(1) }}<span class="text-sm font-normal text-gray-400">%</span></p>
            <div class="w-full bg-gray-100 rounded-full h-1.5 mt-2">
              <div class="h-1.5 rounded-full transition-all duration-500"
                :class="status.cpu > 80 ? 'bg-red-500' : status.cpu > 60 ? 'bg-yellow-500' : 'bg-blue-500'"
                :style="{ width: status.cpu + '%' }"></div>
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
            <p class="text-2xl font-bold text-gray-900">{{ status.memory.percent.toFixed(1) }}<span class="text-sm font-normal text-gray-400">%</span></p>
            <div class="w-full bg-gray-100 rounded-full h-1.5 mt-2">
              <div class="h-1.5 rounded-full bg-purple-500 transition-all duration-500"
                :style="{ width: status.memory.percent + '%' }"></div>
            </div>
            <p class="text-xs text-gray-400 mt-1">{{ formatBytes(status.memory.used) }} / {{ formatBytes(status.memory.total) }}</p>
          </div>
        </div>
      </div>

      <!-- 磁盘 -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-2xl">💾</div>
          <div class="flex-1">
            <p class="text-xs text-gray-400 mb-1">磁盘使用</p>
            <p class="text-2xl font-bold text-gray-900">{{ status.disk.percent.toFixed(1) }}<span class="text-sm font-normal text-gray-400">%</span></p>
            <div class="w-full bg-gray-100 rounded-full h-1.5 mt-2">
              <div class="h-1.5 rounded-full transition-all duration-500"
                :class="status.disk.percent > 90 ? 'bg-red-500' : status.disk.percent > 70 ? 'bg-yellow-500' : 'bg-green-500'"
                :style="{ width: status.disk.percent + '%' }"></div>
            </div>
            <p class="text-xs text-gray-400 mt-1">{{ formatBytes(status.disk.used) }} / {{ formatBytes(status.disk.total) }}</p>
          </div>
        </div>
      </div>

      <!-- 会话 -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-2xl">💬</div>
          <div class="flex-1">
            <p class="text-xs text-gray-400 mb-1">活跃会话</p>
            <p class="text-2xl font-bold text-gray-900">{{ sessions.active }}<span class="text-sm font-normal text-gray-400"> / {{ sessions.total }}</span></p>
          </div>
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
