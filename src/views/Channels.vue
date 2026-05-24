<script setup>
import { ref, computed, onMounted } from 'vue'
import { gwRequest } from '../stores/gateway.js'

const channelsData = ref(null)
const configData = ref(null)
const loading = ref(true)
const toast = ref('')
const activeTab = ref('channels')
const confirmDialog = ref({ show: false, msg: '', onOk: null })
const showInstallModal = ref(false)
const installForm = ref({ pluginId: '' })

function showConfirm(msg) {
  return new Promise(resolve => {
    confirmDialog.value = { show: true, msg, onOk: () => { confirmDialog.value.show = false; resolve(true) } }
  })
}
function cancelConfirm() { confirmDialog.value.show = false }

const tabs = [
  { key: 'channels', label: '渠道状态', icon: '📡' },
  { key: 'plugins', label: '插件管理', icon: '🧩' },
]

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
    showToast('加载失败: ' + e.message)
  }
  loading.value = false
}

function showToast(msg) {
  toast.value = msg
  setTimeout(() => toast.value = '', 3000)
}

const eventLoop = computed(() => channelsData.value?.eventLoop || null)
const channelEntries = computed(() => {
  const ch = channelsData.value?.channels || {}
  return Object.entries(ch).map(([id, info]) => ({ id, ...info }))
})

const pluginEntries = computed(() => {
  const entries = configData.value?.plugins?.entries || {}
  return Object.entries(entries).map(([id, cfg]) => ({
    id,
    config: cfg,
    enabled: cfg.enabled !== false
  }))
})

async function togglePlugin(plugin) {
  try {
    const cfgRes = await gwRequest('config.get')
    const raw = cfgRes?.raw
    const hash = cfgRes?.hash
    if (!raw || !hash) throw new Error('无法获取配置')
    const cfg = JSON.parse(raw)
    const entry = cfg.plugins?.entries?.[plugin.id]
    if (!entry) throw new Error('插件不存在')
    entry.enabled = !plugin.enabled
    await gwRequest('config.set', { raw: JSON.stringify(cfg), baseHash: hash })
    showToast(`${plugin.id} 已${entry.enabled ? '启用' : '禁用'}`)
    await fetchData()
  } catch (e) {
    showToast('操作失败: ' + e.message)
  }
}

async function uninstallPlugin(plugin) {
  const ok = await showConfirm(`确定卸载插件 ${plugin.id}？`)
  if (!ok) return
  try {
    const cfgRes = await gwRequest('config.get')
    const raw = cfgRes?.raw
    const hash = cfgRes?.hash
    if (!raw || !hash) throw new Error('无法获取配置')
    const cfg = JSON.parse(raw)
    if (cfg.plugins?.entries?.[plugin.id]) {
      delete cfg.plugins.entries[plugin.id]
    }
    await gwRequest('config.set', { raw: JSON.stringify(cfg), baseHash: hash })
    showToast(`${plugin.id} 已卸载`)
    await fetchData()
  } catch (e) {
    showToast('卸载失败: ' + e.message)
  }
}

async function installPlugin() {
  if (!installForm.value.pluginId) { showToast('请输入插件 ID', 'error'); return }
  try {
    const cfgRes = await gwRequest('config.get')
    const raw = cfgRes?.raw
    const hash = cfgRes?.hash
    if (!raw || !hash) throw new Error('无法获取配置')
    const cfg = JSON.parse(raw)
    if (!cfg.plugins) cfg.plugins = {}
    if (!cfg.plugins.entries) cfg.plugins.entries = {}
    cfg.plugins.entries[installForm.value.pluginId] = { enabled: true }
    await gwRequest('config.set', { raw: JSON.stringify(cfg), baseHash: hash })
    showToast(`${installForm.value.pluginId} 已安装`)
    showInstallModal.value = false
    installForm.value.pluginId = ''
    await fetchData()
  } catch (e) {
    showToast('安装失败: ' + e.message)
  }
}

const channelIcons = {
  feishu: '🐦', qqbot: '🐧', telegram: '✈️', discord: '🎮',
  wechat: '💚', slack: '💼', whatsapp: '📱', matrix: '🔗'
}

onMounted(fetchData)
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
        <h2 class="text-lg font-bold text-gray-900">渠道管理</h2>
        <p class="text-sm text-gray-500 mt-0.5">查看渠道状态和管理插件</p>
      </div>
      <div class="flex gap-2">
        <button @click="fetchData" class="px-3 py-1.5 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">刷新</button>
        <button @click="showInstallModal = true" class="px-3 py-1.5 text-xs text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors">+ 安装插件</button>
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
          <span v-if="eventLoop.degraded && eventLoop.reasons?.length" class="text-xs text-amber-600">
            ({{ eventLoop.reasons.join(', ') }})
          </span>
        </div>
        <div class="flex items-center gap-4 text-xs text-gray-500">
          <span v-if="eventLoop.utilization">利用率 {{ (eventLoop.utilization * 100).toFixed(0) }}%</span>
          <span v-if="eventLoop.delayP99Ms">P99 {{ eventLoop.delayP99Ms.toFixed(0) }}ms</span>
          <span v-if="eventLoop.intervalMs">间隔 {{ eventLoop.intervalMs }}ms</span>
        </div>
      </div>
    </div>

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

    <!-- Tab 切换 -->
    <div class="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
      <button v-for="tab in tabs" :key="tab.key"
        @click="activeTab = tab.key"
        class="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all"
        :class="activeTab === tab.key
          ? 'bg-white text-gray-800 shadow-sm'
          : 'text-gray-500 hover:text-gray-700'">
        <span>{{ tab.icon }}</span>
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="flex flex-col items-center gap-3">
        <div class="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        <span class="text-sm text-gray-400">加载中...</span>
      </div>
    </div>

    <!-- 渠道列表 -->
    <div v-else-if="activeTab === 'channels'" class="space-y-3">
      <div v-if="channelEntries.length === 0" class="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
        <span class="text-4xl mb-4">📡</span>
        <p class="text-sm font-medium text-gray-600">暂无渠道配置</p>
        <p class="text-xs text-gray-400 mt-1">渠道通过 OpenClaw 插件系统管理</p>
      </div>
      <div v-for="ch in channelEntries" :key="ch.id"
        class="bg-white rounded-xl border border-gray-200 p-4 transition-all hover:border-gray-300">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-indigo-50">
            {{ channelIcons[ch.id] || '📡' }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-gray-900">{{ ch.id }}</p>
            <p class="text-xs text-gray-500">{{ ch.status || '运行中' }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 插件管理 -->
    <div v-else-if="activeTab === 'plugins'" class="space-y-3">
      <div v-if="pluginEntries.length === 0" class="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
        <span class="text-4xl mb-4">🧩</span>
        <p class="text-sm font-medium text-gray-600">暂无插件配置</p>
        <p class="text-xs text-gray-400 mt-1">插件在 OpenClaw 配置文件中管理</p>
      </div>
      <div v-for="pl in pluginEntries" :key="pl.id"
        class="bg-white rounded-xl border border-gray-200 p-4 transition-all hover:border-gray-300">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              :class="pl.enabled ? 'bg-green-50' : 'bg-gray-100'">
              🧩
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <p class="text-sm font-semibold text-gray-900">{{ pl.id }}</p>
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                  :class="pl.enabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'">
                  <span class="w-1.5 h-1.5 rounded-full" :class="pl.enabled ? 'bg-green-500' : 'bg-gray-400'"></span>
                  {{ pl.enabled ? '已启用' : '已禁用' }}
                </span>
              </div>
              <p class="text-xs text-gray-400 truncate mt-0.5">
                配置项: {{ Object.keys(pl.config).filter(k => k !== 'enabled').length }} 个
              </p>
            </div>
          </div>
          <div class="flex gap-2">
            <button @click="togglePlugin(pl)"
              class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              :class="pl.enabled
                ? 'bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-100'
                : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-100'">
              {{ pl.enabled ? '禁用' : '启用' }}
            </button>
            <button @click="uninstallPlugin(pl)"
              class="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 transition-all">
              卸载
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
