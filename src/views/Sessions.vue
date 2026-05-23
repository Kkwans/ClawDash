<script setup>
import { ref, onMounted } from 'vue'
import { getProcessStatus, getProcessLogs } from '../api'

const status = ref({})
const logs = ref([])
const loading = ref(true)
const logLimit = ref(50)

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

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

onMounted(() => {
  fetchStatus()
  fetchLogs()
})
</script>

<template>
  <div class="space-y-6">
    <!-- 进程状态 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 class="text-base font-semibold text-gray-800 mb-4">进程状态</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="text-center">
          <p class="text-xs text-gray-400">状态</p>
          <p class="text-lg font-bold" :class="status.state === 'running' ? 'text-green-600' : 'text-red-500'">
            {{ status.state === 'running' ? '运行中' : status.state || '-' }}
          </p>
        </div>
        <div class="text-center">
          <p class="text-xs text-gray-400">PID</p>
          <p class="text-lg font-bold text-gray-800">{{ status.pid || '-' }}</p>
        </div>
        <div class="text-center">
          <p class="text-xs text-gray-400">重启次数</p>
          <p class="text-lg font-bold text-gray-800">{{ status.restartCount || 0 }}</p>
        </div>
        <div class="text-center">
          <p class="text-xs text-gray-400">CPU</p>
          <p class="text-lg font-bold text-gray-800">{{ (status.cpuPercent || 0).toFixed(1) }}%</p>
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
