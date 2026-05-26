/**
 * GatewayClient - WebSocket 客户端
 * 直接连接 OpenClaw Gateway (ws://host:19001/)
 *
 * 协议 v4:
 *   握手: Gateway → connect.challenge({nonce}) → 客户端 connect → res(ok)
 *   请求: {type:"req", id, method, params}
 *   响应: {type:"res", id, ok, payload|error}
 *   事件: {type:"event", event, payload}
 */

import { ref } from 'vue'
import { createLogger } from '../utils/logger.js'

const log = createLogger('GW')

// --- Token 管理 ---
const TOKEN_KEY = 'clawdash_gateway_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

// --- 生成唯一 ID ---
let _reqId = 0
function nextId() {
  return `cd-${++_reqId}-${Date.now()}`
}

// --- GatewayClient 类 ---
class GatewayClient {
  constructor() {
    // 状态
    this.ws = null
    this.connected = ref(false)
    this.authenticated = ref(false)
    this.connecting = ref(false)
    this.error = ref(null)
    this.hello = ref(null)

    // 请求回调 Map<id, {resolve, reject, timer}>
    this._pending = new Map()

    // 事件监听器 Map<eventName, Set<callback>>
    this._listeners = new Map()

    // 事件日志缓冲区（最近 N 条，用于日志查看器）
    this._eventLog = []
    this._eventLogMax = 200

    // 重连
    this._reconnectTimer = null
    this._reconnectDelay = 1000
    this._maxReconnectDelay = 30000
    this._shouldReconnect = true
    this._manualClose = false
    this.reconnecting = ref(false)
    this.reconnectAttempts = ref(0)
    this._connectSent = false
    this._connectNonce = null
    this._connectReqId = null
  }

  /**
   * 连接 Gateway
   */
  connect() {
    // 通过 nginx /ws 代理连接 Gateway
    const wsUrl = `ws://${location.host}/ws`

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return
    }

    this.connecting.value = true
    this.error.value = null
    this._manualClose = false
    this._connectSent = false
    this._connectNonce = null
    this._connectReqId = null

    try {
      this.ws = new WebSocket(wsUrl)
    } catch (e) {
      this.error.value = `WebSocket 创建失败: ${e.message}`
      this.connecting.value = false
      this._scheduleReconnect()
      return
    }

    this.ws.onopen = () => {
      log.info('WebSocket 已连接，等待 challenge...')
      this.connected.value = true
      this.connecting.value = false
      this.reconnecting.value = false
      this._reconnectDelay = 1000
      this.reconnectAttempts.value = 0
    }

    this.ws.onmessage = (evt) => {
      this._handleMessage(evt.data)
    }

    this.ws.onerror = (evt) => {
      log.error('WebSocket 错误:', evt)
      this.error.value = 'WebSocket 连接错误'
    }

    this.ws.onclose = (evt) => {
      log.info('WebSocket 断开:', evt.code, evt.reason)
      this.connected.value = false
      this.authenticated.value = false
      this.connecting.value = false
      this._connectSent = false
      this._connectNonce = null
      this._connectReqId = null

      // 清理所有 pending 请求
      for (const [id, entry] of this._pending) {
        clearTimeout(entry.timer)
        entry.reject(new Error('连接已断开'))
      }
      this._pending.clear()

      if (!this._manualClose && this._shouldReconnect) {
        this.reconnecting.value = true
        this._scheduleReconnect()
      }
    }
  }

  /**
   * 断开连接
   */
  disconnect() {
    this._manualClose = true
    this._shouldReconnect = false
    clearTimeout(this._reconnectTimer)
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.connected.value = false
    this.authenticated.value = false
  }

  /**
   * 发送请求并等待响应
   * @param {string} method - 方法名
   * @param {object} params - 参数
   * @param {number} timeout - 超时毫秒数
   * @returns {Promise<any>} payload
   */
  request(method, params = {}, timeout = 15000) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('未连接到 Gateway'))
        return
      }

      const id = nextId()
      const msg = { type: 'req', id, method, params }

      const timer = setTimeout(() => {
        this._pending.delete(id)
        reject(new Error(`请求超时: ${method}`))
      }, timeout)

      this._pending.set(id, { resolve, reject, timer, method })

      try {
        this.ws.send(JSON.stringify(msg))
      } catch (e) {
        clearTimeout(timer)
        this._pending.delete(id)
        reject(new Error(`发送失败: ${e.message}`))
      }
    })
  }

  /**
   * 监听事件
   * @param {string} event - 事件名，'*' 表示监听所有事件
   * @param {function} cb - 回调函数 (payload, eventName)
   * @returns {function} 取消监听函数
   */
  on(event, cb) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set())
    }
    this._listeners.get(event).add(cb)
    return () => this.off(event, cb)
  }

  /**
   * 监听一次事件（触发后自动移除）
   * @param {string} event - 事件名
   * @param {function} cb - 回调函数
   * @returns {function} 取消监听函数
   */
  once(event, cb) {
    const wrapper = (payload, eventName) => {
      this.off(event, wrapper)
      cb(payload, eventName)
    }
    return this.on(event, wrapper)
  }

  /**
   * 取消监听
   * @param {string} event - 事件名
   * @param {function} cb - 回调函数
   */
  off(event, cb) {
    const set = this._listeners.get(event)
    if (set) {
      set.delete(cb)
      if (set.size === 0) this._listeners.delete(event)
    }
  }

  /**
   * 获取事件日志
   * @param {number} limit - 最多返回条数
   * @returns {Array<{event, payload, time}>}
   */
  getEventLog(limit = 50) {
    return this._eventLog.slice(-limit)
  }

  /**
   * 清空事件日志
   */
  clearEventLog() {
    this._eventLog = []
  }

  // --- 内部方法 ---

  _handleMessage(raw) {
    let msg
    try {
      msg = JSON.parse(raw)
    } catch (e) {
      log.warn('无法解析消息:', raw, e)
      return
    }

    // 1. 握手: connect.challenge
    if (msg.type === 'event' && msg.event === 'connect.challenge') {
      log.info('收到 challenge，发送认证...')
      this._connectNonce = msg.payload?.nonce || null
      this._sendConnect()
      return
    }

    // 2. 请求响应
    if (msg.type === 'res') {
      // 特殊处理 connect 响应
      if (msg.id === this._connectReqId) {
        this._connectReqId = null
        if (msg.ok) {
          log.info('认证成功！')
          this.authenticated.value = true
          this.hello.value = msg.payload
          this._emit('connected', msg.payload)
        } else {
          log.error('认证失败:', msg.error)
          this.error.value = `认证失败: ${msg.error?.message || '未知错误'}`
          this.authenticated.value = false
          this._emit('auth-error', msg.error)
        }
        return
      }

      // 普通请求响应
      const entry = this._pending.get(msg.id)
      if (entry) {
        clearTimeout(entry.timer)
        this._pending.delete(msg.id)
        if (msg.ok) {
          // config.get 的 payload 可能在不同位置
          const payload = msg.payload || msg.result || msg.data || msg
          log.debug('response ok:', msg.id, 'method:', entry.method, 'payload keys:', Object.keys(payload || {}))
          entry.resolve(payload)
        } else {
          entry.reject(new Error(msg.error?.message || msg.error || '请求失败'))
        }
      }
      return
    }

    // 3. 事件分发
    if (msg.type === 'event') {
      this._emit(msg.event, msg.payload)
      return
    }
  }

  /**
   * 发送 connect 握手请求 (协议 v4)
   * 使用 openclaw-control-ui client id 以获取 operator scopes
   * dangerouslyDisableDeviceAuth=true 时使用虚拟设备身份
   */
  _sendConnect() {
    if (this._connectSent) return
    this._connectSent = true

    const token = getToken()
    const reqId = nextId()
    this._connectReqId = reqId

    // 虚拟设备身份（dangerouslyDisableDeviceAuth=true 时 Gateway 不验证签名）
    const dummyDevice = {
      id: 'clawdash-web-' + (localStorage.getItem('clawdash_device_id') || (() => {
        const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
        localStorage.setItem('clawdash_device_id', id)
        return id
      })()),
      publicKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      signature: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      signedAt: Date.now(),
      nonce: this._connectNonce || ''
    }

    const msg = {
      type: 'req',
      id: reqId,
      method: 'connect',
      params: {
        minProtocol: 4,
        maxProtocol: 4,
        client: {
          id: 'openclaw-control-ui',
          version: '3.0.0',
          platform: navigator.platform || 'web',
          mode: 'webchat'
        },
        role: 'operator',
        scopes: ['operator.admin', 'operator.read', 'operator.write', 'operator.approvals', 'operator.pairing'],
        caps: ['tool-events'],
        auth: token ? { token } : undefined,
        device: dummyDevice,
        userAgent: navigator.userAgent,
        locale: navigator.language
      }
    }
    try {
      this.ws.send(JSON.stringify(msg))
    } catch (e) {
      this.error.value = `握手发送失败: ${e.message}`
    }
  }

  /**
   * 触发事件监听器
   * 支持通配符 '*' 监听所有事件
   * @param {string} event - 事件名
   * @param {any} payload - 事件数据
   */
  _emit(event, payload) {
    // 记录到事件日志
    this._eventLog.push({ event, payload, time: Date.now() })
    if (this._eventLog.length > this._eventLogMax) {
      this._eventLog.splice(0, this._eventLog.length - this._eventLogMax)
    }

    // 触发特定事件监听器
    const set = this._listeners.get(event)
    if (set) {
      for (const cb of set) {
        try {
          cb(payload, event)
        } catch (e) {
          log.error(`事件回调错误 (${event}):`, e)
        }
      }
    }

    // 触发通配符 '*' 监听器
    const wildcardSet = this._listeners.get('*')
    if (wildcardSet) {
      for (const cb of wildcardSet) {
        try {
          cb(payload, event)
        } catch (e) {
          log.error(`通配符回调错误 (${event}):`, e)
        }
      }
    }
  }

  /**
   * 取消重连（手动停止时调用）
   */
  cancelReconnect() {
    clearTimeout(this._reconnectTimer)
    this.reconnecting.value = false
    this._shouldReconnect = false
  }

  /**
   * 手动触发重连（重置退避后立即连接）
   */
  reconnect() {
    this._shouldReconnect = true
    this._manualClose = false
    this._reconnectDelay = 1000
    this.reconnectAttempts.value = 0
    clearTimeout(this._reconnectTimer)
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.connect()
  }

  /**
   * 指数退避重连
   */
  _scheduleReconnect() {
    clearTimeout(this._reconnectTimer)
    const delay = this._reconnectDelay
    this.reconnectAttempts.value++
    log.info(`第 ${this.reconnectAttempts.value} 次重连，${delay}ms 后尝试...`)
    this._reconnectTimer = setTimeout(() => {
      this._connectSent = false
      this.connect()
    }, delay)
    this._reconnectDelay = Math.min(this._reconnectDelay * 2, this._maxReconnectDelay)
  }
}

// --- 单例 ---
const gateway = new GatewayClient()

export default gateway
export { GatewayClient }
