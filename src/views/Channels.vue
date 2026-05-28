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

async function saveDetail() {
  if (!showDetail.value) return
  saving.value = true
  try {
    const cfgRes = await gwRequest('config.get')
    const raw = getRawConfig(cfgRes)
    if (!raw) throw new Error("无法获取配置")
    const cfg = JSON.parse(raw)
    if (!cfg.channels) cfg.channels = {}
    if (!cfg.channels[showDetail.value.id]) cfg.channels[showDetail.value.id] = {}
    Object.assign(cfg.channels[showDetail.value.id], showDetail.value.config)
    await gwRequest('config.set', { raw: JSON.stringify(cfg), baseHash: cfgRes.hash })
    showToast('配置已保存，重启后生效')
    showDetail.value = null
    await fetchData()
  } catch (e) { showToast('保存失败: ' + e.message, 'error') }
  saving.value = false
}

async function addChannel() {
  if (!addForm.value.channel) { showToast('请选择渠道类型'); return }
  const type = selectedType.value
  if (!type) return
  for (const f of type.fields) { if (f.required && !addForm.value.config[f.key]) { showToast(`请填写 ${f.label}`); return } }
  saving.value = true
  try {
    const cfgRes = await gwRequest('config.get')
    const raw = getRawConfig(cfgRes)
    if (!raw) throw new Error("无法获取配置")
    const cfg = JSON.parse(raw)
    if (!cfg.channels) cfg.channels = {}
    const chCfg = { enabled: true }
    for (const f of type.fields) { if (addForm.value.config[f.key]) chCfg[f.key] = addForm.value.config[f.key] }
    cfg.channels[addForm.value.channel] = chCfg
    await gwRequest('config.set', { raw: JSON.stringify(cfg), baseHash: cfgRes.hash })
    showToast(`${type.name} 渠道已添加，重启后生效`)
    showAddModal.value = false
    addForm.value = { channel: '', config: {} }
    await fetchData()
  } catch (e) { showToast('添加失败: ' + e.message, 'error') }
  saving.value = false
}

async function removeChannel(ch) {
  if (!await showConfirm(`确定删除渠道 ${getName(ch.id)}？`)) return
  try {
    const cfgRes = await gwRequest('config.get')
    const raw = getRawConfig(cfgRes)
    if (!raw) throw new Error("无法获取配置")
    const cfg = JSON.parse(raw)
    if (cfg.channels?.[ch.id]) delete cfg.channels[ch.id]
    await gwRequest('config.set', { raw: JSON.stringify(cfg), baseHash: cfgRes.hash })
    showToast(`${getName(ch.id)} 已删除`)
    await fetchData()
  } catch (e) { showToast('删除失败: ' + e.message, 'error') }
}

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
    showToast(`${getName(ch.id)} 已${entry.enabled ? '启用' : '禁用'}`)
    await fetchData()
  } catch (e) { showToast('操作失败: ' + e.message, 'error') }
}

async function togglePlugin(pl) {
  try {
    const cfgRes = await gwRequest('config.get')
    const raw = getRawConfig(cfgRes)
    if (!raw) throw new Error('无法获取配置')
    const cfg = JSON.parse(raw)
    const entry = cfg.plugins?.entries?.[pl.id]
    if (!entry) throw new Error('插件不存在')
    entry.enabled = !pl.enabled
    await gwRequest('config.set', { raw: JSON.stringify(cfg), baseHash: cfgRes.hash })
    showToast(`${pl.id} 已${entry.enabled ? '启用' : '禁用'}`)
    await fetchData()
  } catch (e) { showToast('操作失败: ' + e.message, 'error') }
}

async function uninstallPlugin(pl) {
  if (!await showConfirm(`确定卸载插件 ${pl.id}？`)) return
  try {
    const cfgRes = await gwRequest('config.get')
    const raw = getRawConfig(cfgRes)
    if (!raw) throw new Error('无法获取配置')
    const cfg = JSON.parse(raw)
    if (cfg.plugins?.entries?.[pl.id]) delete cfg.plugins.entries[pl.id]
    await gwRequest('config.set', { raw: JSON.stringify(cfg), baseHash: cfgRes.hash })
    showToast(`${pl.id} 已卸载`)
    await fetchData()
  } catch (e) { showToast('卸载失败: ' + e.message, 'error') }
}

const presetPlugins = [
  { id: '@openclaw/feishu', name: '飞书插件', desc: '飞书/Lark 官方插件', icon: '🐦' },
  { id: '@openclaw/qqbot', name: 'QQ Bot 插件', desc: 'QQ 机器人官方插件', icon: '🐧' },
  { id: '@openclaw/telegram', name: 'Telegram 插件', desc: 'Telegram Bot 官方插件', icon: '✈️' },
  { id: '@openclaw/discord', name: 'Discord 插件', desc: 'Discord Bot 官方插件', icon: '🎮' },
  { id: '@openclaw/slack', name: 'Slack 插件', desc: 'Slack App 官方插件', icon: '💼' },
]

async function installFromPreset(p) {
  try {
    const cfgRes = await gwRequest('config.get')
    const raw = getRawConfig(cfgRes)
    if (!raw) throw new Error('无法获取配置')
    const cfg = JSON.parse(raw)
    if (!cfg.plugins) cfg.plugins = {}
    if (!cfg.plugins.entries) cfg.plugins.entries = {}
    cfg.plugins.entries[p.id] = { enabled: true }
    await gwRequest('config.set', { raw: JSON.stringify(cfg), baseHash: cfgRes.hash })
    showToast(`${p.name} 已安装`)
    showInstallModal.value = false
    await fetchData()
  } catch (e) { showToast('安装失败: ' + e.message, 'error') }
}

async function installPlugin() {
  if (!installForm.value.pluginId) { showToast('请输入插件 ID'); return }
  try {
    const cfgRes = await gwRequest('config.get')
    const raw = getRawConfig(cfgRes)
    if (!raw) throw new Error('无法获取配置')
    const cfg = JSON.parse(raw)
    if (!cfg.plugins) cfg.plugins = {}
    if (!cfg.plugins.entries) cfg.plugins.entries = {}
    cfg.plugins.entries[installForm.value.pluginId] = { enabled: true }
    await gwRequest('config.set', { raw: JSON.stringify(cfg), baseHash: cfgRes.hash })
    showToast(`${installForm.value.pluginId} 已安装`)
    showInstallModal.value = false
    installForm.value.pluginId = ''
    await fetchData()
  } catch (e) { showToast('安装失败: ' + e.message, 'error') }
}

onMounted(fetchData)
</script>

<template>
  <div class="space-y-5">
    <AppToast ref="toastRef" />
    <AppConfirm ref="confirmRef" />

    <!-- 添加渠道弹窗 -->
    <AppModal v-model:visible="showAddModal" title="添加渠道" width="440px">
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-2">渠道类型</label>
          <div class="grid grid-cols-3 gap-2">
            <button v-for="ct in channelTypes" :key="ct.id"
              class="flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all cursor-pointer"
              :class="addForm.channel === ct.id ? 'border-gray-900 bg-gray-50 shadow-sm' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'"
              @click="addForm.channel = ct.id">
              <span class="text-xl">{{ ct.icon }}</span>
              <span class="text-xs font-medium text-gray-700">{{ ct.name }}</span>
            </button>
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
                class="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/5 focus:border-gray-400 transition-all pr-9">
              <button v-if="f.type === 'password'"
                @click="togglePwd('add_'+f.key)"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">
                {{ showPwd['add_'+f.key] ? '🙈' : '👁️' }}
              </button>
            </div>
          </div>
        </template>
      </div>
      <template #footer>
        <AppButton @click="showAddModal = false">取消</AppButton>
        <AppButton variant="primary" :loading="saving" :disabled="!addForm.channel" @click="addChannel">
          {{ saving ? '添加中...' : '添加渠道' }}
        </AppButton>
      </template>
    </AppModal>

    <!-- 安装插件弹窗 -->
    <AppModal v-model:visible="showInstallModal" title="安装插件" width="480px">
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
              autocomplete="off"
              aria-label="插件 ID"
              class="flex-1 px-3 py-2 text-sm font-mono bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/5 focus:border-gray-400 transition-all"
              placeholder="@scope/plugin-name">
            <AppButton variant="primary" @click="installPlugin">安装</AppButton>
          </div>
        </div>
      </div>
      <template #footer>
        <AppButton @click="showInstallModal = false">关闭</AppButton>
      </template>
    </AppModal>

    <!-- 渠道详情弹窗 -->
    <AppModal :visible="!!showDetail" :title="showDetail ? getName(showDetail.id) : ''" width="440px" @close="showDetail = null" @update:visible="val => { if (!val) showDetail = null }">
      <template v-if="showDetail">
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
                  :aria-label="key"
                  class="w-full px-3 py-2 text-sm font-mono bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/5 focus:border-gray-400 transition-all pr-9">
                <button v-if="key.toLowerCase().includes('secret') || key.toLowerCase().includes('token')"
                  @click="togglePwd('d_'+key)"
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">
                  {{ showPwd['d_'+key] ? '🙈' : '👁️' }}
                </button>
              </div>
            </div>
          </template>
        </div>
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
      <button v-for="tab in tabs" :key="tab.key"
        @click="activeTab = tab.key"
        class="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium transition-all"
        :class="activeTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'">
        <span>{{ tab.icon }}</span>
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin"></div>
    </div>

    <!-- 渠道列表 -->
    <div v-else-if="activeTab === 'channels'" class="space-y-2 enter-anim" :class="{ 'is-entered': entered }" style="--delay: 160ms">
      <div v-if="channelEntries.length === 0" class="text-center py-16 bg-white rounded-xl border border-gray-200">
        <span class="text-3xl mb-3 block">📡</span>
        <p class="text-sm font-medium text-gray-600">暂无渠道</p>
        <p class="text-xs text-gray-400 mt-1">点击"添加渠道"开始</p>
      </div>
      <div v-for="ch in channelEntries" :key="ch.id"
        class="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all flex items-center justify-between">
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
          <AppButton size="sm" :variant="ch.enabled !== false ? 'default' : 'default'" @click="toggleChannel(ch)">
            {{ ch.enabled !== false ? '禁用' : '启用' }}
          </AppButton>
          <AppButton size="sm" variant="danger" @click="removeChannel(ch)">删除</AppButton>
        </div>
      </div>
    </div>

    <!-- 插件管理 -->
    <div v-else-if="activeTab === 'plugins'" class="space-y-2 enter-anim" :class="{ 'is-entered': entered }" style="--delay: 160ms">
      <div v-if="pluginEntries.length === 0" class="text-center py-16 bg-white rounded-xl border border-gray-200">
        <span class="text-3xl mb-3 block">🧩</span>
        <p class="text-sm font-medium text-gray-600">暂无插件</p>
        <p class="text-xs text-gray-400 mt-1">点击"安装插件"添加</p>
      </div>
      <div v-for="pl in pluginEntries" :key="pl.id"
        class="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all flex items-center justify-between">
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
          <AppButton size="sm" @click="togglePlugin(pl)">
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
