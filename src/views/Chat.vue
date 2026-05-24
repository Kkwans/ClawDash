<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { gwRequest, authenticated, useGatewayEvent } from '../stores/gateway.js'
import Toast from '../components/Toast.vue'

const sessions = ref([])
const selectedSession = ref(null)
const messages = ref([])
const inputText = ref('')
const loading = ref(false)
const sending = ref(false)
const toastRef = ref(null)
const messagesContainer = ref(null)

function showToast(msg) {
  toastRef.value?.show(msg)
}

async function fetchSessions() {
  try {
    const res = await gwRequest('sessions.list', { limit: 50 })
    sessions.value = res?.sessions || []
  } catch (e) {
    console.error('Failed to fetch sessions:', e)
  }
}

async function selectSession(session) {
  selectedSession.value = session
  messages.value = []
  loading.value = true
  try {
    const res = await gwRequest('chat.history', {
      sessionKey: session.key || session.id,
      limit: 100
    })
    messages.value = res?.messages || res || []
    nextTick(() => scrollToBottom())
  } catch (e) {
    showToast('加载消息失败: ' + e.message)
  }
  loading.value = false
}

async function sendMessage() {
  if (!inputText.value.trim() || !selectedSession.value || sending.value) return
  const text = inputText.value.trim()
  inputText.value = ''
  sending.value = true

  // 添加用户消息到列表
  messages.value.push({
    role: 'user',
    content: text,
    timestamp: Date.now()
  })
  nextTick(() => scrollToBottom())

  try {
    await gwRequest('chat.send', {
      sessionKey: selectedSession.value.key || selectedSession.value.id,
      message: text
    })
    // 等一下让 Agent 处理，然后刷新消息
    setTimeout(async () => {
      try {
        const res = await gwRequest('chat.history', {
          sessionKey: selectedSession.value.key || selectedSession.value.id,
          limit: 100
        })
        messages.value = res?.messages || res || []
        nextTick(() => scrollToBottom())
      } catch (e) {
        // ignore
      }
    }, 2000)
  } catch (e) {
    showToast('发送失败: ' + e.message)
  }
  sending.value = false
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

function formatTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function getRoleLabel(role) {
  const map = { user: '👤 用户', assistant: '🤖 Agent', system: '⚙️ 系统', tool: '🔧 工具' }
  return map[role] || role
}

function getRoleClass(role) {
  const map = {
    user: 'bg-blue-50 border-blue-200',
    assistant: 'bg-green-50 border-green-200',
    system: 'bg-gray-50 border-gray-200',
    tool: 'bg-amber-50 border-amber-200'
  }
  return map[role] || 'bg-gray-50 border-gray-200'
}

// 监听新消息事件
useGatewayEvent('message', () => {
  if (selectedSession.value) {
    // 延迟刷新消息
    setTimeout(async () => {
      try {
        const res = await gwRequest('chat.history', {
          sessionKey: selectedSession.value.key || selectedSession.value.id,
          limit: 100
        })
        messages.value = res?.messages || res || []
        nextTick(() => scrollToBottom())
      } catch (e) { /* ignore */ }
    }, 500)
  }
})

watch(authenticated, (val) => {
  if (val) fetchSessions()
}, { immediate: true })
</script>

<template>
  <div class="flex h-[calc(100vh-8rem)] gap-4">
    <!-- 共享组件 -->
    <Toast ref="toastRef" />

    <!-- 会话列表 -->
    <div class="w-64 flex-shrink-0 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
      <div class="p-3 border-b border-gray-100">
        <h3 class="text-sm font-semibold text-gray-700">会话列表</h3>
        <p class="text-xs text-gray-400 mt-0.5">{{ sessions.length }} 个会话</p>
      </div>
      <div class="flex-1 overflow-y-auto">
        <div v-if="sessions.length === 0" class="text-center py-8 text-gray-400 text-xs">
          暂无会话
        </div>
        <div v-for="s in sessions" :key="s.key || s.id"
          @click="selectSession(s)"
          class="px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50"
          :class="{ 'bg-blue-50 border-blue-100': selectedSession?.key === s.key }">
          <p class="text-xs font-medium text-gray-800 truncate">{{ s.key || s.id || '未知' }}</p>
          <div class="flex items-center gap-2 mt-0.5">
            <span class="text-xs text-gray-400">{{ s.kind || '-' }}</span>
            <span v-if="s.model" class="text-xs text-gray-400">{{ s.model }}</span>
          </div>
        </div>
      </div>
      <div class="p-2 border-t border-gray-100">
        <button @click="fetchSessions" class="w-full py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
          刷新
        </button>
      </div>
    </div>

    <!-- 聊天区域 -->
    <div class="flex-1 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
      <!-- 未选择会话 -->
      <div v-if="!selectedSession" class="flex-1 flex items-center justify-center">
        <div class="text-center">
          <span class="text-4xl mb-3 block">💬</span>
          <p class="text-sm text-gray-500">选择一个会话开始聊天</p>
        </div>
      </div>

      <!-- 聊天界面 -->
      <template v-else>
        <!-- 会话头 -->
        <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p class="text-sm font-semibold text-gray-800">{{ selectedSession.key || selectedSession.id }}</p>
            <p class="text-xs text-gray-400">{{ selectedSession.model || '-' }} · {{ selectedSession.kind || '-' }}</p>
          </div>
          <button @click="selectedSession = null; messages = []"
            class="text-gray-400 hover:text-gray-600 text-sm">✕</button>
        </div>

        <!-- 消息列表 -->
        <div ref="messagesContainer" class="flex-1 overflow-y-auto p-4 space-y-3">
          <div v-if="loading" class="text-center py-8">
            <div class="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
          </div>
          <div v-else-if="messages.length === 0" class="text-center py-8 text-gray-400 text-sm">
            暂无消息
          </div>
          <div v-for="(msg, i) in messages" :key="i"
            class="rounded-xl border p-3 max-w-[80%]"
            :class="[getRoleClass(msg.role), msg.role === 'user' ? 'ml-auto' : '']">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs font-medium text-gray-600">{{ getRoleLabel(msg.role) }}</span>
              <span class="text-xs text-gray-400">{{ formatTime(msg.timestamp) }}</span>
            </div>
            <p class="text-sm text-gray-700 whitespace-pre-wrap break-words">{{ msg.content || msg.text || '' }}</p>
          </div>
        </div>

        <!-- 输入框 -->
        <div class="p-3 border-t border-gray-100">
          <div class="flex gap-2">
            <input v-model="inputText" @keyup.enter="sendMessage"
              placeholder="输入消息..."
              :disabled="sending"
              class="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50">
            <button @click="sendMessage" :disabled="!inputText.trim() || sending"
              class="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-all">
              {{ sending ? '发送中...' : '发送' }}
            </button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
