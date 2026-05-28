<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { gwRequest } from '../stores/gateway.js'
import { getRawConfig } from "../api/config-utils.js"
import AppToast from '../components/AppToast.vue'
import AppConfirm from '../components/AppConfirm.vue'
import AppButton from '../components/AppButton.vue'
import AppModal from '../components/AppModal.vue'
import AppBadge from '../components/AppBadge.vue'
import { useEnterAnim } from '../composables/useEnterAnim.js'

const channelsData = ref(null)
const configData = ref(null)
const loading = ref(true)
const toastRef = ref(null)
const confirmRef = ref(null)
const activeTab = ref('channels')
const showInstallModal = ref(false)
const showAddModal = ref(false)
const showDetail = ref(null)
const installForm = ref({ pluginId: '' })
const addForm = ref({ channel: '', config: {} })
const saving = ref(false)
const showPwd = ref({})
const channelFilter = ref('')
const pluginFilter = ref('')
const { entered } = useEnterAnim()

function togglePwd(k) { showPwd.value[k] = !showPwd.value[k] }
function showConfirm(m) { return confirmRef.value?.confirm(m) || false }
function showToast(m, type = 'info') { toastRef.value?.show(m, type) }

const tabs = [
  { key: 'channels', label: '渠道状态', icon: '📡' },
  { key: 'plugins', label: '插件管理', icon: '🧩' },
]

const channelTypes = [
  { id: 'feishu', name: '飞书', icon: '🐦', fields: [
    { key: 'appId', label: 'App ID', placeholder: 'cli_xxx', required: true },
    { key: 'appSecret', label: 'App Secret', placeholder: '请输入 App Secret', required: true, type: 'password' },
  ]},
  { id: 'telegram', name: 'Telegram', icon: '✈️', fields: [
    { key: 'token', label: 'Bot Token', placeholder: '请输入 Bot Token', required: true, type: 'password' },
  ]},
  { id: 'discord', name: 'Discord', icon: '🎮', fields: [
    { key: 'token', label: 'Bot Token', placeholder: '请输入 Bot Token', required: true, type: 'password' },
  ]},
  { id: 'slack', name: 'Slack', icon: '💼', fields: [
    { key: 'token', label: 'Bot Token', placeholder: '请输入 Bot Token', required: true, type: 'password' },
  ]},
  { id: 'qqbot', name: 'QQ Bot', icon: '🐧', fields: [
    { key: 'appId', label: 'App ID', placeholder: '请输入 App ID', required: true },
    { key: 'clientSecret', label: 'Client Secret', placeholder: '请输入 Client Secret', required: true, type: 'password' },
  ]},
]
const selectedType = computed(() => channelTypes.find(c => c.id === addForm.value.channel))

const icons = { feishu:'🐦', qqbot:'🐧', telegram:'✈️', discord:'🎮', slack:'💼', whatsapp:'📱', signal:'🔒', line:'🟢', matrix:'🔗', irc:'💬', nostr:'🟣', msteams:'🏢', googlechat:'📧', twitch:'🎥', 'synology-chat':'🏠', 'nextcloud-talk':'☁️', mattermost:'🔵', imessage:'💬' }
const names = { feishu:'飞书', qqbot:'QQ Bot', telegram:'Telegram', discord:'Discord', slack:'Slack', whatsapp:'WhatsApp', signal:'Signal', line:'LINE', matrix:'Matrix', irc:'IRC', nostr:'Nostr', msteams:'Teams', googlechat:'Google Chat', twitch:'Twitch', 'synology-chat':'Synology', 'nextcloud-talk':'Nextcloud', mattermost:'Mattermost', imessage:'iMessage' }
function getIcon(id) { return icons[id] || '📡' }
function getName(id) { return names[id] || id }

async function fetchData() {
  loading.value = true
  try {
    const [ch, cfg] = await Promise.all([gwRequest('channels.status').catch(() => null), gwRequest('config.get').catch(() => null)])
    channelsData.value = ch
    configData.value = cfg?.parsed || null
  } catch (e) { showToast('加载失败: ' + e.message, 'error') }
  loading.value = false
}

const eventLoop = computed(() => channelsData.value?.eventLoop || null)
const channelEntries = computed(() => {
  const ch = channelsData.value?.channels || {}
  return Object.entries(ch).map(([id, info]) => ({ id, ...info }))
})
const pluginEntries = computed(() => {
  const entries = configData.value?.plugins?.entries || {}
  return Object.entries(entries).map(([id, cfg]) => ({ id, config: cfg, enabled: cfg.enabled !== false }))
})

function getChannelConfig(id) { return (configData.value?.channels || {})[id] || {} }
function openDetail(ch) { showPwd.value = {}; showDetail.value = { id: ch.id, config: { ...getChannelConfig(ch.id) }, enabled: ch.enabled !== false } }

// ── 通用操作函数 ──────────────────────────────────
async function loadRawCfg() {
  const cfgRes = await gwRequest('config.get')
  const raw = getRawConfig(cfgRes)
  if (!raw) throw new Error('无法获取配置')
  return { cfg: JSON.parse(raw), hash: cfgRes.hash }
}

async function updateChannel(channelId, patch, successMsg) {
  saving.value = true
  try {
    const { cfg, hash } = await loadRawCfg()
    if (!cfg.channels) cfg.channels = {}
    if (patch === null) {
      // 删除渠道
      delete cfg.channels[channelId]
    } else {
      if (!cfg.channels[channelId]) cfg.channels[channelId] = {}
      Object.assign(cfg.channels[channelId], patch)
    }
    await gwRequest('config.set', { raw: JSON.stringify(cfg), baseHash: hash })
    if (successMsg) showToast(successMsg)
    await fetchData()
  } catch (e) { showToast('操作失败: ' + e.message, 'error') }
  saving.value = false
}

async function updatePlugin(pluginId, patch, successMsg) {
  saving.value = true
  try {
    const { cfg, hash } = await loadRawCfg()
    if (!cfg.plugins) cfg.plugins = {}
    if (!cfg.plugins.entries) cfg.plugins.entries = {}
    if (patch === null) {
      // 删除插件
      delete cfg.plugins.entries[pluginId]
    } else {
      if (!cfg.plugins.entries[pluginId]) cfg.plugins.entries[pluginId] = {}
      Object.assign(cfg.plugins.entries[pluginId], patch)
    }
    await gwRequest('config.set', { raw: JSON.stringify(cfg), baseHash: hash })
    if (successMsg) showToast(successMsg)
    await fetchData()
  } catch (e) { showToast('操作失败: ' + e.message, 'error') }
  saving.value = false
}

// ── 渠道操作 ──────────────────────────────────────
async function saveDetail() {
  if (!showDetail.value) return
  await updateChannel(showDetail.value.id, showDetail.value.config, '配置已保存，重启后生效')
  showDetail.value = null
}

async function addChannel() {
  if (!addForm.value.channel) { showToast('请选择渠道类型'); return }
  const type = selectedType.value
  if (!type) return
  for (const f of type.fields) { if (f.required && !addForm.value.config[f.key]) { showToast(`请填写 ${f.label}`); return } }
  const chCfg = { enabled: true }
  for (const f of type.fields) { if (addForm.value.config[f.key]) chCfg[f.key] = addForm.value.config[f.key] }
  await updateChannel(addForm.value.channel, chCfg, `${type.name} 渠道已添加，重启后生效`)
  showAddModal.value = false
  addForm.value = { channel: '', config: {} }
}

async function removeChannel(ch) {
  if (!await showConfirm(`确定删除渠道「${getName(ch.id)}」？`)) return
  await updateChannel(ch.id, null, `${getName(ch.id)} 已删除`)
}

async function toggleChannel(ch) {
  const enabled = ch.enabled === false
  await updateChannel(ch.id, { enabled }, `${getName(ch.id)} 已${enabled ? '启用' : '禁用'}`)
}

// ── 插件操作 ──────────────────────────────────────
async function togglePlugin(pl) {
  await updatePlugin(pl.id, { enabled: !pl.enabled }, `${pl.id} 已${!pl.enabled ? '启用' : '禁用'}`)
}

async function uninstallPlugin(pl) {
  if (!await showConfirm(`确定卸载插件「${pl.id}」？`)) return
  await updatePlugin(pl.id, null, `${pl.id} 已卸载`)
}

const presetPlugins = [
  { id: '@openclaw/feishu', name: '飞书插件', desc: '飞书/Lark 官方插件', icon: '🐦' },
  { id: '@openclaw/qqbot', name: 'QQ Bot 插件', desc: 'QQ 机器人官方插件', icon: '🐧' },
  { id: '@openclaw/telegram', name: 'Telegram 插件', desc: 'Telegram Bot 官方插件', icon: '✈️' },
  { id: '@openclaw/discord', name: 'Discord 插件', desc: 'Discord Bot 官方插件', icon: '🎮' },
  { id: '@openclaw/slack', name: 'Slack 插件', desc: 'Slack App 官方插件', icon: '💼' },
]

async function installFromPreset(p) {
  await updatePlugin(p.id, { enabled: true }, `${p.name} 已安装`)
  showInstallModal.value = false
}

async function installPlugin() {
  if (!installForm.value.pluginId) { showToast('请输入插件 ID'); return }
  await updatePlugin(installForm.value.pluginId, { enabled: true }, `${installForm.value.pluginId} 已安装`)
  showInstallModal.value = false
  installForm.value.pluginId = ''
}

// ── 搜索过滤 ──────────────────────────────────────
const filteredChannels = computed(() => {
  if (!channelFilter.value) return channelEntries.value
  const q = channelFilter.value.toLowerCase()
  return channelEntries.value.filter(ch =>
    getName(ch.id).toLowerCase().includes(q) ||
    ch.id.toLowerCase().includes(q)
  )
})

const filteredPlugins = computed(() => {
  if (!pluginFilter.value) return pluginEntries.value
  const q = pluginFilter.value.toLowerCase()
  return pluginEntries.value.filter(pl => pl.id.toLowerCase().includes(q))
})

onMounted(fetchData)
</script>

<template>
  <div class="space-y-5">
    <AppToast ref="toastRef" />
    <AppConfirm ref="confirmRef" />

    <!-- 添加渠道弹窗 -->
    <AppModal v-model:visible="showAddModal" title="添加渠道" width="440px">
      <form autocomplete="off" @submit.prevent="addChannel">
        <!-- 隐藏虚拟输入框，吸收浏览器自动填充 -->
        <input type="text" name="username" autocomplete="username" style="display:none" aria-hidden="true">
        <input type="password" name="password" autocomplete="new-password" style="display:none" aria-hidden="true">
        <div class="space-y-4">
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-2">渠道类型</label>
            <div class="grid grid-cols-3 gap-2">
              <AppButton size="sm" :variant="addForm.channel === ct.id ? 'primary' : 'default'"
                v-for="ct in channelTypes" :key="ct.id" type="button"
                @click="addForm.channel = ct.id">
                <span>{{ ct.icon }}</span>
                <span class="ml-1">{{ ct.name }}</span>
              </AppButton>
            </div>
          </div>
          <template v-if="selectedType">
            <div v-for="f in selectedType.fields" :key="f.key">
              <label class="block text-xs font-medium text-gray-500 mb-1.5">
                {{ f.label }} <span v-if="f.required" class="text-red-500">*</span>
              </label>
              <div class="relative">
                <input v-model="addForm.config[f.key]"
                  :type="f.type === 'password' && !showPwd['add_'+f.key] ? 'password' : 'text'"
                  :placeholder="f.placeholder"
                  :autocomplete="f.type === 'password' ? 'new-password' : 'off'"
                  :aria-label="f.label"
                  readonly @focus="$event.target.removeAttribute('readonly')"
                  class="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/5 focus:border-gray-400 transition-all pr-9">
                <AppButton v-if="f.type === 'password'" size="xs" variant="ghost"
                  @click="togglePwd('add_'+f.key)"
                  class="absolute right-2 top-1/2 -translate-y-1/2">
                  {{ showPwd['add_'+f.key] ? '🙈' : '👁️' }}
                </AppButton>
              </div>
            </div>
          </template>
        </div>
      </form>
      <template #footer>
        <AppButton @click="showAddModal = false">取消</AppButton>
        <AppButton variant="primary" :loading="saving" :disabled="!addForm.channel" @click="addChannel">
          {{ saving ? '添加中...' : '添加渠道' }}
        </AppButton>
      </template>
    </AppModal>

    <!-- 安装插件弹窗 -->
    <AppModal v-model:visible="showInstallModal" title="安装插件" width="480px">
      <form autocomplete="off" @submit.prevent="installPlugin">
        <!-- 隐藏虚拟输入框，吸收浏览器自动填充 -->
        <input type="text" name="username" autocomplete="username" style="display:none" aria-hidden="true">
        <input type="password" name="password" autocomplete="new-password" style="display:none" aria-hidden="true">
        <div class="space-y-4">
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-2">推荐插件</label>
            <div class="space-y-1">
              <div v-for="p in presetPlugins" :key="p.id"
                class="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group"
                @click="installFromPreset(p)">
                <span class="text-lg">{{ p.icon }}</span>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-gray-900">{{ p.name }}</div>
                  <div class="text-xs text-gray-500">{{ p.desc }}</div>
                </div>
                <span class="text-xs font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">安装</span>
              </div>
            </div>
          </div>
          <div class="border-t border-gray-100 pt-4">
            <label class="block text-xs font-medium text-gray-500 mb-2">手动输入插件 ID</label>
            <div class="flex gap-2">
              <input v-model="installForm.pluginId"
                autocomplete="off" readonly @focus="$event.target.removeAttribute('readonly')"
                aria-label="插件 ID"
                class="flex-1 px-3 py-2 text-sm font-mono bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/5 focus:border-gray-400 transition-all"
                placeholder="@scope/plugin-name">
              <AppButton variant="primary" @click="installPlugin">安装</AppButton>
            </div>
          </div>
        </div>
      </form>
      <template #footer>
        <AppButton @click="showInstallModal = false">关闭</AppButton>
      </template>
    </AppModal>

    <!-- 渠道详情弹窗 -->
    <AppModal :visible="!!showDetail" :title="showDetail ? getName(showDetail.id) : ''" width="440px" @close="showDetail = null" @update:visible="val => { if (!val) showDetail = null }">
      <template v-if="showDetail">
        <form autocomplete="off" @submit.prevent="saveDetail">
          <!-- 隐藏虚拟输入框，吸收浏览器自动填充 -->
          <input type="text" name="username" autocomplete="username" style="display:none" aria-hidden="true">
          <input type="password" name="password" autocomplete="new-password" style="display:none" aria-hidden="true">
          <div class="flex items-center gap-2 mb-4">
            <span class="text-xl">{{ getIcon(showDetail.id) }}</span>
            <span class="text-xs text-gray-400 font-mono">{{ showDetail.id }}</span>
          </div>
          <div class="space-y-3 max-h-80 overflow-y-auto">
            <div class="flex items-center justify-between p-2.5 rounded-lg"
              :class="showDetail.enabled ? 'bg-green-50' : 'bg-gray-50'">
              <span class="text-xs text-gray-500">状态</span>
              <AppBadge :type="showDetail.enabled ? 'success' : 'default'" size="sm">
                {{ showDetail.enabled ? '已启用' : '已禁用' }}
              </AppBadge>
            </div>
            <template v-for="(val, key) in showDetail.config" :key="key">
              <div v-if="key !== 'enabled'">
                <label class="block text-xs font-medium text-gray-500 mb-1.5">{{ key }}</label>
                <div class="relative">
                  <input v-model="showDetail.config[key]"
                    :type="(key.toLowerCase().includes('secret') || key.toLowerCase().includes('token')) && !showPwd['d_'+key] ? 'password' : 'text'"
                    :autocomplete="(key.toLowerCase().includes('secret') || key.toLowerCase().includes('token')) ? 'new-password' : 'off'"
                    :aria-label="key" readonly @focus="$event.target.removeAttribute('readonly')"
                    class="w-full px-3 py-2 text-sm font-mono bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/5 focus:border-gray-400 transition-all pr-9">
                  <AppButton v-if="key.toLowerCase().includes('secret') || key.toLowerCase().includes('token')" size="xs" variant="ghost"
                    @click="togglePwd('d_'+key)"
                    class="absolute right-2 top-1/2 -translate-y-1/2">
                    {{ showPwd['d_'+key] ? '🙈' : '👁️' }}
                  </AppButton>
                </div>
              </div>
            </template>
          </div>
        </form>
      </template>
      <template #footer>
        <AppButton @click="showDetail = null">取消</AppButton>
        <AppButton variant="primary" :loading="saving" @click="saveDetail">
          {{ saving ? '保存中...' : '保存配置' }}
        </AppButton>
      </template>
    </AppModal>

    <!-- 页面头部 -->
    <div class="flex items-center justify-between enter-anim" :class="{ 'is-entered': entered }" style="--delay: 0ms">
      <div>
        <h2 class="text-lg font-bold text-gray-900">渠道管理</h2>
        <p class="text-sm text-gray-500 mt-0.5">管理消息渠道和插件</p>
      </div>
      <div class="flex gap-2">
        <AppButton size="sm" @click="fetchData">刷新</AppButton>
        <AppButton size="sm" variant="primary" @click="showAddModal = true">+ 添加渠道</AppButton>
        <AppButton size="sm" @click="showInstallModal = true">🧩 安装插件</AppButton>
      </div>
    </div>

    <!-- EventLoop 状态 -->
    <div v-if="eventLoop" class="rounded-lg border p-3 flex items-center gap-2 text-sm enter-anim" :class="[{ 'is-entered': entered }, eventLoop.degraded ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-green-50 border-green-200 text-green-800']" style="--delay: 80ms">
      <span>{{ eventLoop.degraded ? '⚠️' : '✅' }}</span>
      <span class="font-medium">事件循环{{ eventLoop.degraded ? '降级' : '正常' }}</span>
      <span class="ml-auto text-xs" :class="eventLoop.degraded ? 'text-amber-600' : 'text-green-600'">
        <template v-if="eventLoop.utilization">利用率 {{ (eventLoop.utilization * 100).toFixed(0) }}%</template>
        <template v-if="eventLoop.delayP99Ms"> · P99 {{ eventLoop.delayP99Ms.toFixed(0) }}ms</template>
      </span>
    </div>

    <!-- Tab 切换 -->
    <div class="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit enter-anim" :class="{ 'is-entered': entered }" style="--delay: 120ms">
      <AppButton size="sm" :variant="activeTab === tab.key ? 'primary' : 'default'"
        v-for="tab in tabs" :key="tab.key"
        @click="activeTab = tab.key">
        <span>{{ tab.icon }}</span>
        <span class="ml-1">{{ tab.label }}</span>
      </AppButton>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin"></div>
    </div>

    <!-- 渠道列表 -->
    <div v-else-if="activeTab === 'channels'" class="space-y-2 enter-anim" :class="{ 'is-entered': entered }" style="--delay: 160ms">
      <!-- 搜索框（有数据时显示） -->
      <div v-if="channelEntries.length > 0" class="relative">
        <input v-model="channelFilter"
          type="search" placeholder="搜索渠道..."
          class="w-full pl-8 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-lg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/5 focus:border-gray-400 transition-all">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">🔍</span>
      </div>
      <!-- 空状态 -->
      <div v-if="filteredChannels.length === 0 && channelEntries.length === 0" class="card-accent card-hover text-center py-16 bg-white rounded-2xl border border-gray-200/60">
        <span class="text-3xl mb-3 block">📡</span>
        <p class="text-sm font-medium text-gray-600">暂无渠道</p>
        <p class="text-xs text-gray-400 mt-1">点击"添加渠道"开始</p>
      </div>
      <!-- 无搜索结果 -->
      <div v-else-if="filteredChannels.length === 0 && channelEntries.length > 0" class="card-accent card-hover text-center py-10 bg-white rounded-2xl border border-gray-200/60">
        <p class="text-sm text-gray-400">未找到匹配「{{ channelFilter }}」的渠道</p>
      </div>
      <!-- 渠道卡片 -->
      <div v-for="ch in filteredChannels" :key="ch.id"
        class="card-accent card-hover bg-white rounded-xl border border-gray-200/60 p-4 transition-all flex items-center justify-between">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
            :class="ch.enabled !== false ? 'bg-blue-50' : 'bg-gray-100'">
            {{ getIcon(ch.id) }}
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold text-gray-900">{{ getName(ch.id) }}</span>
              <AppBadge :type="ch.enabled !== false ? 'success' : 'default'" size="sm" dot>
                {{ ch.enabled !== false ? '已启用' : '已禁用' }}
              </AppBadge>
            </div>
            <p class="text-xs text-gray-400 font-mono mt-0.5">{{ ch.id }}</p>
          </div>
        </div>
        <div class="flex items-center gap-1.5">
          <AppButton size="sm" @click="openDetail(ch)">配置</AppButton>
          <AppButton size="sm" @click="toggleChannel(ch)">
            {{ ch.enabled !== false ? '禁用' : '启用' }}
          </AppButton>
          <AppButton size="sm" variant="danger" @click="removeChannel(ch)">删除</AppButton>
        </div>
      </div>
    </div>

    <!-- 插件管理 -->
    <div v-else-if="activeTab === 'plugins'" class="space-y-2 enter-anim" :class="{ 'is-entered': entered }" style="--delay: 160ms">
      <!-- 搜索框（有数据时显示） -->
      <div v-if="pluginEntries.length > 0" class="relative">
        <input v-model="pluginFilter"
          type="search" placeholder="搜索插件..."
          class="w-full pl-8 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-lg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/5 focus:border-gray-400 transition-all">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">🔍</span>
      </div>
      <!-- 空状态 -->
      <div v-if="filteredPlugins.length === 0 && pluginEntries.length === 0" class="card-accent card-hover text-center py-16 bg-white rounded-2xl border border-gray-200/60">
        <span class="text-3xl mb-3 block">🧩</span>
        <p class="text-sm font-medium text-gray-600">暂无插件</p>
        <p class="text-xs text-gray-400 mt-1">点击"安装插件"添加</p>
      </div>
      <!-- 无搜索结果 -->
      <div v-else-if="filteredPlugins.length === 0 && pluginEntries.length > 0" class="card-accent card-hover text-center py-10 bg-white rounded-2xl border border-gray-200/60">
        <p class="text-sm text-gray-400">未找到匹配「{{ pluginFilter }}」的插件</p>
      </div>
      <!-- 插件卡片 -->
      <div v-for="pl in filteredPlugins" :key="pl.id"
        class="card-accent card-hover bg-white rounded-xl border border-gray-200/60 p-4 transition-all flex items-center justify-between">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
            :class="pl.enabled ? 'bg-green-50' : 'bg-gray-100'">🧩</div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold text-gray-900">{{ pl.id }}</span>
              <AppBadge :type="pl.enabled ? 'success' : 'default'" size="sm" dot>
                {{ pl.enabled ? '已启用' : '已禁用' }}
              </AppBadge>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-1.5">
          <AppButton size="sm" :loading="saving" @click="togglePlugin(pl)">
            {{ pl.enabled ? '禁用' : '启用' }}
          </AppButton>
          <AppButton size="sm" variant="danger" @click="uninstallPlugin(pl)">卸载</AppButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Channels 使用 shared-animations.css 中的 .enter-anim / .is-entered */
</style>