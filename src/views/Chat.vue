<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { gwRequest, authenticated, useGatewayEvent } from '../stores/gateway.js'
import { renderMarkdown } from '../utils/markdown.js'
import AppToast from '../components/AppToast.vue'
import { createLogger } from '../utils/logger.js'
// highlight.js CSS 在组件挂载时动态加载
const log = createLogger('Chat')

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
    log.warn('加载会话列表失败:', e)
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
        log.warn('刷新消息失败:', e)
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
    user: 'msg-user',
    assistant: 'msg-assistant',
    system: 'msg-system',
    tool: 'msg-tool'
  }
  return map[role] || 'msg-system'
}

function getRoleAlign(role) {
  return role === 'user' ? 'msg-right' : 'msg-left'
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
      } catch (e) { log.warn('加载消息失败:', e) }
    }, 500)
  }
})

watch(authenticated, (val) => {
  if (val) fetchSessions()
}, { immediate: true })

// 动态加载 highlight.js CSS
onMounted(() => {
  import('highlight.js/styles/github.css')
})
</script>

<template>
  <div class="flex h-[calc(100vh-8rem)] gap-4">
    <!-- 共享组件 -->
    <AppToast ref="toastRef" />

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
        <div ref="messagesContainer" class="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col">
          <div v-if="loading" class="text-center py-8">
            <div class="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
          </div>
          <div v-else-if="messages.length === 0" class="text-center py-8 text-gray-400 text-sm">
            暂无消息
          </div>
          <div v-for="(msg, i) in messages" :key="i"
            class="msg-bubble"
            :class="[getRoleClass(msg.role), getRoleAlign(msg.role)]">
            <div class="msg-header">
              <span class="msg-role">{{ getRoleLabel(msg.role) }}</span>
              <span class="msg-time">{{ formatTime(msg.timestamp) }}</span>
            </div>
            <div v-if="msg.role === 'user'" class="msg-text">{{ msg.content || msg.text || '' }}</div>
            <div v-else class="msg-markdown" v-html="renderMarkdown(msg.content || msg.text || '')"></div>
          </div>
        </div>

        <!-- 输入框 -->
        <div class="p-3 border-t border-gray-100">
          <div class="flex gap-2">
            <input v-model="inputText" @keyup.enter="sendMessage"
              placeholder="输入消息..."
              aria-label="输入消息"
              :disabled="sending"
              autocomplete="off"
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

<style scoped>
/* Message bubbles */
.msg-bubble {
  max-width: 80%;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--bg-panel);
}
.msg-left { align-self: flex-start; }
.msg-right { align-self: flex-end; }
.msg-user {
  background: var(--brand-lighter);
  border-color: oklch(0.88 0.04 260);
}
.msg-assistant { background: var(--bg-panel); border-color: var(--border); }
.msg-system { background: var(--bg-subtle); border-color: var(--border); }
.msg-tool { background: var(--warning-light); border-color: oklch(0.9 0.04 75); }
.msg-header { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-1-5); }
.msg-role { font-size: var(--text-xs); font-weight: var(--font-medium); color: var(--text-secondary); }
.msg-time { font-size: 11px; color: var(--text-tertiary); }
.msg-text { font-size: var(--text-sm); color: var(--text-primary); white-space: pre-wrap; word-break: break-word; line-height: var(--leading-relaxed); }

/* Markdown content */
.msg-markdown { font-size: var(--text-sm); color: var(--text-primary); line-height: var(--leading-relaxed); }
.msg-markdown :deep(p) { margin: 0 0 var(--space-2); }
.msg-markdown :deep(p:last-child) { margin-bottom: 0; }
.msg-markdown :deep(code) { font-family: var(--font-mono); font-size: 0.85em; background: var(--bg-muted); padding: 1px 4px; border-radius: var(--radius-sm); }
.msg-markdown :deep(pre) { margin: var(--space-2) 0; padding: var(--space-3); background: oklch(0.15 0.005 240); border-radius: var(--radius-md); overflow-x: auto; }
.msg-markdown :deep(pre code) { color: oklch(0.9 0 0); background: transparent; padding: 0; font-size: var(--text-xs); line-height: 1.6; }
.msg-markdown :deep(ul), .msg-markdown :deep(ol) { margin: var(--space-2) 0; padding-left: var(--space-5); }
.msg-markdown :deep(li) { margin: var(--space-1) 0; }
.msg-markdown :deep(blockquote) { margin: var(--space-2) 0; padding: var(--space-2) var(--space-3); border-left: 3px solid var(--brand); background: var(--bg-subtle); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; color: var(--text-secondary); }
.msg-markdown :deep(table) { border-collapse: collapse; margin: var(--space-2) 0; width: 100%; }
.msg-markdown :deep(th), .msg-markdown :deep(td) { border: 1px solid var(--border); padding: var(--space-1-5) var(--space-2); text-align: left; font-size: var(--text-xs); }
.msg-markdown :deep(th) { background: var(--bg-subtle); font-weight: var(--font-semibold); }
.msg-markdown :deep(a) { color: var(--text-link); text-decoration: underline; }
.msg-markdown :deep(h1), .msg-markdown :deep(h2), .msg-markdown :deep(h3) { margin: var(--space-3) 0 var(--space-2); font-weight: var(--font-semibold); }
.msg-markdown :deep(hr) { border: none; border-top: 1px solid var(--border); margin: var(--space-3) 0; }
</style>
