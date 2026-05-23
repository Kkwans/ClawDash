<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const sessions = ref([])
const loading = ref(true)
const toast = ref('')
const selectedSession = ref(null)
const refreshing = ref(false)

async function fetchSessions() {
  loading.value = true
  try {
    const token = localStorage.getItem('clawdash_token') || ''
    // 通过 Gateway HTTP API 获取会话列表
    const res = await fetch('/api/v1/sessions', {
      headers: { 'Authorization': token }
    })
    const data = await res.json()
    if (data.success) {
      sessions.value = Array.isArray(data.data) ? data.data : []
    }
  } catch (e) {
    console.error('Failed to fetch sessions:', e)
  }
  loading.value = false
}

async function refreshSessions() {
  refreshing.value = true
  await fetchSessions()
  refreshing.value = false
}

function showToast(msg) {
  toast.value = msg
  setTimeout(() => toast.value = '', 3000)
}

function formatTime(ts) {
  if (!ts) return '-'
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}

function formatDuration(ms) {
  if (!ms) return '-'
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  if (hours > 0) return `${hours}小时 ${minutes % 60}分钟`
  if (minutes > 0) return `${minutes}分钟`
  return `${seconds}秒`
}

const activeSessions = computed(() => sessions.value.filter(s => s.state === 'active' || s.state === 'running'))
const idleSessions = computed(() => sessions.value.filter(s => s.state === 'idle'))
const otherSessions = computed(() => sessions.value.filter(s => s.state !== 'active' && s.state !== 'running' && s.state !== 'idle'))

let timer
onMounted(() => {
  fetchSessions()
  timer = setInterval(fetchSessions, 10000)
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

    <!-- 页面标题 -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-bold text-gray-900">会话管理</h2>
        <p class="text-sm text-gray-500 mt-0.5">查看和管理活跃会话</p>
      </div>
      <button @click="refreshSessions" :disabled="refreshing"
        class="px-3 py-1.5 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
        {{ refreshing ? '刷新中...' : '刷新' }}
      </button>
    </div>

    <!-- 统计 -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="bg-white rounded-xl border border-gray-200 p-4 text-center">
        <p class="text-2xl font-bold text-blue-600">{{ sessions.length }}</p>
        <p class="text-xs text-gray-500 mt-1">总会话数</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4 text-center">
        <p class="text-2xl font-bold text-emerald-600">{{ activeSessions.length }}</p>
        <p class="text-xs text-gray-500 mt-1">活跃中</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4 text-center">
        <p class="text-2xl font-bold text-amber-600">{{ idleSessions.length }}</p>
        <p class="text-xs text-gray-500 mt-1">空闲</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4 text-center">
        <p class="text-2xl font-bold text-gray-400">{{ otherSessions.length }}</p>
        <p class="text-xs text-gray-500 mt-1">其他</p>
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
    <div v-else-if="sessions.length === 0" class="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
      <span class="text-4xl mb-4">💬</span>
      <p class="text-sm font-medium text-gray-600">暂无活跃会话</p>
      <p class="text-xs text-gray-400 mt-1">当有用户与 Agent 交互时，会话将显示在这里</p>
    </div>

    <!-- 会话列表 -->
    <div v-else class="space-y-2">
      <div v-for="session in sessions" :key="session.id || session.key"
        class="bg-white rounded-xl border border-gray-200 p-4 transition-all hover:border-gray-300 hover:shadow-sm"
        :class="{ 'ring-1 ring-blue-200': selectedSession === session.id }"
        @click="selectedSession = selectedSession === session.id ? null : session.id">
        <div class="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="text-sm font-semibold text-gray-900">{{ session.label || session.id || session.key || '未知会话' }}</p>
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                :class="{
                  'bg-green-50 text-green-700': session.state === 'active' || session.state === 'running',
                  'bg-amber-50 text-amber-700': session.state === 'idle',
                  'bg-gray-100 text-gray-500': !['active', 'running', 'idle'].includes(session.state)
                }">
                <span class="w-1.5 h-1.5 rounded-full"
                  :class="{
                    'bg-green-500': session.state === 'active' || session.state === 'running',
                    'bg-amber-500': session.state === 'idle',
                    'bg-gray-400': !['active', 'running', 'idle'].includes(session.state)
                  }"></span>
                {{ session.state === 'active' ? '活跃' : session.state === 'running' ? '运行中' : session.state === 'idle' ? '空闲' : session.state || '未知' }}
              </span>
              <span v-if="session.kind" class="text-xs text-gray-400 px-1.5 py-0.5 bg-gray-100 rounded">
                {{ session.kind }}
              </span>
            </div>
            <div class="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
              <span v-if="session.model">🤖 {{ session.model }}</span>
              <span v-if="session.lastActivityAt">🕐 {{ formatTime(session.lastActivityAt) }}</span>
              <span v-if="session.messageCount">💬 {{ session.messageCount }} 条消息</span>
              <span v-if="session.tokenUsage">🔤 {{ session.tokenUsage.toLocaleString() }} tokens</span>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <button @click.stop="selectedSession = session.id"
              class="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all">
              详情
            </button>
          </div>
        </div>

        <!-- 展开详情 -->
        <div v-if="selectedSession === session.id" class="mt-3 pt-3 border-t border-gray-100">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div v-if="session.id">
              <p class="text-xs text-gray-400">会话 ID</p>
              <p class="text-sm font-mono text-gray-700 truncate">{{ session.id }}</p>
            </div>
            <div v-if="session.key">
              <p class="text-xs text-gray-400">会话 Key</p>
              <p class="text-sm font-mono text-gray-700 truncate">{{ session.key }}</p>
            </div>
            <div v-if="session.createdAt">
              <p class="text-xs text-gray-400">创建时间</p>
              <p class="text-sm text-gray-700">{{ formatTime(session.createdAt) }}</p>
            </div>
            <div v-if="session.duration">
              <p class="text-xs text-gray-400">持续时间</p>
              <p class="text-sm text-gray-700">{{ formatDuration(session.duration) }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
