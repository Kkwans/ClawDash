/**
 * Gateway Store - Vue 3 响应式状态
 * 管理 WebSocket 连接状态、Gateway 信息和事件分发
 */

import { ref, computed, onUnmounted, shallowRef, getCurrentInstance } from 'vue'
import gateway, { getToken, setToken } from '../api/gateway.js'
import { createLogger } from '../utils/logger.js'

const log = createLogger('Store')

// --- 连接状态 ---
export const connected = gateway.connected
export const authenticated = gateway.authenticated
export const connecting = gateway.connecting
export const connectionError = gateway.error
export const reconnecting = gateway.reconnecting
export const reconnectAttempts = gateway.reconnectAttempts

// --- Gateway 信息 ---
export const gatewayInfo = ref(null)
export const gatewayHealth = ref(null)

// --- 事件日志（响应式） ---
export const eventLog = ref([])
const EVENT_LOG_MAX = 500
const EVENT_LOG_STORAGE_KEY = 'clawdash_event_log'

// 从 localStorage 恢复日志
function loadEventLogFromStorage() {
  try {
    const saved = localStorage.getItem(EVENT_LOG_STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) eventLog.value = parsed.slice(-EVENT_LOG_MAX)
    }
  } catch (e) { /* ignore */ }
}

// 保存日志到 localStorage（节流）
let _saveTimer = null
function saveEventLogToStorage() {
  clearTimeout(_saveTimer)
  _saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(EVENT_LOG_STORAGE_KEY, JSON.stringify(eventLog.value.slice(-EVENT_LOG_MAX)))
    } catch (e) { /* ignore */ }
  }, 1000)
}

// 初始化时加载
loadEventLogFromStorage()

// --- Token ---
export const token = ref(getToken())

export function updateToken(newToken) {
  token.value = newToken
  setToken(newToken)
}

// --- 计算属性 ---
export const statusText = computed(() => {
  if (connecting.value) return '连接中...'
  if (reconnecting.value) return `重连中 (第 ${reconnectAttempts.value} 次)...`
  if (connectionError.value) return `错误: ${connectionError.value}`
  if (authenticated.value) return '已连接'
  if (connected.value) return '等待认证...'
  return '未连接'
})

export const statusColor = computed(() => {
  if (authenticated.value) return 'green'
  if (connecting.value || reconnecting.value || connected.value) return 'yellow'
  return 'red'
})

// --- 操作 ---
export function connect() {
  gateway.connect()
}

export function disconnect() {
  gateway.disconnect()
}

export function reconnect() {
  gateway.reconnect()
}

export function cancelReconnect() {
  gateway.cancelReconnect()
}

/**
 * 发送 Gateway 请求
 */
export async function gwRequest(method, params = {}, timeout) {
  return gateway.request(method, params, timeout)
}

/**
 * 获取事件日志
 * @param {number} limit - 最多条数
 */
export function getEventLog(limit) {
  return gateway.getEventLog(limit)
}

/**
 * 清空事件日志
 */
export function clearEventLog() {
  gateway.clearEventLog()
  eventLog.value = []
}

// --- Vue Composable: useGatewayEvent ---
// 自动在组件卸载时取消监听，防止内存泄漏

/**
 * 在 Vue 组件中监听 Gateway 事件，卸载时自动清理
 *
 * @param {string} eventName - 事件名，'*' 监听所有
 * @param {function} handler - 回调 (payload, eventName)
 * @returns {{ stop: function }} 手动停止监听
 *
 * @example
 * // 组件内
 * import { useGatewayEvent } from '../stores/gateway.js'
 *
 * // 监听特定事件
 * useGatewayEvent('connected', (payload) => {
 *   console.log('Gateway 连接成功:', payload)
 * })
 *
 * // 监听所有事件（通配符）
 * useGatewayEvent('*', (payload, event) => {
 *   console.log('收到事件:', event, payload)
 * })
 */
export function useGatewayEvent(eventName, handler) {
  const off = gateway.on(eventName, handler)
  // 如果在 Vue 组件 setup 上下文中，卸载时自动清理
  if (getCurrentInstance()) {
    onUnmounted(off)
  }
  return { stop: off }
}

// --- 初始化：监听核心事件并同步状态 ---

gateway.on('connected', (payload) => {
  gatewayInfo.value = payload
  syncEventLog()
  log.info('Gateway 已连接:', payload)
})

gateway.on('auth-error', (payload) => {
  syncEventLog()
  log.error('认证失败:', payload)
})

// 所有事件变化时同步事件日志（通配符）
gateway.on('*', (payload, eventName) => {
  // 向响应式 eventLog 推送带 ID 的事件
  eventLog.value.push({
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    event: eventName,
    payload,
    time: Date.now()
  })
  if (eventLog.value.length > EVENT_LOG_MAX) {
    eventLog.value.splice(0, eventLog.value.length - EVENT_LOG_MAX)
  }
  saveEventLogToStorage()
})
