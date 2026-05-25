<script setup>
import { ref, computed, onMounted } from 'vue'
import { gwRequest } from '../stores/gateway.js'
import { getRawConfig, getConfigHash } from "../api/config-utils.js"
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
const installForm = ref({ pluginId: '' })
const addForm = ref({ channel: '', config: {} })
const saving = ref(false)
const showPwd = ref({})

function togglePwd(k) { showPwd.value[k] = !showPwd.value[k] }
function showConfirm(m) { return confirmRef.value?.confirm(m) || false }
function showToast(m, t) { toastRef.value?.show(m, t) }

const tabs = [
  { key: 'channels', label: '渠道状态', icon: '📡' },
  { key: 'plugins', label: '插件管理', icon: '🧩' },
]

// 渠道类型（只包含 OpenClaw 支持的）
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

// 渠道图标和名称
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

function openDetail(ch) {
  showPwd.value = {}
  showChannelDetail.value = { id: ch.id, config: { ...getChannelConfig(ch.id) }, enabled: ch.enabled !== false }
}

async function saveDetail() {
  if (!showChannelDetail.value) return
  saving.value = true
  try {
    const cfgRes = await gwRequest('config.get')
    const raw = getRawConfig(cfgRes)
    if (!raw) throw new Error("无法获取配置")
    const cfg = JSON.parse(raw)
    if (!cfg.channels) cfg.channels = {}
    if (!cfg.channels[showChannelDetail.value.id]) cfg.channels[showChannelDetail.value.id] = {}
    Object.assign(cfg.channels[showChannelDetail.value.id], showChannelDetail.value.config)
    await gwRequest('config.set', { raw: JSON.stringify(cfg), baseHash: cfgRes.hash })
    showToast('配置已保存，重启后生效', 'success')
    showChannelDetail.value = null
    await fetchData()
  } catch (e) { showToast('保存失败: ' + e.message, 'error') }
  saving.value = false
}

async function addChannel() {
  if (!addForm.value.channel) { showToast('请选择渠道类型', 'error'); return }
  const type = selectedType.value
  if (!type) return
  for (const f of type.fields) {
    if (f.required && !addForm.value.config[f.key]) { showToast(`请填写 ${f.label}`, 'error'); return }
  }
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
    showToast(`${type.name} 渠道已添加，重启后生效`, 'success')
    showAddChannelModal.value = false
    addForm.value = { channel: '', config: {} }
    await fetchData()
  } catch (e) { showToast('添加失败: ' + e.message, 'error') }
  saving.value = false
}

async function removeChannel(ch) {
  if (!await showConfirm(`确定删除渠道 ${getName(ch.id)}？此操作不可恢复。`)) return
  try {
    const cfgRes = await gwRequest('config.get')
    const raw = getRawConfig(cfgRes)
    if (!raw) throw new Error("无法获取配置")
    const cfg = JSON.parse(raw)
    if (cfg.channels?.[ch.id]) delete cfg.channels[ch.id]
    await gwRequest('config.set', { raw: JSON.stringify(cfg), baseHash: cfgRes.hash })
    showToast(`${getName(ch.id)} 已删除`, 'success')
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
    showToast(`${getName(ch.id)} 已${entry.enabled ? '启用' : '禁用'}`, 'success')
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
    showToast(`${pl.id} 已${entry.enabled ? '启用' : '禁用'}`, 'success')
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
    showToast(`${pl.id} 已卸载`, 'success')
    await fetchData()
  } catch (e) { showToast('卸载失败: ' + e.message, 'error') }
}

// 插件仓库
const presetPlugins = [
  { id: '@openclaw/feishu', name: '飞书插件', desc: '飞书/Lark 官方插件，支持消息、文档、日历等', icon: '🐦' },
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
    showToast(`${p.name} 已安装`, 'success')
    showInstallModal.value = false
    await fetchData()
  } catch (e) { showToast('安装失败: ' + e.message, 'error') }
}

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
  } catch (e) { showToast('安装失败: ' + e.message, 'error') }
}

onMounted(fetchData)
</script>

<template>
  <div class="page">
    <Toast ref="toastRef" />
    <ConfirmDialog ref="confirmRef" />

    <!-- 添加渠道弹窗 -->
    <Teleport to="body">
      <div v-if="showAddChannelModal" class="modal-overlay" @click.self="showAddChannelModal = false">
        <div class="modal">
          <div class="modal-header">
            <h3>添加渠道</h3>
            <button class="modal-close" @click="showAddChannelModal = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>渠道类型</label>
              <div class="channel-grid">
                <button v-for="ct in channelTypes" :key="ct.id"
                  class="channel-option"
                  :class="{ active: addForm.channel === ct.id }"
                  @click="addForm.channel = ct.id">
                  <span class="channel-option-icon">{{ ct.icon }}</span>
                  <span class="channel-option-name">{{ ct.name }}</span>
                </button>
              </div>
            </div>
            <template v-if="selectedType">
              <div v-for="f in selectedType.fields" :key="f.key" class="form-group">
                <label>{{ f.label }} <span v-if="f.required" class="required">*</span></label>
                <div class="input-wrap">
                  <input v-model="addForm.config[f.key]"
                    :type="f.type === 'password' && !showPwd['add_'+f.key] ? 'password' : 'text'"
                    :placeholder="f.placeholder"
                    class="input">
                  <button v-if="f.type === 'password'" class="pwd-toggle" @click="togglePwd('add_'+f.key)">
                    {{ showPwd['add_'+f.key] ? '🙈' : '👁️' }}
                  </button>
                </div>
              </div>
            </template>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" @click="showAddChannelModal = false">取消</button>
            <button class="btn btn-primary" @click="addChannel" :disabled="saving">
              {{ saving ? '添加中...' : '添加' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 安装插件弹窗 -->
    <Teleport to="body">
      <div v-if="showInstallModal" class="modal-overlay" @click.self="showInstallModal = false">
        <div class="modal modal-lg">
          <div class="modal-header">
            <h3>安装插件</h3>
            <button class="modal-close" @click="showInstallModal = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="plugin-list">
              <div class="section-title">推荐插件</div>
              <div v-for="p in presetPlugins" :key="p.id" class="plugin-row" @click="installFromPreset(p)">
                <span class="plugin-icon">{{ p.icon }}</span>
                <div class="plugin-info">
                  <div class="plugin-name">{{ p.name }}</div>
                  <div class="plugin-desc">{{ p.desc }}</div>
                </div>
                <button class="btn btn-sm">安装</button>
              </div>
            </div>
            <div class="divider"></div>
            <div class="section-title">手动安装</div>
            <div class="input-row">
              <div class="input-wrap flex-1">
                <input v-model="installForm.pluginId" class="input mono" placeholder="@scope/plugin-name">
              </div>
              <button class="btn btn-primary" @click="installPlugin">安装</button>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" @click="showInstallModal = false">关闭</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 渠道详情弹窗 -->
    <Teleport to="body">
      <div v-if="showChannelDetail" class="modal-overlay" @click.self="showChannelDetail = null">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title-row">
              <span class="modal-icon">{{ getIcon(showChannelDetail.id) }}</span>
              <div>
                <h3>{{ getName(showChannelDetail.id) }}</h3>
                <span class="modal-subtitle">{{ showChannelDetail.id }}</span>
              </div>
            </div>
            <button class="modal-close" @click="showChannelDetail = null">✕</button>
          </div>
          <div class="modal-body">
            <div class="status-bar" :class="showChannelDetail.enabled ? 'on' : 'off'">
              <span>状态</span>
              <span class="status-text">{{ showChannelDetail.enabled ? '已启用' : '已禁用' }}</span>
            </div>
            <template v-for="(val, key) in showChannelDetail.config" :key="key">
              <div v-if="key !== 'enabled'" class="form-group">
                <label>{{ key }}</label>
                <div class="input-wrap">
                  <input v-model="showChannelDetail.config[key]"
                    :type="(key.toLowerCase().includes('secret') || key.toLowerCase().includes('token')) && !showPwd['d_'+key] ? 'password' : 'text'"
                    class="input mono">
                  <button v-if="key.toLowerCase().includes('secret') || key.toLowerCase().includes('token')"
                    class="pwd-toggle" @click="togglePwd('d_'+key)">
                    {{ showPwd['d_'+key] ? '🙈' : '👁️' }}
                  </button>
                </div>
              </div>
            </template>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" @click="showChannelDetail = null">取消</button>
            <button class="btn btn-primary" @click="saveDetail" :disabled="saving">
              {{ saving ? '保存中...' : '保存配置' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 页面头部 -->
    <div class="page-header">
      <div>
        <h1 class="page-title">渠道管理</h1>
        <p class="page-desc">管理消息渠道和插件</p>
      </div>
      <div class="actions">
        <button class="btn" @click="fetchData">刷新</button>
        <button class="btn btn-primary" @click="showAddChannelModal = true">+ 添加渠道</button>
        <button class="btn" @click="showInstallModal = true">🧩 安装插件</button>
      </div>
    </div>

    <!-- EventLoop 状态 -->
    <div v-if="eventLoop" class="status-card" :class="eventLoop.degraded ? 'warn' : 'ok'">
      <span>{{ eventLoop.degraded ? '⚠️' : '✅' }}</span>
      <span>事件循环{{ eventLoop.degraded ? '降级' : '正常' }}</span>
      <span class="status-meta" v-if="eventLoop.utilization">利用率 {{ (eventLoop.utilization * 100).toFixed(0) }}%</span>
      <span class="status-meta" v-if="eventLoop.delayP99Ms">P99 {{ eventLoop.delayP99Ms.toFixed(0) }}ms</span>
    </div>

    <!-- Tab 切换 -->
    <div class="tabs">
      <button v-for="tab in tabs" :key="tab.key"
        class="tab" :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key">
        <span>{{ tab.icon }}</span>
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>

    <!-- 渠道列表 -->
    <div v-else-if="activeTab === 'channels'" class="list">
      <div v-if="channelEntries.length === 0" class="empty">
        <span class="empty-icon">📡</span>
        <p class="empty-title">暂无渠道配置</p>
        <p class="empty-desc">点击上方"添加渠道"开始</p>
      </div>
      <div v-for="ch in channelEntries" :key="ch.id" class="card">
        <div class="card-left">
          <div class="card-icon" :class="ch.enabled !== false ? 'on' : 'off'">{{ getIcon(ch.id) }}</div>
          <div>
            <div class="card-title">{{ getName(ch.id) }}</div>
            <div class="card-id">{{ ch.id }}</div>
          </div>
        </div>
        <div class="card-right">
          <span class="badge" :class="ch.enabled !== false ? 'badge-on' : 'badge-off'">
            {{ ch.enabled !== false ? '已启用' : '已禁用' }}
          </span>
          <button class="btn btn-sm" @click="openDetail(ch)">配置</button>
          <button class="btn btn-sm" @click="toggleChannel(ch)">
            {{ ch.enabled !== false ? '禁用' : '启用' }}
          </button>
          <button class="btn btn-sm btn-danger" @click="removeChannel(ch)">删除</button>
        </div>
      </div>
    </div>

    <!-- 插件管理 -->
    <div v-else-if="activeTab === 'plugins'" class="list">
      <div v-if="pluginEntries.length === 0" class="empty">
        <span class="empty-icon">🧩</span>
        <p class="empty-title">暂无插件</p>
        <p class="empty-desc">点击"安装插件"添加</p>
      </div>
      <div v-for="pl in pluginEntries" :key="pl.id" class="card">
        <div class="card-left">
          <div class="card-icon" :class="pl.enabled ? 'on' : 'off'">🧩</div>
          <div>
            <div class="card-title">{{ pl.id }}</div>
          </div>
        </div>
        <div class="card-right">
          <span class="badge" :class="pl.enabled ? 'badge-on' : 'badge-off'">
            {{ pl.enabled ? '已启用' : '已禁用' }}
          </span>
          <button class="btn btn-sm" @click="togglePlugin(pl)">
            {{ pl.enabled ? '禁用' : '启用' }}
          </button>
          <button class="btn btn-sm btn-danger" @click="uninstallPlugin(pl)">卸载</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ===== 变量 ===== */
:root {
  --bg: #fafafa;
  --bg-card: #ffffff;
  --bg-hover: #f5f5f5;
  --text: #171717;
  --text2: #4d4d4d;
  --text3: #808080;
  --border: rgba(0,0,0,0.08);
  --border-solid: #ebebeb;
  --shadow: rgba(0,0,0,0.08) 0 0 0 1px, rgba(0,0,0,0.04) 0 2px 2px;
  --shadow-lg: rgba(0,0,0,0.08) 0 0 0 1px, rgba(0,0,0,0.06) 0 4px 8px;
  --green: #10b981;
  --green-bg: rgba(16,185,129,0.1);
  --red: #ef4444;
  --red-bg: rgba(239,68,68,0.1);
  --blue: #3b82f6;
  --blue-bg: rgba(59,130,246,0.1);
  --amber: #f59e0b;
  --amber-bg: rgba(245,158,11,0.1);
  --radius: 6px;
  --radius-lg: 8px;
}

.page { padding: 1.5rem; max-width: 960px; }

/* ===== 头部 ===== */
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
.page-title { font-size: 1.25rem; font-weight: 600; letter-spacing: -0.3px; }
.page-desc { font-size: 0.8rem; color: var(--text3); margin-top: 0.25rem; }
.actions { display: flex; gap: 0.5rem; }

/* ===== 按钮 ===== */
.btn {
  display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.5rem 0.85rem;
  font-size: 0.8rem; font-weight: 500;
  background: var(--bg-card);
  border: 1px solid var(--border-solid);
  border-radius: var(--radius);
  color: var(--text2);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.btn:hover { background: var(--bg-hover); color: var(--text); }
.btn-primary { background: var(--text); color: #fff; border-color: var(--text); }
.btn-primary:hover { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-sm { padding: 0.35rem 0.65rem; font-size: 0.75rem; }
.btn-ghost { background: transparent; border-color: transparent; }
.btn-ghost:hover { background: var(--bg-hover); }
.btn-danger { color: var(--red); }
.btn-danger:hover { background: var(--red-bg); }

/* ===== Tab ===== */
.tabs { display: flex; gap: 0.25rem; background: var(--bg-hover); border-radius: var(--radius); padding: 0.25rem; width: fit-content; margin-bottom: 1rem; }
.tab {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.5rem 1rem;
  font-size: 0.8rem; font-weight: 500;
  border-radius: var(--radius-sm);
  color: var(--text3);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
}
.tab.active { background: var(--bg-card); color: var(--text); box-shadow: var(--shadow); }

/* ===== 状态卡片 ===== */
.status-card {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-lg);
  font-size: 0.8rem;
  margin-bottom: 1rem;
}
.status-card.ok { background: var(--green-bg); color: #065f46; }
.status-card.warn { background: var(--amber-bg); color: #92400e; }
.status-meta { color: var(--text3); margin-left: auto; }

/* ===== 列表 ===== */
.list { display: flex; flex-direction: column; gap: 0.5rem; }

/* ===== 卡片 ===== */
.card {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  transition: all 0.15s;
}
.card:hover { border-color: var(--border-solid); box-shadow: var(--shadow); }
.card-left { display: flex; align-items: center; gap: 0.75rem; min-width: 0; }
.card-right { display: flex; align-items: center; gap: 0.5rem; }
.card-icon {
  width: 2.25rem; height: 2.25rem;
  display: flex; align-items: center; justify-content: center;
  border-radius: var(--radius);
  font-size: 1.1rem;
  flex-shrink: 0;
}
.card-icon.on { background: var(--blue-bg); }
.card-icon.off { background: var(--bg-hover); }
.card-title { font-size: 0.85rem; font-weight: 600; }
.card-id { font-size: 0.7rem; color: var(--text3); font-family: var(--font-mono, monospace); margin-top: 0.15rem; }

/* ===== Badge ===== */
.badge {
  display: inline-flex; align-items: center;
  padding: 0.2rem 0.55rem;
  font-size: 0.7rem; font-weight: 500;
  border-radius: var(--radius);
}
.badge-on { background: var(--green-bg); color: #065f46; }
.badge-off { background: var(--bg-hover); color: var(--text3); }

/* ===== 空状态 ===== */
.empty { text-align: center; padding: 3rem 1rem; }
.empty-icon { font-size: 2.5rem; display: block; margin-bottom: 0.75rem; }
.empty-title { font-size: 0.9rem; font-weight: 600; color: var(--text2); }
.empty-desc { font-size: 0.8rem; color: var(--text3); margin-top: 0.25rem; }

/* ===== Loading ===== */
.loading { display: flex; justify-content: center; padding: 3rem; }
.spinner {
  width: 1.5rem; height: 1.5rem;
  border: 2px solid var(--border-solid);
  border-top-color: var(--text);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ===== 弹窗 ===== */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
  padding: 1rem;
}
.modal {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: 100%; max-width: 420px;
  max-height: 80vh;
  display: flex; flex-direction: column;
}
.modal-lg { max-width: 520px; }
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border);
}
.modal-header h3 { font-size: 0.95rem; font-weight: 600; }
.modal-close {
  background: none; border: none; color: var(--text3);
  cursor: pointer; font-size: 0.9rem; padding: 0.25rem;
  border-radius: var(--radius);
}
.modal-close:hover { background: var(--bg-hover); color: var(--text); }
.modal-title-row { display: flex; align-items: center; gap: 0.75rem; }
.modal-icon { font-size: 1.5rem; }
.modal-subtitle { font-size: 0.7rem; color: var(--text3); font-family: var(--font-mono, monospace); }
.modal-body { padding: 1rem 1.25rem; overflow-y: auto; flex: 1; }
.modal-footer {
  display: flex; justify-content: flex-end; gap: 0.5rem;
  padding: 0.85rem 1.25rem;
  border-top: 1px solid var(--border);
}

/* ===== 表单 ===== */
.form-group { margin-bottom: 0.85rem; }
.form-group label {
  display: block;
  font-size: 0.75rem; font-weight: 500;
  color: var(--text2);
  margin-bottom: 0.35rem;
}
.required { color: var(--red); }
.input-wrap { position: relative; }
.input {
  width: 100%;
  padding: 0.55rem 0.75rem;
  font-size: 0.8rem;
  background: var(--bg);
  border: 1px solid var(--border-solid);
  border-radius: var(--radius);
  color: var(--text);
  outline: none;
  transition: border-color 0.15s;
}
.input:focus { border-color: var(--text); }
.input.mono { font-family: var(--font-mono, monospace); }
.input::placeholder { color: var(--text3); }
.pwd-toggle {
  position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer; font-size: 0.85rem;
  opacity: 0.5;
}
.pwd-toggle:hover { opacity: 1; }

/* ===== 渠道选择 ===== */
.channel-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }
.channel-option {
  display: flex; flex-direction: column; align-items: center; gap: 0.35rem;
  padding: 0.75rem 0.5rem;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.15s;
}
.channel-option:hover { border-color: var(--border-solid); background: var(--bg-hover); }
.channel-option.active { border-color: var(--text); background: var(--bg-card); }
.channel-option-icon { font-size: 1.25rem; }
.channel-option-name { font-size: 0.75rem; font-weight: 500; color: var(--text2); }

/* ===== 插件列表 ===== */
.plugin-list { display: flex; flex-direction: column; gap: 0.25rem; }
.section-title { font-size: 0.75rem; font-weight: 500; color: var(--text3); margin-bottom: 0.5rem; }
.plugin-row {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.65rem 0.75rem;
  border-radius: var(--radius);
  cursor: pointer;
  transition: background 0.15s;
}
.plugin-row:hover { background: var(--bg-hover); }
.plugin-icon { font-size: 1.25rem; flex-shrink: 0; }
.plugin-info { flex: 1; min-width: 0; }
.plugin-name { font-size: 0.8rem; font-weight: 600; }
.plugin-desc { font-size: 0.7rem; color: var(--text3); margin-top: 0.1rem; }
.divider { border-top: 1px solid var(--border); margin: 0.85rem 0; }
.input-row { display: flex; gap: 0.5rem; }
.flex-1 { flex: 1; }
</style>
