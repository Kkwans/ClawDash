<script setup>
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from 'vue'
import { gwRequest, eventLog as storeEventLog } from '../stores/gateway.js'
import AppToast from '../components/AppToast.vue'

import { createLogger } from '../utils/logger.js'
import { exportEventLog } from '../utils/export.js'

const log = createLogger('Sessions')

// 入场动画状态
const entered = ref(false)
onMounted(() => { nextTick(() => { entered.value = true }) })
const healthData = ref(null)
const loading = ref(true)
const toastRef = ref(null)
// 使用 store 的 eventLog（已含 ID 和 localStorage 持久化）
const eventLog = storeEventLog
const autoScroll = ref(true)
const logContainer = ref(null)
const filterText = ref('')

// 新事件自动滚动
watch(() => eventLog.value.length, () => {
  if (autoScroll.value) nextTick(() => scrollToBottom())
})

async function fetchHealth() {
  try {
    healthData.value = await gwRequest('health')
  } catch (e) {
    log.warn('加载健康状态失败:', e)
  }
  loading.value = false
}

function showToast(msg, type = 'info') {
  toastRef.value?.show(msg, type)
}

function clearLog() {
  eventLog.value = []
  showToast('日志已清空')
}

function scrollToBottom() {
  if (logContainer.value) {
    logContainer.value.scrollTop = logContainer.value.scrollHeight
  }
}

function handleScroll() {
  if (!logContainer.value) return
  const { scrollTop, scrollHeight, clientHeight } = logContainer.value
  autoScroll.value = scrollHeight - scrollTop - clientHeight < 50
}

function formatTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 1 })
}

const eventColors = {
  'connected': 'text-green-400',
  'connect.challenge': 'text-blue-400',
  'auth-error': 'text-red-400',
  'session.started': 'text-emerald-400',
  'session.ended': 'text-gray-400',
  'tool.start': 'text-yellow-400',
  'tool.end': 'text-yellow-300',
  'message': 'text-cyan-400',
  'error': 'text-red-400',
}

function getEventColor(event) {
  return eventColors[event] || 'text-gray-300'
}

function formatPayload(payload) {
  if (!payload) return ''
  try {
    const str = JSON.stringify(payload, null, 2)
    return str.length > 500 ? str.slice(0, 500) + '...' : str
  } catch (e) {
    log.error('Format payload failed:', e)
    return String(payload)
  }
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

async function copyEvent(e) {
  const text = `[${formatTime(e.time)}] ${e.event} ${JSON.stringify(e.payload || {}, null, 2)}`
  try {
    await navigator.clipboard.writeText(text)
    showToast('已复制到剪贴板')
  } catch (err) {
    log.warn('复制失败:', err)
  }
}

async function copyAllLogs() {
  const text = filteredLog.value.map(e =>
    `[${formatTime(e.time)}] ${e.event} ${JSON.stringify(e.payload || {})}`
  ).join('\n')
  try {
    await navigator.clipboard.writeText(text)
    showToast(`已复制 ${filteredLog.value.length} 条日志`)
  } catch (err) {
    log.warn('复制失败:', err)
  }
}

function highlightText(text, query) {
  if (!query || !text) return escapeHtml(text || '')
  const safeText = escapeHtml(text)
  const safeQuery = escapeHtml(query)
  const escaped = safeQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  return safeText.replace(regex, '<mark class="bg-yellow-300/40 text-yellow-200 rounded px-0.5">$1</mark>')
}

function highlightJson(payload, query) {
  if (!payload) return ''
  try {
    const str = JSON.stringify(payload, null, 2)
    const truncated = str.length > 500 ? str.slice(0, 500) + '...' : str
    // Syntax highlight
    let html = truncated
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"([^"\\]*(\\.[^"\\]*)*)"(?=\s*:)/g, '<span class="text-blue-300">"$1"</span>')
      .replace(/:\s*"([^"\\]*(\\.[^"\\]*)*)"/g, ': <span class="text-emerald-300">"$1"</span>')
      .replace(/:\s*(\d+\.?\d*)/g, ': <span class="text-amber-300">$1</span>')
      .replace(/:\s*(true|false|null)/g, ': <span class="text-purple-300">$1</span>')
    // Keyword highlight
    if (query) {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`(${escaped})`, 'gi')
      html = html.replace(regex, '<mark class="bg-yellow-300/40 text-yellow-200 rounded px-0.5">$1</mark>')
    }
    return html
  } catch (e) {
    log.error('Highlight JSON failed:', e)
    return String(payload)
  }
}

const filteredLog = computed(() => {
  if (!filterText.value.trim()) return eventLog.value
  const q = filterText.value.toLowerCase()
  return eventLog.value.filter(e =>
    e.event.toLowerCase().includes(q) ||
    JSON.stringify(e.payload).toLowerCase().includes(q)
  )
})

const uniqueEvents = computed(() => {
  const counts = {}
  eventLog.value.forEach(e => {
    counts[e.event] = (counts[e.event] || 0) + 1
  })
  return Object.entries(counts).sort((a, b) => b[1] - a[1])
})

let timer
function startPolling() {
  clearInterval(timer)
  timer = setInterval(() => {
    if (!document.hidden) fetchHealth()
  }, 30000)
}
function onVisibilityChange() {
  if (document.hidden) {
    clearInterval(timer)
  } else {
    fetchHealth()
    startPolling()
  }
}
onMounted(() => {
  fetchHealth()
  startPolling()
  document.addEventListener('visibilitychange', onVisibilityChange)
})
onUnmounted(() => {
  clearInterval(timer)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<template>
  <div class="space-y-6">
    <!-- 共享组件 -->
    <AppToast ref="toastRef" />

    <!-- 页面标题 -->
    <div class="sessions-section" :class="{ 'sessions-enter': entered }" style="--delay: 0ms">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold text-gray-900">日志查看</h2>
          <p class="text-sm text-gray-500 mt-0.5">实时 Gateway 事件流</p>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-400">{{ eventLog.length }} 条事件</span>
          <div class="relative group">
            <button class="px-3 py-1.5 text-xs text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors">
              📥 导出
            </button>
            <div class="absolute right-0 top-full mt-1 w-28 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button @click="exportEventLog(eventLog, 'json')" class="w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded-t-lg text-left">JSON</button>
              <button @click="exportEventLog(eventLog, 'csv')" class="w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded-b-lg text-left">CSV</button>
            </div>
          </div>
          <button @click="clearLog" class="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
            清空
          </button>
          <button @click="copyAllLogs" class="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
            复制全部
          </button>
        </div>
      </div>
    </div>

    <!-- Gateway 健康状态 -->
    <div v-if="healthData" class="sessions-section" :class="{ 'sessions-enter': entered }" style="--delay: 80ms">
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-sm font-semibold text-gray-700">Gateway 状态</span>
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
            :class="healthData.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'">
            {{ healthData.ok ? '正常' : '异常' }}
          </span>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <p class="text-gray-400">会话数</p>
            <p class="font-medium text-gray-700">{{ healthData.sessions?.length || 0 }}</p>
          </div>
          <div>
            <p class="text-gray-400">事件循环</p>
            <p class="font-medium" :class="healthData.eventLoop?.degraded ? 'text-amber-600' : 'text-green-600'">
              {{ healthData.eventLoop?.degraded ? '降级' : '正常' }}
            </p>
          </div>
          <div>
            <p class="text-gray-400">渠道数</p>
            <p class="font-medium text-gray-700">{{ healthData.channelOrder?.length || 0 }}</p>
          </div>
          <div>
            <p class="text-gray-400">心跳间隔</p>
            <p class="font-medium text-gray-700">{{ healthData.heartbeatSeconds || '-' }}s</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 事件统计 -->
    <div v-if="uniqueEvents.length > 0" class="sessions-section" :class="{ 'sessions-enter': entered }" style="--delay: 160ms">
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <p class="text-xs font-medium text-gray-500 mb-2">事件类型统计</p>
        <div class="flex flex-wrap gap-1.5">
          <span v-for="[event, count] in uniqueEvents" :key="event"
            class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-gray-50 border border-gray-100 cursor-pointer hover:bg-gray-100"
            @click="filterText = event">
            <span :class="getEventColor(event)">●</span>
            <span class="text-gray-700">{{ event }}</span>
            <span class="text-gray-400">{{ count }}</span>
          </span>
        </div>
      </div>
    </div>

    <!-- 日志查看器 -->
    <div class="sessions-section" :class="{ 'sessions-enter': entered }" style="--delay: 240ms">
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <!-- 工具栏 -->
      <div class="flex items-center gap-3 p-3 border-b border-gray-100">
        <div class="relative flex-1">
          <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input v-model="filterText" placeholder="过滤事件..." autocomplete="off"
            aria-label="过滤事件"
            class="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500">
        </div>
        <label class="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
          <input type="checkbox" v-model="autoScroll" class="rounded" aria-label="自动滚动">
          自动滚动
        </label>
      </div>

      <!-- 日志内容 -->
      <div v-if="filteredLog.length === 0" class="text-center py-12 text-gray-400 text-sm">
        {{ filterText ? '无匹配事件' : '等待事件...' }}
      </div>
      <div v-else ref="logContainer" @scroll="handleScroll"
        class="bg-gray-900 p-3 overflow-x-auto max-h-[500px] overflow-y-auto">
        <div v-for="e in filteredLog" :key="e.id"
          class="font-mono text-xs leading-relaxed flex items-start gap-2 py-0.5 hover:bg-gray-800/50 px-1 rounded group">
          <span class="text-gray-500 flex-shrink-0 w-20">{{ formatTime(e.time) }}</span>
          <span class="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" :class="getEventColor(e.event).replace('text-', 'bg-')"></span>
          <span class="flex-shrink-0 w-32 truncate" :class="getEventColor(e.event)" v-html="highlightText(e.event, filterText)"></span>
          <span class="text-gray-400 break-all flex-1" v-html="highlightJson(e.payload, filterText)"></span>
          <button @click="copyEvent(e)" class="flex-shrink-0 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-300 transition-opacity px-1" title="复制">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
          </button>
        </div>
      </div>
    </div>
    </div>
  </div>
</template>

<style scoped>
/* 入场动画 */
.sessions-section {
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1),
              transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  transition-delay: var(--delay, 0ms);
}
.sessions-enter {
  opacity: 1;
  transform: translateY(0);
}
</style>
