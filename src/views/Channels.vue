<script setup>
import { ref, computed, onMounted } from 'vue'
import { gwRequest } from '../stores/gateway.js'
import { getRawConfig, getConfigHash, updateGatewayConfig } from "../api/config-utils.js"
import Toast from '../components/Toast.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const channelsData = ref(null)
const configData = ref(null)
const loading = ref(true)
const toastRef = ref(null)
const confirmRef = ref(null)
const activeTab = ref('channels')
const showInstallModal = ref(false)
const showAddChannelModal = ref(false)
const installForm = ref({ pluginId: '' })
const addForm = ref({ channel: '', config: {} })
const saving = ref(false)

function showConfirm(msg) {
  return confirmRef.value?.confirm(msg) || false
}

function showToast(msg) {
  toastRef.value?.show(msg)
}

const tabs = [
  { key: 'channels', label: '渠道状态', icon: '📡' },
  { key: 'plugins', label: '插件管理', icon: '🧩' },
]

// 支持的渠道类型及其配置字段
const channelTypes = [
  { id: 'feishu', name: '飞书', icon: '🐦', fields: [
    { key: 'appId', label: 'App ID', placeholder: 'cli_xxx', required: true },
    { key: 'appSecret', label: 'App Secret', placeholder: 'xxx', required: true, type: 'password' },
  ]},
  { id: 'qqbot', name: 'QQ Bot', icon: '🐧', fields: [
    { key: 'appId', label: 'App ID', placeholder: 'xxx', required: true },
    { key: 'clientSecret', label: 'Client Secret', placeholder: 'xxx', required: true, type: 'password' },
  ]},
  { id: 'telegram', name: 'Telegram', icon: '✈️', fields: [
    { key: 'token', label: 'Bot Token', placeholder: '123456:ABC-DEF...', required: true, type: 'password' },
  ]},
  { id: 'discord', name: 'Discord', icon: '🎮', fields: [
    { key: 'token', label: 'Bot Token', placeholder: 'xxx', required: true, type: 'password' },
  ]},
  { id: 'slack', name: 'Slack', icon: '💼', fields: [
    { key: 'token', label: 'Bot Token', placeholder: 'xoxb-...', required: true, type: 'password' },
  ]},
  { id: 'whatsapp', name: 'WhatsApp', icon: '📱', fields: [] },
  { id: 'wechat', name: '微信', icon: '💚', fields: [] },
]

const selectedChannelType = computed(() => channelTypes.find(c => c.id === addForm.value.channel))

async function fetchData() {
  loading.value = true
  try {
    const [ch, cfg] = await Promise.all([
      gwRequest('channels.status').catch(() => null),
      gwRequest('config.get').catch(() => null)
    ])
    channelsData.value = ch
    configData.value = cfg?.parsed || null
  } catch (e) {
    showToast('加载失败: ' + e.message, 'error')
  }
  loading.value = false
}

const eventLoop = computed(() => channelsData.value?.eventLoop || null)
const channelEntries = computed(() => {
  const ch = channelsData.value?.channels || {}
  return Object.entries(ch).map(([id, info]) => ({ id, ...info }))
})

const pluginEntries = computed(() => {
  const entries = configData.value?.plugins?.entries || {}
  return Object.entries(entries).map(([id, cfg]) => ({
    id, config: cfg, enabled: cfg.enabled !== false
  }))
})

// 添加渠道
async function addChannel() {
  if (!addForm.value.channel) { showToast('请选择渠道类型', 'error'); return }
  const type = selectedChannelType.value
  if (!type) { showToast('未知渠道类型', 'error'); return }

  // 验证必填字段
  for (const f of type.fields) {
    if (f.required && !addForm.value.config[f.key]) {
      showToast(`请填写 ${f.label}`, 'error')
      return
    }
  }

  saving.value = true
  try {
    // 通过 config.set 添加渠道配置
    const cfgRes = await gwRequest('config.get')
    const raw = getRawConfig(cfgRes)
    const hash = getConfigHash(cfgRes)
    if (!raw || !hash) throw new Error("无法获取配置")
    const cfg = JSON.parse(raw)
    if (!cfg.channels) cfg.channels = {}

    const channelConfig = { enabled: true }
    for (const f of type.fields) {
      if (addForm.value.config[f.key]) {
        channelConfig[f.key] = addForm.value.config[f.key]
      }
    }
    cfg.channels[addForm.value.channel] = channelConfig

    await gwRequest('config.set', { raw: JSON.stringify(cfg), baseHash: cfgRes.hash })
    showToast(`${type.name} 渠道已添加`, 'success')
    showAddChannelModal.value = false
    addForm.value = { channel: '', config: {} }
    await fetchData()
  } catch (e) {
    showToast('添加失败: ' + e.message, 'error')
  }
  saving.value = false
}

// 删除渠道
async function removeChannel(ch) {
  const ok = await showConfirm(`确定删除渠道 ${ch.id}？此操作不可恢复。`)
  if (!ok) return
  try {
    const cfgRes = await gwRequest('config.get')
    const raw = getRawConfig(cfgRes)
    const hash = getConfigHash(cfgRes)
    if (!raw || !hash) throw new Error("无法获取配置")
    const cfg = JSON.parse(raw)
    if (cfg.channels?.[ch.id]) {
      delete cfg.channels[ch.id]
    }
    await gwRequest('config.set', { raw: JSON.stringify(cfg), baseHash: cfgRes.hash })
    showToast(`${ch.id} 已删除`, 'success')
    await fetchData()
  } catch (e) {
    showToast('删除失败: ' + e.message, 'error')
  }
}

// 切换渠道启用/禁用
async function toggleChannel(ch) {
  try {
    const cfgRes = await gwRequest('config.get')
    const raw = getRawConfig(cfgRes)
    const hash = getConfigHash(cfgRes)
    if (!raw || !hash) throw new Error("无法获取配置")
    const cfg = JSON.parse(raw)
    const entry = cfg.channels?.[ch.id]
    if (!entry) throw new Error('渠道不存在')
    entry.enabled = ch.enabled === false ? true : false
    await gwRequest('config.set', { raw: JSON.stringify(cfg), baseHash: cfgRes.hash })
    showToast(`${ch.id} 已${entry.enabled ? '启用' : '禁用'}`, 'success')
    await fetchData()
  } catch (e) {
    showToast('操作失败: ' + e.message, 'error')
  }
}

async function togglePlugin(plugin) {
  try {
    const cfgRes = await gwRequest('config.get')
    const raw = getRawConfig(cfgRes)
    const hash = cfgRes?.hash
    if (!raw || !hash) throw new Error('无法获取配置')
    const cfg = JSON.parse(raw)
    const entry = cfg.plugins?.entries?.[plugin.id]
    if (!entry) throw new Error('插件不存在')
    entry.enabled = !plugin.enabled
    await gwRequest('config.set', { raw: JSON.stringify(cfg), baseHash: hash })
    showToast(`${plugin.id} 已${entry.enabled ? '启用' : '禁用'}`, 'success')
    await fetchData()
  } catch (e) {
    showToast('操作失败: ' + e.message, 'error')
  }
}

async function uninstallPlugin(plugin) {
  const ok = await showConfirm(`确定卸载插件 ${plugin.id}？`)
  if (!ok) return
  try {
    const cfgRes = await gwRequest('config.get')
    const raw = getRawConfig(cfgRes)
    const hash = cfgRes?.hash
    if (!raw || !hash) throw new Error('无法获取配置')
    const cfg = JSON.parse(raw)
    if (cfg.plugins?.entries?.[plugin.id]) {
      delete cfg.plugins.entries[plugin.id]
    }
    await gwRequest('config.set', { raw: JSON.stringify(cfg), baseHash: hash })
    showToast(`${plugin.id} 已卸载`, 'success')
    await fetchData()
  } catch (e) {
    showToast('卸载失败: ' + e.message, 'error')
  }
}

async function installPlugin() {
  if (!installForm.value.pluginId) { showToast('请输入插件 ID', 'error'); return }
  try {
    const cfgRes = await gwRequest('config.get')
    const raw = getRawConfig(cfgRes)
    const hash = cfgRes?.hash
    if (!raw || !hash) throw new Error('无法获取配置')
    const cfg = JSON.parse(raw)
    if (!cfg.plugins) cfg.plugins = {}
    if (!cfg.plugins.entries) cfg.plugins.entries = {}
    cfg.plugins.entries[installForm.value.pluginId] = { enabled: true }
    await gwRequest('config.set', { raw: JSON.stringify(cfg), baseHash: hash })
    showToast(`${installForm.value.pluginId} 已安装`, 'success')
    showInstallModal.value = false
    installForm.value.pluginId = ''
    await fetchData()
  } catch (e) {
    showToast('安装失败: ' + e.message, 'error')
  }
}

const channelIcons = {
  feishu: '🐦', qqbot: '🐧', telegram: '✈️', discord: '🎮',
  wechat: '💚', slack: '💼', whatsapp: '📱', matrix: '🔗',
  signal: '🔒', irc: '💬', line: '🟢', nostr: '🟣'
}

onMounted(fetchData)
</script>

<template>
  <div class="space-y-6">
    <!-- 共享组件 -->
    <Toast ref="toastRef" />
    <ConfirmDialog ref="confirmRef" />

    <!-- 添加渠道弹窗 -->
    <div v-if="showAddChannelModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <h3 class="text-lg font-bold mb-4">添加渠道</h3>
        <div class="space-y-3">
          <div>
            <label class="text-xs text-gray-500">渠道类型</label>
            <select v-model="addForm.channel" class="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">请选择...</option>
              <option v-for="ct in channelTypes" :key="ct.id" :value="ct.id">
                {{ ct.icon }} {{ ct.name }}
              </option>
            </select>
          </div>
          <template v-if="selectedChannelType">
            <div v-for="f in selectedChannelType.fields" :key="f.key">
              <label class="text-xs text-gray-500">
                {{ f.label }}
                <span v-if="f.required" class="text-red-500">*</span>
              </label>
              <input v-model="addForm.config[f.key]"
                :type="f.type || 'text'"
                :placeholder="f.placeholder"
                class="w-full border rounded-lg px-3 py-2 text-sm">
            </div>
          </template>
        </div>
        <div class="flex gap-2 mt-4 justify-end">
          <button @click="showAddChannelModal = false" class="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">取消</button>
          <button @click="addChannel" :disabled="saving" class="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {{ saving ? '添加中...' : '添加' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 安装插件弹窗 -->
    <div v-if="showInstallModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <h3 class="text-lg font-bold mb-4">安装插件</h3>
        <div>
          <label class="text-xs text-gray-500">插件 ID</label>
          <input v-model="installForm.pluginId" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="feishu-plugin">
        </div>
        <div class="flex gap-2 mt-4 justify-end">
          <button @click="showInstallModal = false" class="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">取消</button>
          <button @click="installPlugin" class="px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700">安装</button>
        </div>
      </div>
    </div>

    <!-- 页面标题 -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-bold text-gray-900">渠道管理</h2>
        <p class="text-sm text-gray-500 mt-0.5">管理消息渠道和插件</p>
      </div>
      <div class="flex gap-2">
        <button @click="fetchData" class="px-3 py-1.5 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700">刷新</button>
        <button @click="showAddChannelModal = true" class="px-3 py-1.5 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700">+ 添加渠道</button>
        <button @click="showInstallModal = true" class="px-3 py-1.5 text-xs text-white bg-green-600 rounded-lg hover:bg-green-700">+ 安装插件</button>
      </div>
    </div>

    <!-- EventLoop 状态 -->
    <div v-if="eventLoop" class="rounded-xl border p-4"
      :class="eventLoop.degraded ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span>{{ eventLoop.degraded ? '⚠️' : '✅' }}</span>
          <span class="text-sm font-medium" :class="eventLoop.degraded ? 'text-amber-800' : 'text-green-800'">
            事件循环{{ eventLoop.degraded ? '降级' : '正常' }}
          </span>
        </div>
        <div class="flex items-center gap-4 text-xs text-gray-500">
          <span v-if="eventLoop.utilization">利用率 {{ (eventLoop.utilization * 100).toFixed(0) }}%</span>
          <span v-if="eventLoop.delayP99Ms">P99 {{ eventLoop.delayP99Ms.toFixed(0) }}ms</span>
        </div>
      </div>
    </div>

    <!-- Tab 切换 -->
    <div class="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
      <button v-for="tab in tabs" :key="tab.key"
        @click="activeTab = tab.key"
        class="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all"
        :class="activeTab === tab.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'">
        <span>{{ tab.icon }}</span>
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
    </div>

    <!-- 渠道列表 -->
    <div v-else-if="activeTab === 'channels'" class="space-y-3">
      <div v-if="channelEntries.length === 0" class="text-center py-16 bg-white rounded-xl border">
        <span class="text-4xl mb-4 block">📡</span>
        <p class="text-sm font-medium text-gray-600">暂无渠道配置</p>
        <p class="text-xs text-gray-400 mt-1">点击上方"添加渠道"开始</p>
      </div>
      <div v-for="ch in channelEntries" :key="ch.id"
        class="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-all">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              :class="ch.enabled !== false ? 'bg-indigo-50' : 'bg-gray-100'">
              {{ channelIcons[ch.id] || '📡' }}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <p class="text-sm font-semibold text-gray-900">{{ ch.id }}</p>
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                  :class="ch.enabled !== false ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'">
                  <span class="w-1.5 h-1.5 rounded-full" :class="ch.enabled !== false ? 'bg-green-500' : 'bg-gray-400'"></span>
                  {{ ch.enabled !== false ? '已启用' : '已禁用' }}
                </span>
              </div>
              <p class="text-xs text-gray-400 mt-0.5">{{ ch.status || '运行中' }}</p>
            </div>
          </div>
          <div class="flex gap-2">
            <button @click="toggleChannel(ch)"
              class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              :class="ch.enabled !== false
                ? 'bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-100'
                : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-100'">
              {{ ch.enabled !== false ? '禁用' : '启用' }}
            </button>
            <button @click="removeChannel(ch)"
              class="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-100">
              删除
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 插件管理 -->
    <div v-else-if="activeTab === 'plugins'" class="space-y-3">
      <div v-if="pluginEntries.length === 0" class="text-center py-16 bg-white rounded-xl border">
        <span class="text-4xl mb-4 block">🧩</span>
        <p class="text-sm font-medium text-gray-600">暂无插件配置</p>
      </div>
      <div v-for="pl in pluginEntries" :key="pl.id"
        class="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-all">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              :class="pl.enabled ? 'bg-green-50' : 'bg-gray-100'">🧩</div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <p class="text-sm font-semibold text-gray-900">{{ pl.id }}</p>
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                  :class="pl.enabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'">
                  <span class="w-1.5 h-1.5 rounded-full" :class="pl.enabled ? 'bg-green-500' : 'bg-gray-400'"></span>
                  {{ pl.enabled ? '已启用' : '已禁用' }}
                </span>
              </div>
            </div>
          </div>
          <div class="flex gap-2">
            <button @click="togglePlugin(pl)" class="px-3 py-1.5 rounded-lg text-xs font-medium"
              :class="pl.enabled ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-green-50 text-green-600 border border-green-100'">
              {{ pl.enabled ? '禁用' : '启用' }}
            </button>
            <button @click="uninstallPlugin(pl)" class="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 border border-red-100">
              卸载
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
