<script setup>
import { ref, computed, onMounted } from 'vue'

const jobs = ref([])
const loading = ref(true)
const toast = ref('')
const editingJob = ref(null)
const saving = ref(false)
const showCreateModal = ref(false)
const newJob = ref({ name: '', schedule: '', payload: '', enabled: true })

// 从 Gateway 获取定时任务
async function fetchJobs() {
  loading.value = true
  try {
    const token = localStorage.getItem('clawdash_token') || ''
    // 通过 Gateway HTTP API 获取
    const res = await fetch('/api/v1/cron/jobs', {
      headers: { 'Authorization': token }
    })
    const data = await res.json()
    if (data.success) {
      jobs.value = Array.isArray(data.data) ? data.data : []
    }
  } catch (e) {
    console.error('Failed to fetch cron jobs:', e)
  }
  loading.value = false
}

function showToast(msg) {
  toast.value = msg
  setTimeout(() => toast.value = '', 3000)
}

async function toggleJob(job) {
  try {
    const token = localStorage.getItem('clawdash_token') || ''
    const res = await fetch(`/api/v1/cron/jobs/${job.id}`, {
      method: 'PATCH',
      headers: { 'Authorization': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !job.enabled })
    })
    const data = await res.json()
    if (data.success) {
      job.enabled = !job.enabled
      showToast(`${job.name || job.id} 已${job.enabled ? '启用' : '禁用'}`)
    } else {
      showToast(`操作失败: ${data.error}`)
    }
  } catch (e) {
    showToast(`操作失败: ${e.message}`)
  }
}

async function runJob(job) {
  try {
    const token = localStorage.getItem('clawdash_token') || ''
    const res = await fetch(`/api/v1/cron/jobs/${job.id}/run`, {
      method: 'POST',
      headers: { 'Authorization': token }
    })
    const data = await res.json()
    if (data.success) {
      showToast(`${job.name || job.id} 已触发执行`)
    } else {
      showToast(`执行失败: ${data.error}`)
    }
  } catch (e) {
    showToast(`执行失败: ${e.message}`)
  }
}

async function deleteJob(job) {
  if (!confirm(`确定要删除任务 "${job.name || job.id}" 吗？`)) return
  try {
    const token = localStorage.getItem('clawdash_token') || ''
    const res = await fetch(`/api/v1/cron/jobs/${job.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': token }
    })
    const data = await res.json()
    if (data.success) {
      showToast(`${job.name || job.id} 已删除`)
      await fetchJobs()
    } else {
      showToast(`删除失败: ${data.error}`)
    }
  } catch (e) {
    showToast(`删除失败: ${e.message}`)
  }
}

function formatSchedule(schedule) {
  if (!schedule) return '-'
  if (typeof schedule === 'string') return schedule
  if (schedule.kind === 'cron') return schedule.expr || '-'
  if (schedule.kind === 'every') return `每 ${(schedule.everyMs / 60000).toFixed(0)} 分钟`
  if (schedule.kind === 'at') return new Date(schedule.at).toLocaleString('zh-CN')
  return JSON.stringify(schedule)
}

function formatPayload(payload) {
  if (!payload) return '-'
  if (typeof payload === 'string') return payload
  if (payload.kind === 'systemEvent') return `系统事件: ${(payload.text || '').slice(0, 50)}`
  if (payload.kind === 'agentTurn') return `Agent 执行: ${(payload.message || '').slice(0, 50)}`
  return JSON.stringify(payload).slice(0, 50)
}

const enabledCount = computed(() => jobs.value.filter(j => j.enabled !== false).length)

onMounted(fetchJobs)
</script>

<template>
  <div class="space-y-6">
    <!-- Toast -->
    <Transition name="fade">
      <div v-if="toast" class="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
        {{ toast }}
      </div>
    </Transition>

    <!-- 页面标题 -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-bold text-gray-900">定时任务</h2>
        <p class="text-sm text-gray-500 mt-0.5">管理 Cron 定时任务</p>
      </div>
      <div class="flex items-center gap-2">
        <button @click="fetchJobs" class="px-3 py-1.5 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
          刷新
        </button>
      </div>
    </div>

    <!-- 统计 -->
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <div class="bg-white rounded-xl border border-gray-200 p-4 text-center">
        <p class="text-2xl font-bold text-blue-600">{{ jobs.length }}</p>
        <p class="text-xs text-gray-500 mt-1">任务总数</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4 text-center">
        <p class="text-2xl font-bold text-emerald-600">{{ enabledCount }}</p>
        <p class="text-xs text-gray-500 mt-1">已启用</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4 text-center">
        <p class="text-2xl font-bold text-gray-400">{{ jobs.length - enabledCount }}</p>
        <p class="text-xs text-gray-500 mt-1">已禁用</p>
      </div>
    </div>

    <!-- 帮助提示 -->
    <div class="bg-blue-50 border border-blue-200 rounded-xl p-4">
      <div class="flex items-start gap-2">
        <span class="text-blue-500 mt-0.5">💡</span>
        <div class="text-xs text-blue-700 space-y-1">
          <p><strong>Cron 表达式格式：</strong>分 时 日 月 周（如 <code class="bg-blue-100 px-1 rounded">0 */6 * * *</code> = 每 6 小时）</p>
          <p><strong>任务类型：</strong>系统事件（systemEvent）或 Agent 执行（agentTurn）</p>
        </div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="flex flex-col items-center gap-3">
        <div class="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        <span class="text-sm text-gray-400">加载中...</span>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else-if="jobs.length === 0" class="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
      <span class="text-4xl mb-4">⏰</span>
      <p class="text-sm font-medium text-gray-600">暂无定时任务</p>
      <p class="text-xs text-gray-400 mt-1">定时任务可通过 Gateway 或 Cron 管理工具创建</p>
    </div>

    <!-- 任务列表 -->
    <div v-else class="space-y-2">
      <div v-for="job in jobs" :key="job.id"
        class="bg-white rounded-xl border border-gray-200 p-4 transition-all hover:border-gray-300 hover:shadow-sm">
        <div class="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="text-sm font-semibold text-gray-900">{{ job.name || job.id }}</p>
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                :class="job.enabled !== false ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'">
                <span class="w-1.5 h-1.5 rounded-full" :class="job.enabled !== false ? 'bg-green-500' : 'bg-gray-400'"></span>
                {{ job.enabled !== false ? '已启用' : '已禁用' }}
              </span>
            </div>
            <div class="flex items-center gap-3 mt-1 text-xs text-gray-500">
              <span>📅 {{ formatSchedule(job.schedule) }}</span>
              <span>📝 {{ formatPayload(job.payload) }}</span>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <button @click="runJob(job)"
              class="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all">
              ▶ 执行
            </button>
            <button @click="toggleJob(job)"
              class="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
              :class="job.enabled !== false
                ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                : 'bg-green-50 text-green-600 hover:bg-green-100'">
              {{ job.enabled !== false ? '禁用' : '启用' }}
            </button>
            <button @click="deleteJob(job)"
              class="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all">
              删除
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
