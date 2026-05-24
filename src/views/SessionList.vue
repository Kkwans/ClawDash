<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { gwRequest, authenticated } from '../stores/gateway.js'

const sessions = ref([])
const loading = ref(true)
const toast = ref('')
const selectedSession = ref(null)
const refreshing = ref(false)
const confirmDialog = ref({ show: false, msg: '', onOk: null })

function showConfirm(msg) {
  return new Promise(resolve => {
    confirmDialog.value = { show: true, msg, onOk: () => { confirmDialog.value.show = false; resolve(true) } }
  })
}
function cancelConfirm() { confirmDialog.value.show = false }

async function resetSession(session) {
  const ok = await showConfirm(`确定重置会话 ${session.key || session.id}？`)
  if (!ok) return
  try {
    await gwRequest('sessions.reset', { sessionKey: session.key || session.id })
    showToast(`会话 ${session.key || session.id} 已重置`)
    await fetchSessions()
  } catch (e) {
    showToast(`重置失败: ${e.message}`)
  }
}

async function fetchSessions() {
  loading.value = true
  try {
    const res = await gwRequest('sessions.list', { limit: 100 })
    sessions.value = res?.sessions || []
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

const activeSessions = computed(() => sessions.value.filter(s => s.status === 'active' || s.status === 'running' || s.status === 'streaming'))
const idleSessions = computed(() => sessions.value.filter(s => s.status === 'done' || s.status === 'idle'))
const otherSessions = computed(() => sessions.value.filter(s => !['active', 'running', 'streaming', 'done', 'idle'].includes(s.status)))

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

    <!-- 确认弹窗 -->
    <div v-if="confirmDialog.show" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl">
        <p class="text-sm text-gray-700 mb-5">{{ confirmDialog.msg }}</p>
        <div class="flex gap-2 justify-end">
          <button @click="cancelConfirm" class="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">取消</button>
          <button @click="confirmDialog.onOk" class="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700">确定</button>
        </div>
      </div>
    </div>

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
      <div v-for="session in sessions" :key="session.key || session.id"
        class="bg-white rounded-xl border border-gray-200 p-4 transition-all hover:border-gray-300 hover:shadow-sm"
        :class="{ 'ring-1 ring-blue-200': selectedSession === session.key }"
        @click="selectedSession = selectedSession === session.key ? null : session.key">
        <div class="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="text-sm font-semibold text-gray-900">{{ session.key || session.id || '未知会话' }}</p>
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                :class="{
                  'bg-green-50 text-green-700': session.status === 'active' || session.status === 'running' || session.status === 'streaming',
                  'bg-blue-50 text-blue-700': session.status === 'done',
                  'bg-gray-100 text-gray-500': !['active', 'running', 'streaming', 'done'].includes(session.status)
                }">
                <span class="w-1.5 h-1.5 rounded-full"
                  :class="{
                    'bg-green-500': session.status === 'active' || session.status === 'running' || session.status === 'streaming',
                    'bg-blue-500': session.status === 'done',
                    'bg-gray-400': !['active', 'running', 'streaming', 'done'].includes(session.status)
                  }"></span>
                {{ session.status === 'active' ? '活跃' : session.status === 'running' ? '运行中' : session.status === 'streaming' ? '输出中' : session.status === 'done' ? '完成' : session.status || '未知' }}
              </span>
              <span v-if="session.kind" class="text-xs text-gray-400 px-1.5 py-0.5 bg-gray-100 rounded">
                {{ session.kind }}
              </span>
              <span v-if="session.chatType" class="text-xs text-gray-400 px-1.5 py-0.5 bg-gray-100 rounded">
                {{ session.chatType }}
              </span>
            </div>
            <div class="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
              <span v-if="session.model">🤖 {{ session.model }}</span>
              <span v-if="session.totalTokens">🔤 {{ session.totalTokens.toLocaleString() }} tokens</span>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <button @click.stop="selectedSession = session.key"
              class="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all">
              详情
            </button>
            <button @click.stop="resetSession(session)"
              class="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-all">
              重置
            </button>
          </div>
        </div>

        <!-- 展开详情 -->
        <div v-if="selectedSession === session.key" class="mt-3 pt-3 border-t border-gray-100">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div v-if="session.key">
              <p class="text-xs text-gray-400">会话 Key</p>
              <p class="text-sm font-mono text-gray-700 truncate">{{ session.key }}</p>
            </div>
            <div v-if="session.model">
              <p class="text-xs text-gray-400">模型</p>
              <p class="text-sm text-gray-700">{{ session.model }}</p>
            </div>
            <div v-if="session.chatType">
              <p class="text-xs text-gray-400">类型</p>
              <p class="text-sm text-gray-700">{{ session.chatType }}</p>
            </div>
            <div v-if="session.totalTokens">
              <p class="text-xs text-gray-400">Token 用量</p>
              <p class="text-sm text-gray-700">{{ session.totalTokens.toLocaleString() }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
