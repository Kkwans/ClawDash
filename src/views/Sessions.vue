<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { getProcessStatus, getProcessLogs, clearProcessLogs } from '../api'

const status = ref({})
const logs = ref([])
const loading = ref(true)
const logLimit = ref(50)
const clearing = ref(false)
const toast = ref('')

async function fetchStatus() {
  try {
    status.value = await getProcessStatus()
  } catch {}
}

async function fetchLogs() {
  loading.value = true
  try {
    const d = await getProcessLogs(0, logLimit.value)
    logs.value = d.lines || []
  } catch {}
  loading.value = false
}

async function handleClearLogs() {
  clearing.value = true
  try {
    await clearProcessLogs()
    logs.value = []
    showToast('日志已清除')
  } catch (e) {
    showToast(`清除失败: ${e.message}`)
  }
  clearing.value = false
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatUptime(seconds) {
  if (!seconds) return '-'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}天 ${h}小时 ${m}分钟`
  if (h > 0) return `${h}小时 ${m}分钟`
  return `${m}分钟`
}

function showToast(msg) {
  toast.value = msg
  setTimeout(() => toast.value = '', 3000)
}

let timer
onMounted(() => {
  fetchStatus()
  fetchLogs()
  timer = setInterval(fetchStatus, 5000)
})
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <div class="space-y-6">
    <!-- Toast -->
    <Transition name="fade">
      <div v-if="toast" class="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
        {{ toast }}
      </div>
    </Transition>

    <!-- 进程状态 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-semibold text-gray-800">进程状态</h3>
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
          :class="status.state === 'running' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'">
          <span class="w-1.5 h-1.5 rounded-full" :class="status.state === 'running' ? 'bg-green-500' : 'bg-red-500'"></span>
          {{ status.state === 'running' ? '运行中' : status.state || '未知' }}
        </span>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div class="text-center p-3 bg-gray-50 rounded-lg">
          <p class="text-xs text-gray-400 mb-1">PID</p>
          <p class="text-lg font-bold text-gray-800">{{ status.pid || '-' }}</p>
        </div>
        <div class="text-center p-3 bg-gray-50 rounded-lg">
          <p class="text-xs text-gray-400 mb-1">CPU 使用率</p>
          <p class="text-lg font-bold" :class="(status.cpuPercent || 0) > 80 ? 'text-red-600' : 'text-gray-800'">
            {{ (status.cpuPercent || 0).toFixed(1) }}%
          </p>
        </div>
        <div class="text-center p-3 bg-gray-50 rounded-lg">
          <p class="text-xs text-gray-400 mb-1">内存占用</p>
          <p class="text-lg font-bold text-gray-800">{{ formatBytes(status.memoryRss) }}</p>
        </div>
        <div class="text-center p-3 bg-gray-50 rounded-lg">
          <p class="text-xs text-gray-400 mb-1">运行时长</p>
          <p class="text-lg font-bold text-gray-800">{{ formatUptime(status.uptimeSeconds) }}</p>
        </div>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="text-center p-3 bg-gray-50 rounded-lg">
          <p class="text-xs text-gray-400 mb-1">重启次数</p>
          <p class="text-lg font-bold text-gray-800">{{ status.restartCount || 0 }}</p>
        </div>
        <div class="text-center p-3 bg-gray-50 rounded-lg">
          <p class="text-xs text-gray-400 mb-1">虚拟内存</p>
          <p class="text-lg font-bold text-gray-800">{{ formatBytes(status.memoryVms) }}</p>
        </div>
        <div class="text-center p-3 bg-gray-50 rounded-lg">
          <p class="text-xs text-gray-400 mb-1">系统 CPU</p>
          <p class="text-lg font-bold text-gray-800">{{ (status.cpu || 0).toFixed(2) }}s</p>
        </div>
        <div class="text-center p-3 bg-gray-50 rounded-lg">
          <p class="text-xs text-gray-400 mb-1">日志条数</p>
          <p class="text-lg font-bold text-gray-800">{{ logs.length }}</p>
        </div>
      </div>
    </div>

    <!-- 日志 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-semibold text-gray-800">最近日志</h3>
        <div class="flex items-center gap-2">
          <select v-model="logLimit" @change="fetchLogs"
            class="text-sm border border-gray-200 rounded-lg px-2 py-1">
            <option :value="20">20 条</option>
            <option :value="50">50 条</option>
            <option :value="100">100 条</option>
          </select>
          <button @click="fetchLogs" class="text-sm text-blue-600 hover:text-blue-700">刷新</button>
          <button @click="handleClearLogs" :disabled="clearing"
            class="text-sm text-red-600 hover:text-red-700 disabled:opacity-50">
            {{ clearing ? '清除中...' : '清除日志' }}
          </button>
        </div>
      </div>

      <div v-if="loading" class="text-center py-8 text-gray-400">加载中...</div>
      <div v-else-if="logs.length === 0" class="text-center py-8 text-gray-400">暂无日志</div>
      <div v-else class="bg-gray-900 rounded-lg p-4 overflow-x-auto max-h-96 overflow-y-auto">
        <div v-for="log in logs" :key="log.seq" class="font-mono text-xs leading-relaxed">
          <span class="text-gray-500">{{ formatTime(log.ts) }}</span>
          <span class="ml-2" :class="log.stream === 'stderr' ? 'text-red-400' : 'text-green-300'">{{ log.text }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
