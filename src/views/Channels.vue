<script setup>
import { ref, computed, onMounted, watch } from 'vue'
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
const showChannelDetail = ref(null)
const addForm = ref({ channel: '', config: {} })
const saving = ref(false)

// 插件仓库数据
const pluginRegistry = ref([])
const pluginLoading = ref(false)

function showConfirm(msg) {
  return confirmRef.value?.confirm(msg) || false
}

function showToast(msg, type = 'info') {
  toastRef.value?.show(msg, type)
}

const tabs = [
  { key: 'channels', label: '渠道', icon: '📡' },
  { key: 'plugins', label: '插件', icon: '🧩' },
]

// 只包含 OpenClaw 真实支持的渠道
const channelTypes = [
  {
    id: 'feishu', name: '飞书', icon: '🐦',
    desc: '飞书/Lark 消息平台，支持富文本、卡片、文件',
    fields: [
      { key: 'appId', label: 'App ID', placeholder: 'cli_xxx', required: true },
      { key: 'appSecret', label: 'App Secret', placeholder: '请输入 App Secret', required: true, type: 'password' },
    ],
    docs: 'https://docs.openclaw.ai/channels/feishu'
  },
  {
    id: 'telegram', name: 'Telegram', icon: '✈️',
    desc: 'Telegram Bot，支持群组、频道、内联模式',
    fields: [
      { key: 'token', label: 'Bot Token', placeholder: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11', required: true, type: 'password' },
    ],
    docs: 'https://docs.openclaw.ai/channels/telegram'
  },
  {
    id: 'discord', name: 'Discord', icon: '🎮',
    desc: 'Discord Bot，支持服务器、DM、线程',
    fields: [
      { key: 'token', label: 'Bot Token', placeholder: 'MTEx...', required: true, type: 'password' },
    ],
    docs: 'https://docs.openclaw.ai/channels/discord'
  },
  {
    id: 'slack', name: 'Slack', icon: '💼',
    desc: 'Slack App，支持工作区、频道、线程',
    fields: [
      { key: 'token', label: 'Bot Token', placeholder: 'xoxb-...', required: true, type: 'password' },
    ],
    docs: 'https://docs.openclaw.ai/channels/slack'
  },
  {
    id: 'qqbot', name: 'QQ Bot', icon: '🐧',
    desc: 'QQ 机器人，支持群聊、私聊',
    fields: [
      { key: 'appId', label: 'App ID', placeholder: '请输入 App ID', required: true },
      { key: 'clientSecret', label: 'Client Secret', placeholder: '请输入 Client Secret', required: true, type: 'password' },
    ],
    docs: 'https://docs.openclaw.ai/channels/qqbot'
  },
  {
    id: 'whatsapp', name: 'WhatsApp', icon: '📱',
    desc: 'WhatsApp Business，需要 API 接入',
    fields: [],
    docs: 'https://docs.openclaw.ai/channels/whatsapp'
  },
  {
    id: 'signal', name: 'Signal', icon: '🔒',
    desc: 'Signal 私密消息，端到端加密',
    fields: [],
    docs: 'https://docs.openclaw.ai/channels/signal'
  },
  {
    id: 'line', name: 'LINE', icon: '🟢',
    desc: 'LINE Messaging API',
    fields: [],
    docs: 'https://docs.openclaw.ai/channels/line'
  },
]

const selectedChannelType = computed(() => channelTypes.find(c => c.id === addForm.value.channel))

// 已配置但不在 channelTypes 中的渠道（显示为未知类型）
const unknownChannels = computed(() => {
  const known = new Set(channelTypes.map(c => c.id))
  return channelEntries.value.filter(ch => !known.has(ch.id))
})

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

// 获取渠道配置详情
function getChannelConfig(channelId) {
  const channels = configData.value?.channels || {}
  return channels[channelId] || {}
}

// 获取渠道图标
function getChannelIcon(id) {
  const icons = {
    feishu: '🐦', qqbot: '🐧', telegram: '✈️', discord: '🎮',
    slack: '💼', whatsapp: '📱', signal: '🔒', line: '🟢',
    matrix: '🔗', irc: '💬', nostr: '🟣', msteams: '🏢',
    googlechat: '📧', twitch: '🎥', 'synology-chat': '🏠',
    'nextcloud-talk': '☁️', mattermost: '🔵', bluebubbles: '🍎',
    imessage: '💬', zalo: '🇿', tlon: '🌐'
  }
  return icons[id] || '📡'
}

// 获取渠道显示名称
function getChannelName(id) {
  const names = {
    feishu: '飞书', qqbot: 'QQ Bot', telegram: 'Telegram', discord: 'Discord',
    slack: 'Slack', whatsapp: 'WhatsApp', signal: 'Signal', line: 'LINE',
    matrix: 'Matrix', irc: 'IRC', nostr: 'Nostr', msteams: 'Microsoft Teams',
    googlechat: 'Google Chat', twitch: 'Twitch', 'synology-chat': 'Synology Chat',
    'nextcloud-talk': 'Nextcloud Talk', mattermost: 'Mattermost',
    bluebubbles: 'BlueBubbles', imessage: 'iMessage', zalo: 'Zalo', tlon: 'Tlon'
  }
  return names[id] || id
}

// 打开渠道详情
function openChannelDetail(ch) {
  showChannelDetail.value = {
    id: ch.id,
    config: getChannelConfig(ch.id),
    enabled: ch.enabled !== false
  }
}

// 关闭渠道详情
function closeChannelDetail() {
  showChannelDetail.value = null
}

// 保存渠道配置
async function saveChannelConfig() {
  if (!showChannelDetail.value) return
  saving.value = true
  try {
    const cfgRes = await gwRequest('config.get')
    const raw = getRawConfig(cfgRes)
    if (!raw) throw new Error("无法获取配置")
    const cfg = JSON.parse(raw)
    
    if (!cfg.channels) cfg.channels = {}
    if (!cfg.channels[showChannelDetail.value.id]) {
      cfg.channels[showChannelDetail.value.id] = {}
    }
    
    // 合并配置
    Object.assign(cfg.channels[showChannelDetail.value.id], showChannelDetail.value.config)
    
    await gwRequest('config.set', { raw: JSON.stringify(cfg), baseHash: cfgRes.hash })
    showToast('配置已保存，重启后生效', 'success')
    closeChannelDetail()
    await fetchData()
  } catch (e) {
    showToast('保存失败: ' + e.message, 'error')
  }
  saving.value = false
}

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
    const cfgRes = await gwRequest('config.get')
    const raw = getRawConfig(cfgRes)
    if (!raw) throw new Error("无法获取配置")
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
    showToast(`${type.name} 渠道已添加，重启后生效`, 'success')
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
  const ok = await showConfirm(`确定删除渠道 ${getChannelName(ch.id)} (${ch.id})？此操作不可恢复。`)
  if (!ok) return
  try {
    const cfgRes = await gwRequest('config.get')
    const raw = getRawConfig(cfgRes)
    if (!raw) throw new Error("无法获取配置")
    const cfg = JSON.parse(raw)
    if (cfg.channels?.[ch.id]) {
      delete cfg.channels[ch.id]
    }
    await gwRequest('config.set', { raw: JSON.stringify(cfg), baseHash: cfgRes.hash })
    showToast(`${getChannelName(ch.id)} 已删除`, 'success')
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
    if (!raw) throw new Error("无法获取配置")
    const cfg = JSON.parse(raw)
    const entry = cfg.channels?.[ch.id]
    if (!entry) throw new Error('渠道不存在')
    entry.enabled = ch.enabled === false ? true : false
    await gwRequest('config.set', { raw: JSON.stringify(cfg), baseHash: cfgRes.hash })
    showToast(`${getChannelName(ch.id)} 已${entry.enabled ? '启用' : '禁用'}`, 'success')
    await fetchData()
  } catch (e) {
    showToast('操作失败: ' + e.message, 'error')
  }
}

async function togglePlugin(plugin) {
  try {
    const cfgRes = await gwRequest('config.get')
    const raw = getRawConfig(cfgRes)
    if (!raw) throw new Error('无法获取配置')
    const cfg = JSON.parse(raw)
    const entry = cfg.plugins?.entries?.[plugin.id]
    if (!entry) throw new Error('插件不存在')
    entry.enabled = !plugin.enabled
    await gwRequest('config.set', { raw: JSON.stringify(cfg), baseHash: cfgRes.hash })
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
    if (!raw) throw new Error('无法获取配置')
    const cfg = JSON.parse(raw)
    if (cfg.plugins?.entries?.[plugin.id]) {
      delete cfg.plugins.entries[plugin.id]
    }
    await gwRequest('config.set', { raw: JSON.stringify(cfg), baseHash: cfgRes.hash })
    showToast(`${plugin.id} 已卸载`, 'success')
    await fetchData()
  } catch (e) {
    showToast('卸载失败: ' + e.message, 'error')
  }
}

// 插件仓库 - 预置插件列表
const presetPlugins = [
  { id: '@openclaw/feishu', name: '飞书插件', desc: '飞书/Lark 官方插件，支持消息、文档、日历、任务等', category: '渠道', icon: '🐦' },
  { id: '@openclaw/qqbot', name: 'QQ Bot 插件', desc: 'QQ 机器人官方插件', category: '渠道', icon: '🐧' },
  { id: '@openclaw/telegram', name: 'Telegram 插件', desc: 'Telegram Bot 官方插件', category: '渠道', icon: '✈️' },
  { id: '@openclaw/discord', name: 'Discord 插件', desc: 'Discord Bot 官方插件', category: '渠道', icon: '🎮' },
  { id: '@openclaw/slack', name: 'Slack 插件', desc: 'Slack App 官方插件', category: '渠道', icon: '💼' },
]

// 从插件仓库安装
async function installFromRegistry(plugin) {
  try {
    const cfgRes = await gwRequest('config.get')
    const raw = getRawConfig(cfgRes)
    if (!raw) throw new Error('无法获取配置')
    const cfg = JSON.parse(raw)
    if (!cfg.plugins) cfg.plugins = {}
    if (!cfg.plugins.entries) cfg.plugins.entries = {}
    cfg.plugins.entries[plugin.id] = { enabled: true }
    await gwRequest('config.set', { raw: JSON.stringify(cfg), baseHash: cfgRes.hash })
    showToast(`${plugin.name} 已安装`, 'success')
    showInstallModal.value = false
    await fetchData()
  } catch (e) {
    showToast('安装失败: ' + e.message, 'error')
  }
}

// 手动安装插件
async function installPlugin() {
  if (!installForm.value.pluginId) { showToast('请输入插件 ID', 'error'); return }
  try {
    const cfgRes = await gwRequest('config.get')
    const raw = getRawConfig(cfgRes)
    if (!raw) throw new Error('无法获取配置')
    const cfg = JSON.parse(raw)
    if (!cfg.plugins) cfg.plugins = {}
    if (!cfg.plugins.entries) cfg.plugins.entries = {}
    cfg.plugins.entries[installForm.value.pluginId] = { enabled: true }
    await gwRequest('config.set', { raw: JSON.stringify(cfg), baseHash: cfgRes.hash })
    showToast(`${installForm.value.pluginId} 已安装`, 'success')
    showInstallModal.value = false
    installForm.value.pluginId = ''
    await fetchData()
  } catch (e) {
    showToast('安装失败: ' + e.message, 'error')
  }
}

const installForm = ref({ pluginId: '' })
const pluginFilter = ref('all')

const filteredPresetPlugins = computed(() => {
  if (pluginFilter.value === 'all') return presetPlugins
  return presetPlugins.filter(p => p.category === pluginFilter.value)
})

onMounted(fetchData)
</script>

<template>
  <div class="space-y-6">
    <!-- 共享组件 -->
    <Toast ref="toastRef" />
    <ConfirmDialog ref="confirmRef" />

    <!-- 添加渠道弹窗 - 重写 UI -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showAddChannelModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="showAddChannelModal = false">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
          <div class="relative bg-white rounded-2xl w-full max-w-lg mx-auto shadow-2xl overflow-hidden">
            <!-- 头部 -->
            <div class="px-6 py-4 bg-gradient-to-r from-indigo-500 to-purple-600">
              <h3 class="text-lg font-bold text-white">添加渠道</h3>
              <p class="text-sm text-white/80 mt-0.5">选择要添加的消息渠道</p>
            </div>
            
            <div class="p-6 max-h-[70vh] overflow-y-auto">
              <!-- 渠道类型选择 -->
              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-3">选择渠道类型</label>
                <div class="grid grid-cols-2 gap-3">
                  <button v-for="ct in channelTypes" :key="ct.id"
                    @click="addForm.channel = ct.id"
                    class="flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left"
                    :class="addForm.channel === ct.id 
                      ? 'border-indigo-500 bg-indigo-50 shadow-sm' 
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'">
                    <span class="text-2xl">{{ ct.icon }}</span>
                    <div>
                      <p class="text-sm font-semibold text-gray-900">{{ ct.name }}</p>
                      <p class="text-xs text-gray-500 mt-0.5">{{ ct.desc }}</p>
                    </div>
                  </button>
                </div>
              </div>

              <!-- 配置表单 -->
              <Transition name="slide">
                <div v-if="selectedChannelType && selectedChannelType.fields.length > 0" class="space-y-4">
                  <div class="flex items-center gap-2 text-sm text-gray-600">
                    <span>{{ selectedChannelType.icon }}</span>
                    <span class="font-medium">{{ selectedChannelType.name }} 配置</span>
                  </div>
                  
                  <div v-for="f in selectedChannelType.fields" :key="f.key" class="space-y-1.5">
                    <label class="flex items-center gap-1 text-sm font-medium text-gray-700">
                      {{ f.label }}
                      <span v-if="f.required" class="text-red-500">*</span>
                    </label>
                    <input v-model="addForm.config[f.key]"
                      :type="f.type || 'text'"
                      :placeholder="f.placeholder"
                      class="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm
                             focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                             placeholder:text-gray-400 transition-all">
                  </div>
                </div>
              </Transition>

              <!-- 无配置字段的渠道提示 -->
              <div v-if="selectedChannelType && selectedChannelType.fields.length === 0" 
                   class="p-4 bg-amber-50 rounded-xl border border-amber-200 mt-4">
                <div class="flex items-start gap-3">
                  <span class="text-xl">⚠️</span>
                  <div>
                    <p class="text-sm font-medium text-amber-800">需要额外配置</p>
                    <p class="text-xs text-amber-600 mt-1">
                      {{ selectedChannelType.name }} 需要额外的配置步骤，请参考官方文档完成配置。
                    </p>
                    <a v-if="selectedChannelType.docs" :href="selectedChannelType.docs" target="_blank"
                       class="text-xs text-indigo-600 hover:underline mt-2 inline-block">
                      查看文档 →
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <!-- 底部按钮 -->
            <div class="px-6 py-4 bg-gray-50 border-t flex items-center justify-between">
              <button @click="showAddChannelModal = false" 
                      class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                取消
              </button>
              <button @click="addChannel" 
                      :disabled="saving || !addForm.channel"
                      class="px-6 py-2.5 text-sm font-medium text-white rounded-xl
                             bg-gradient-to-r from-indigo-500 to-purple-600 
                             hover:from-indigo-600 hover:to-purple-700
                             disabled:opacity-50 disabled:cursor-not-allowed
                             transition-all shadow-sm hover:shadow-md">
                {{ saving ? '添加中...' : '添加渠道' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 安装插件弹窗 - 重写 UI -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showInstallModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="showInstallModal = false">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
          <div class="relative bg-white rounded-2xl w-full max-w-2xl mx-auto shadow-2xl overflow-hidden">
            <!-- 头部 -->
            <div class="px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-600">
              <h3 class="text-lg font-bold text-white">插件管理</h3>
              <p class="text-sm text-white/80 mt-0.5">安装和管理 OpenClaw 插件</p>
            </div>
            
            <div class="p-6 max-h-[70vh] overflow-y-auto">
              <!-- 插件仓库 -->
              <div class="mb-6">
                <div class="flex items-center justify-between mb-4">
                  <h4 class="text-sm font-semibold text-gray-900">插件仓库</h4>
                  <div class="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                    <button v-for="f in ['all', '渠道']" :key="f"
                      @click="pluginFilter = f"
                      class="px-3 py-1 text-xs rounded-md transition-all"
                      :class="pluginFilter === f ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'">
                      {{ f === 'all' ? '全部' : f }}
                    </button>
                  </div>
                </div>
                
                <div class="space-y-2">
                  <div v-for="plugin in filteredPresetPlugins" :key="plugin.id"
                    class="flex items-center gap-4 p-3 rounded-xl border border-gray-200 
                           hover:border-gray-300 hover:bg-gray-50 transition-all group">
                    <span class="text-2xl">{{ plugin.icon }}</span>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-semibold text-gray-900">{{ plugin.name }}</p>
                      <p class="text-xs text-gray-500 mt-0.5">{{ plugin.desc }}</p>
                      <p class="text-xs text-gray-400 mt-0.5 font-mono">{{ plugin.id }}</p>
                    </div>
                    <button @click="installFromRegistry(plugin)"
                            class="px-4 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 
                                   rounded-lg border border-emerald-200 
                                   hover:bg-emerald-100 transition-all
                                   opacity-0 group-hover:opacity-100">
                      安装
                    </button>
                  </div>
                </div>
              </div>

              <!-- 分隔线 -->
              <div class="relative my-6">
                <div class="absolute inset-0 flex items-center">
                  <div class="w-full border-t border-gray-200"></div>
                </div>
                <div class="relative flex justify-center">
                  <span class="bg-white px-3 text-xs text-gray-400">或手动安装</span>
                </div>
              </div>

              <!-- 手动安装 -->
              <div class="space-y-3">
                <label class="block text-sm font-medium text-gray-700">手动输入插件 ID</label>
                <div class="flex gap-2">
                  <input v-model="installForm.pluginId" 
                         class="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-sm
                                focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                                placeholder:text-gray-400 font-mono"
                         placeholder="@scope/plugin-name">
                  <button @click="installPlugin"
                          class="px-6 py-2.5 text-sm font-medium text-white rounded-xl
                                 bg-gradient-to-r from-emerald-500 to-teal-600
                                 hover:from-emerald-600 hover:to-teal-700
                                 transition-all shadow-sm hover:shadow-md">
                    安装
                  </button>
                </div>
              </div>
            </div>

            <!-- 底部 -->
            <div class="px-6 py-4 bg-gray-50 border-t text-right">
              <button @click="showInstallModal = false" 
                      class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                关闭
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 渠道详情弹窗 -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showChannelDetail" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="closeChannelDetail">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
          <div class="relative bg-white rounded-2xl w-full max-w-lg mx-auto shadow-2xl overflow-hidden">
            <!-- 头部 -->
            <div class="px-6 py-4 bg-gradient-to-r from-blue-500 to-cyan-600">
              <div class="flex items-center gap-3">
                <span class="text-3xl">{{ getChannelIcon(showChannelDetail.id) }}</span>
                <div>
                  <h3 class="text-lg font-bold text-white">{{ getChannelName(showChannelDetail.id) }}</h3>
                  <p class="text-sm text-white/80">{{ showChannelDetail.id }}</p>
                </div>
              </div>
            </div>
            
            <div class="p-6 max-h-[60vh] overflow-y-auto space-y-4">
              <!-- 状态 -->
              <div class="flex items-center justify-between p-3 rounded-xl"
                   :class="showChannelDetail.enabled ? 'bg-green-50' : 'bg-gray-50'">
                <span class="text-sm text-gray-700">状态</span>
                <span class="text-sm font-medium"
                      :class="showChannelDetail.enabled ? 'text-green-600' : 'text-gray-500'">
                  {{ showChannelDetail.enabled ? '已启用' : '已禁用' }}
                </span>
              </div>

              <!-- 配置字段 -->
              <div class="space-y-3">
                <h4 class="text-sm font-semibold text-gray-900">配置信息</h4>
                
                <template v-for="(value, key) in showChannelDetail.config" :key="key">
                  <div v-if="key !== 'enabled'" class="space-y-1.5">
                    <label class="flex items-center gap-1 text-sm font-medium text-gray-700">
                      {{ key }}
                    </label>
                    <input v-model="showChannelDetail.config[key]"
                           :type="key.toLowerCase().includes('secret') || key.toLowerCase().includes('token') || key.toLowerCase().includes('password') ? 'password' : 'text'"
                           class="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm
                                  focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                                  font-mono transition-all">
                  </div>
                </template>
              </div>
            </div>

            <!-- 底部按钮 -->
            <div class="px-6 py-4 bg-gray-50 border-t flex items-center justify-between">
              <button @click="closeChannelDetail" 
                      class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                取消
              </button>
              <button @click="saveChannelConfig" 
                      :disabled="saving"
                      class="px-6 py-2.5 text-sm font-medium text-white rounded-xl
                             bg-gradient-to-r from-blue-500 to-cyan-600
                             hover:from-blue-600 hover:to-cyan-700
                             disabled:opacity-50 transition-all shadow-sm hover:shadow-md">
                {{ saving ? '保存中...' : '保存配置' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 页面标题 -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-gray-900">渠道管理</h2>
        <p class="text-sm text-gray-500 mt-1">管理消息渠道和插件</p>
      </div>
      <div class="flex gap-2">
        <button @click="fetchData" 
                class="px-4 py-2 text-sm text-gray-700 bg-white rounded-xl border border-gray-300 
                       hover:bg-gray-50 hover:border-gray-400 transition-all">
          🔄 刷新
        </button>
        <button @click="showAddChannelModal = true" 
                class="px-4 py-2 text-sm text-white rounded-xl
                       bg-gradient-to-r from-indigo-500 to-purple-600 
                       hover:from-indigo-600 hover:to-purple-700
                       transition-all shadow-sm hover:shadow-md">
          + 添加渠道
        </button>
        <button @click="showInstallModal = true" 
                class="px-4 py-2 text-sm text-white rounded-xl
                       bg-gradient-to-r from-emerald-500 to-teal-600
                       hover:from-emerald-600 hover:to-teal-700
                       transition-all shadow-sm hover:shadow-md">
          🧩 插件管理
        </button>
      </div>
    </div>

    <!-- EventLoop 状态 -->
    <div v-if="eventLoop" class="rounded-xl border p-4"
      :class="eventLoop.degraded ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-lg">{{ eventLoop.degraded ? '⚠️' : '✅' }}</span>
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
    <div class="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
      <button v-for="tab in tabs" :key="tab.key"
        @click="activeTab = tab.key"
        class="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
        :class="activeTab === tab.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'">
        <span>{{ tab.icon }}</span>
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-20">
      <div class="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      <p class="text-sm text-gray-500 mt-4">加载中...</p>
    </div>

    <!-- 渠道列表 -->
    <div v-else-if="activeTab === 'channels'" class="space-y-3">
      <!-- 未知渠道警告 -->
      <div v-for="ch in unknownChannels" :key="ch.id"
           class="bg-amber-50 rounded-xl border border-amber-200 p-4">
        <div class="flex items-center gap-3">
          <span class="text-xl">⚠️</span>
          <div class="flex-1">
            <p class="text-sm font-medium text-amber-800">
              未知渠道类型: {{ ch.id }}
            </p>
            <p class="text-xs text-amber-600 mt-0.5">
              此渠道 ID 不在 OpenClaw 支持列表中，可能是配置错误
            </p>
          </div>
          <button @click="removeChannel(ch)"
                  class="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg border border-red-200 hover:bg-red-100">
            删除
          </button>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="channelEntries.length === 0" 
           class="text-center py-20 bg-white rounded-2xl border border-gray-200">
        <div class="w-20 h-20 mx-auto mb-6 rounded-2xl bg-indigo-50 flex items-center justify-center">
          <span class="text-4xl">📡</span>
        </div>
        <p class="text-lg font-semibold text-gray-900">暂无渠道</p>
        <p class="text-sm text-gray-500 mt-2">添加第一个消息渠道开始使用</p>
        <button @click="showAddChannelModal = true"
                class="mt-6 px-6 py-2.5 text-sm font-medium text-white rounded-xl
                       bg-gradient-to-r from-indigo-500 to-purple-600 
                       hover:from-indigo-600 hover:to-purple-700
                       transition-all shadow-sm hover:shadow-md">
          + 添加渠道
        </button>
      </div>

      <!-- 渠道卡片 -->
      <div v-for="ch in channelEntries.filter(c => channelTypes.some(ct => ct.id === c.id))" :key="ch.id"
        class="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:border-gray-300 
               hover:shadow-sm transition-all group">
        <div class="p-5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                :class="ch.enabled !== false ? 'bg-indigo-50' : 'bg-gray-100'">
                {{ getChannelIcon(ch.id) }}
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <p class="text-base font-semibold text-gray-900">{{ getChannelName(ch.id) }}</p>
                  <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium"
                    :class="ch.enabled !== false ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500 border border-gray-200'">
                    <span class="w-1.5 h-1.5 rounded-full" :class="ch.enabled !== false ? 'bg-green-500' : 'bg-gray-400'"></span>
                    {{ ch.enabled !== false ? '已启用' : '已禁用' }}
                  </span>
                </div>
                <p class="text-xs text-gray-400 mt-1 font-mono">{{ ch.id }}</p>
              </div>
            </div>
            
            <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button @click="openChannelDetail(ch)"
                      class="px-3 py-1.5 rounded-lg text-xs font-medium 
                             bg-blue-50 text-blue-600 hover:bg-blue-100 
                             border border-blue-200 transition-all">
                ⚙️ 配置
              </button>
              <button @click="toggleChannel(ch)"
                class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                :class="ch.enabled !== false
                  ? 'bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200'
                  : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'">
                {{ ch.enabled !== false ? '禁用' : '启用' }}
              </button>
              <button @click="removeChannel(ch)"
                      class="px-3 py-1.5 rounded-lg text-xs font-medium 
                             bg-red-50 text-red-600 hover:bg-red-100 
                             border border-red-200 transition-all">
                删除
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 插件管理 -->
    <div v-else-if="activeTab === 'plugins'" class="space-y-3">
      <!-- 空状态 -->
      <div v-if="pluginEntries.length === 0" 
           class="text-center py-20 bg-white rounded-2xl border border-gray-200">
        <div class="w-20 h-20 mx-auto mb-6 rounded-2xl bg-emerald-50 flex items-center justify-center">
          <span class="text-4xl">🧩</span>
        </div>
        <p class="text-lg font-semibold text-gray-900">暂无插件</p>
        <p class="text-sm text-gray-500 mt-2">从插件仓库安装第一个插件</p>
        <button @click="showInstallModal = true"
                class="mt-6 px-6 py-2.5 text-sm font-medium text-white rounded-xl
                       bg-gradient-to-r from-emerald-500 to-teal-600
                       hover:from-emerald-600 hover:to-teal-700
                       transition-all shadow-sm hover:shadow-md">
          🧩 插件管理
        </button>
      </div>

      <!-- 插件卡片 -->
      <div v-for="pl in pluginEntries" :key="pl.id"
        class="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:border-gray-300 
               hover:shadow-sm transition-all group">
        <div class="p-5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                :class="pl.enabled ? 'bg-emerald-50' : 'bg-gray-100'">
                🧩
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <p class="text-base font-semibold text-gray-900">{{ pl.id }}</p>
                  <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium"
                    :class="pl.enabled ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500 border border-gray-200'">
                    <span class="w-1.5 h-1.5 rounded-full" :class="pl.enabled ? 'bg-green-500' : 'bg-gray-400'"></span>
                    {{ pl.enabled ? '已启用' : '已禁用' }}
                  </span>
                </div>
                <p class="text-xs text-gray-400 mt-1">{{ pl.config }}</p>
              </div>
            </div>
            
            <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button @click="togglePlugin(pl)" 
                      class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      :class="pl.enabled ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-green-50 text-green-600 border border-green-200'">
                {{ pl.enabled ? '禁用' : '启用' }}
              </button>
              <button @click="uninstallPlugin(pl)" 
                      class="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 border border-red-200">
                卸载
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 弹窗动画 */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.95) translateY(10px);
}

/* 表单滑入动画 */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateY(-10px);
}

.slide-enter-to,
.slide-leave-from {
  max-height: 300px;
}
</style>
