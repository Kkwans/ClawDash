/**
 * ClawDash API 工具
 * 封装 UGreen API 调用（/api/v1/*）
 */

const API_BASE = '/api/v1'

// Gateway Token（从 localStorage 读取）
function getToken() {
  return localStorage.getItem('clawdash_token') || ''
}

function setToken(token) {
  localStorage.setItem('clawdash_token', token)
}

/**
 * 通用 API 请求
 */
async function api(path, opts = {}) {
  const token = getToken()
  const headers = {
    'Authorization': token,
    ...(opts.headers || {})
  }
  if (opts.body && typeof opts.body === 'object') {
    headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(opts.body)
  }
  const res = await fetch(API_BASE + path, { ...opts, headers })
  if (res.status === 401) {
    throw new Error('unauthorized')
  }
  const data = await res.json()
  if (!data.success) {
    throw new Error(data.error || '请求失败')
  }
  return data.data
}

/**
 * 健康检查（走官方 Gateway）
 */
async function healthCheck() {
  const res = await fetch('/healthz')
  return res.json()
}

/**
 * 进程状态
 */
async function getProcessStatus() {
  return api('/process/status')
}

/**
 * 进程日志
 */
async function getProcessLogs(after = 0, limit = 100) {
  return api(`/process/logs?after=${after}&limit=${limit}`)
}

/**
 * 清除日志
 */
async function clearProcessLogs() {
  return api('/process/logs/clear', { method: 'POST' })
}

/**
 * 进程控制（start/stop/restart）
 */
async function controlProcess(action) {
  return api(`/process/${action}`, { method: 'POST' })
}

/**
 * 模型提供商列表
 */
async function getProviders() {
  return api('/providers')
}

/**
 * 已知提供商模板
 */
async function getKnownProviders() {
  return api('/known-providers')
}

/**
 * 修改提供商
 */
async function updateProvider(id, data) {
  return api(`/providers/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: data
  })
}

/**
 * 删除提供商
 */
async function deleteProvider(id) {
  return api(`/providers/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  })
}

/**
 * 渠道列表
 */
async function getChannels() {
  return api('/channels')
}

/**
 * 已知渠道模板
 */
async function getKnownChannels() {
  return api('/known-channels')
}

/**
 * 修改渠道
 */
async function updateChannel(id, data) {
  return api(`/channels/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: data
  })
}

/**
 * 删除渠道
 */
async function deleteChannel(id) {
  return api(`/channels/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  })
}

/**
 * 默认配置
 */
async function getDefaults() {
  return api('/config/defaults')
}

/**
 * 修改默认配置
 */
async function updateDefaults(data) {
  return api('/config/defaults', {
    method: 'PUT',
    body: data
  })
}

/**
 * 重置配置
 */
async function resetConfig() {
  return api('/config/reset', { method: 'POST' })
}

/**
 * 插件列表
 */
async function getPlugins() {
  return api('/plugins')
}

/**
 * 修改插件配置
 */
async function updatePlugin(id, data) {
  return api(`/plugins/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: data
  })
}

export {
  getToken,
  setToken,
  api,
  healthCheck,
  getProcessStatus,
  getProcessLogs,
  clearProcessLogs,
  controlProcess,
  getProviders,
  getKnownProviders,
  updateProvider,
  deleteProvider,
  getChannels,
  getKnownChannels,
  updateChannel,
  deleteChannel,
  getDefaults,
  updateDefaults,
  resetConfig,
  getPlugins,
  updatePlugin
}
