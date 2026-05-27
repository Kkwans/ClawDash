<script setup>
import { ref, onMounted, computed } from 'vue'
import { gwRequest, token, updateToken, authenticated, connect } from '../stores/gateway.js'
import AppToast from '../components/AppToast.vue'
import AppConfirm from '../components/AppConfirm.vue'
import AppEditor from '../components/AppEditor.vue'
import { createLogger } from '../utils/logger.js'

const log = createLogger('Settings')

const tokenInput = ref('')
const saved = ref(false)
const configData = ref(null)
const healthData = ref(null)
const loading = ref(true)
const controlling = ref(false)
const toastRef = ref(null)
const confirmRef = ref(null)
const configEditor = ref('')
const configHash = ref('')
const configError = ref('')
const savingConfig = ref(false)

function showConfirm(msg) {
  return confirmRef.value?.confirm(msg) || false
}

function showToast(msg, type = 'info') {
  toastRef.value?.show(msg, type)
}

function saveToken() {
  updateToken(tokenInput.value)
  saved.value = true
  showToast('Token 已保存，重新连接...')
  setTimeout(() => {
    saved.value = false
    connect()
  }, 1000)
}

async function fetchData() {
  loading.value = true
  try {
    const [cfg, health] = await Promise.all([
      gwRequest('config.get').catch(() => null),
      gwRequest('health').catch(() => null)
    ])
    configData.value = cfg?.parsed || null
    configHash.value = cfg?.hash || ''
    configEditor.value = cfg?.raw || JSON.stringify(cfg?.parsed || {}, null, 2)
    healthData.value = health
  } catch (e) {
    log.warn('加载配置失败:', e)
  }
  loading.value = false
}

const modelConfig = computed(() => {
  const cfg = configData.value
  if (!cfg) return {}
  const primary = cfg.agents?.defaults?.model?.primary || '-'
  const fallbacks = cfg.agents?.defaults?.model?.fallbacks || []
  const workspace = cfg.agents?.defaults?.workspace || '-'
  const sandbox = cfg.agents?.defaults?.sandbox?.mode || '-'
  return { primary, fallbacks, workspace, sandbox }
})

const pluginEntries = computed(() => {
  const entries = configData.value?.plugins?.entries || {}
  return Object.entries(entries).map(([id, cfg]) => ({ id, ...cfg }))
})

async function doGatewayAction(action) {
  const labels = { stop: '停止', start: '启动' }
  const ok = await showConfirm(`确定要${labels[action]} Gateway 吗？`)
  if (!ok) return
  controlling.value = true
  try {
    await gwRequest(`gateway.${action}`)
    showToast(`Gateway ${labels[action]}命令已发送`)
    setTimeout(() => { fetchData(); controlling.value = false }, 2000)
  } catch (e) {
    showToast(`${labels[action]}失败: ${e.message}`, 'error')
    controlling.value = false
  }
}

async function saveConfig() {
  configError.value = ''
  try {
    JSON.parse(configEditor.value)
  } catch (e) {
    configError.value = 'JSON 格式错误: ' + e.message
    return
  }
  savingConfig.value = true
  try {
    await gwRequest('config.set', { raw: configEditor.value, baseHash: configHash.value })
    showToast('配置已保存')
    await fetchData()
  } catch (e) {
    configError.value = '保存失败: ' + e.message
  }
  savingConfig.value = false
}

onMounted(() => {
  tokenInput.value = token.value
  fetchData()
})
</script>

<template>
  <div class="space-y-6">
    <!-- 共享组件 -->
    <AppToast ref="toastRef" />
    <AppConfirm ref="confirmRef" />

    <!-- 页面标题 -->
    <div>
      <h2 class="text-lg font-bold text-gray-900">系统设置</h2>
      <p class="text-sm text-gray-500 mt-0.5">管理 Gateway 连接和配置</p>
    </div>

    <!-- Gateway 控制 -->
    <div class="bg-white rounded-xl border border-gray-200 p-6">
      <h3 class="text-base font-semibold text-gray-800 mb-4">🎛️ Gateway 控制</h3>
      <div class="flex flex-col sm:flex-row sm:items-center gap-4">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-2">
            <span class="w-3 h-3 rounded-full" :class="authenticated ? 'bg-green-500' : 'bg-red-500'"></span>
            <span class="text-sm font-medium" :class="authenticated ? 'text-green-700' : 'text-red-700'">
              {{ authenticated ? '已连接' : '未连接' }}
            </span>
          </div>
          <div v-if="healthData" class="flex items-center gap-4 text-xs text-gray-500">
            <span>会话: {{ healthData.sessions?.length || 0 }}</span>
            <span>事件循环: {{ healthData.eventLoop?.degraded ? '降级' : '正常' }}</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button @click="doGatewayAction('stop')" :disabled="controlling || !authenticated"
            class="px-4 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 transition-all border border-red-200">
            ⏹ 停止
          </button>
          <button @click="doGatewayAction('start')" :disabled="controlling || authenticated"
            class="px-4 py-2 rounded-lg text-sm font-medium bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-50 transition-all border border-green-200">
            ▶ 启动
          </button>
        </div>
      </div>
    </div>

    <!-- Token 配置 -->
    <div class="bg-white rounded-xl border border-gray-200 p-6">
      <h3 class="text-base font-semibold text-gray-800 mb-2">🔑 Gateway Token</h3>
      <p class="text-sm text-gray-500 mb-4">输入 Gateway Token 以访问 API 功能。Token 保存在本地浏览器中。</p>
      <div class="flex items-center gap-3">
        <input v-model="tokenInput" type="password" autocomplete="new-password" placeholder="输入 Gateway Token"
          aria-label="Gateway Token"
          class="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
        <button @click="saveToken"
          class="px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
          :class="saved ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'">
          {{ saved ? '✓ 已保存' : '保存' }}
        </button>
      </div>
    </div>

    <!-- 配置编辑器 -->
    <div class="bg-white rounded-xl border border-gray-200 p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-semibold text-gray-800">📝 配置编辑器</h3>
        <div class="flex gap-2">
          <button @click="fetchData" class="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">刷新</button>
          <button @click="saveConfig" :disabled="savingConfig" class="px-3 py-1.5 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">{{ savingConfig ? '保存中...' : '保存配置' }}</button>
        </div>
      </div>
      <AppEditor v-model="configEditor" language="json" placeholder="JSON 配置..."
        min-height="300px" max-height="600px" />
      <p v-if="configError" class="text-xs text-red-500 mt-2">{{ configError }}</p>
    </div>

    <!-- 当前配置 -->
    <div class="bg-white rounded-xl border border-gray-200 p-6">
      <h3 class="text-base font-semibold text-gray-800 mb-4">⚙️ 当前配置</h3>
      <div v-if="loading" class="text-center py-4 text-gray-400">加载中...</div>
      <div v-else class="space-y-1">
        <div class="flex items-center justify-between py-2.5 border-b border-gray-100">
          <span class="text-sm text-gray-500">默认模型</span>
          <span class="text-sm font-medium text-gray-800 font-mono">{{ modelConfig.primary }}</span>
        </div>
        <div class="flex items-center justify-between py-2.5 border-b border-gray-100">
          <span class="text-sm text-gray-500">备选模型</span>
          <span class="text-sm font-medium text-gray-800 font-mono">{{ modelConfig.fallbacks.join(', ') || '-' }}</span>
        </div>
        <div class="flex items-center justify-between py-2.5 border-b border-gray-100">
          <span class="text-sm text-gray-500">沙箱模式</span>
          <span class="text-sm font-medium text-gray-800">{{ modelConfig.sandbox }}</span>
        </div>
        <div class="flex items-center justify-between py-2.5">
          <span class="text-sm text-gray-500">工作区</span>
          <span class="text-sm font-medium text-gray-800 font-mono truncate ml-4">{{ modelConfig.workspace }}</span>
        </div>
      </div>
    </div>

    <!-- 已安装插件 -->
    <div v-if="pluginEntries.length > 0" class="bg-white rounded-xl border border-gray-200 p-6">
      <h3 class="text-base font-semibold text-gray-800 mb-4">🧩 已安装插件</h3>
      <div class="space-y-2">
        <div v-for="pl in pluginEntries" :key="pl.id"
          class="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-sm">🧩</div>
            <p class="text-sm font-medium text-gray-800">{{ pl.id }}</p>
          </div>
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
            :class="pl.enabled !== false ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'">
            {{ pl.enabled !== false ? '已启用' : '已禁用' }}
          </span>
        </div>
      </div>
    </div>

    <!-- 关于 -->
    <div class="bg-white rounded-xl border border-gray-200 p-6">
      <h3 class="text-base font-semibold text-gray-800 mb-4">ℹ️ 关于</h3>
      <div class="space-y-2 text-sm text-gray-500">
        <p>ClawDash v0.6.0 — OpenClaw WebSocket 控制台</p>
        <p>基于 Vue 3 + Tailwind CSS 构建，通过 WebSocket 直连 Gateway</p>
        <div class="flex items-center gap-3 mt-3">
          <a href="/builtin/" target="_blank"
            class="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-all">
            ⚡ 内置 Control UI
          </a>
          <a href="https://github.com/Kkwans/ClawDash" target="_blank"
            class="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-all">
            GitHub
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
