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
const showAddModal = ref(false)
const showDetail = ref(null)
const installForm = ref({ pluginId: '' })
const addForm = ref({ channel: '', config: {} })
const saving = ref(false)
const showPwd = ref({})

function togglePwd(k) { showPwd.value[k] = !showPwd.value[k] }
function showConfirm(m) { return confirmRef.value?.confirm(m) || false }
function showToast(m, t) { toastRef.value?.show(m, t) }

const tabs = [
  { key: 'channels', label: '渠道状态' },
  { key: 'plugins', label: '插件管理' },
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
  } catch (e) { showToast('加载失败: ' + e.message) }
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
  } catch (e) { showToast('保存失败: ' + e.message) }
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
  } catch (e) { showToast('添加失败: ' + e.message) }
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
  } catch (e) { showToast('删除失败: ' + e.message) }
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
  } catch (e) { showToast('操作失败: ' + e.message) }
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
  } catch (e) { showToast('操作失败: ' + e.message) }
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
  } catch (e) { showToast('卸载失败: ' + e.message) }
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
  } catch (e) { showToast('安装失败: ' + e.message) }
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
  } catch (e) { showToast('安装失败: ' + e.message) }
}

onMounted(fetchData)
</script>

<template>
  <div class="page">
    <Toast ref="toastRef" />
    <ConfirmDialog ref="confirmRef" />

    <!-- 添加渠道弹窗 -->
    <Teleport to="body">
      <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title">添加渠道</div>
            <button class="modal-close" @click="showAddModal = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <div class="form-label">渠道类型</div>
              <div class="type-grid">
                <button v-for="ct in channelTypes" :key="ct.id"
                  class="type-card" :class="{ active: addForm.channel === ct.id }"
                  @click="addForm.channel = ct.id">
                  <span class="type-icon">{{ ct.icon }}</span>
                  <span class="type-name">{{ ct.name }}</span>
                </button>
              </div>
            </div>
            <template v-if="selectedType">
              <div v-for="f in selectedType.fields" :key="f.key" class="form-group" style="margin-top: 16px;">
                <div class="form-label">{{ f.label }} <span v-if="f.required" class="form-required">*</span></div>
                <div class="input-wrap">
                  <input v-model="addForm.config[f.key]"
                    :type="f.type === 'password' && !showPwd['add_'+f.key] ? 'password' : 'text'"
                    :placeholder="f.placeholder" class="input" :class="{ mono: f.type === 'password' }">
                  <button v-if="f.type === 'password'" class="pwd-toggle" @click="togglePwd('add_'+f.key)">
                    {{ showPwd['add_'+f.key] ? '🙈' : '👁️' }}
                  </button>
                </div>
              </div>
            </template>
          </div>
          <div class="modal-footer">
            <button class="btn" @click="showAddModal = false">取消</button>
            <button class="btn btn-primary" @click="addChannel" :disabled="saving || !addForm.channel">
              {{ saving ? '添加中...' : '添加渠道' }}
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
            <div class="modal-title">安装插件</div>
            <button class="modal-close" @click="showInstallModal = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-label" style="margin-bottom: 12px;">推荐插件</div>
            <div class="preset-list">
              <div v-for="p in presetPlugins" :key="p.id" class="preset-item" @click="installFromPreset(p)">
                <span class="preset-icon">{{ p.icon }}</span>
                <div class="preset-info">
                  <div class="preset-name">{{ p.name }}</div>
                  <div class="preset-desc">{{ p.desc }}</div>
                </div>
                <span class="preset-action">安装</span>
              </div>
            </div>
            <div class="divider"></div>
            <div class="form-label" style="margin-bottom: 8px;">手动安装</div>
            <div style="display: flex; gap: 8px;">
              <div class="input-wrap" style="flex: 1;">
                <input v-model="installForm.pluginId" class="input mono" placeholder="@scope/plugin-name">
              </div>
              <button class="btn btn-primary" @click="installPlugin">安装</button>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn" @click="showInstallModal = false">关闭</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 渠道详情弹窗 -->
    <Teleport to="body">
      <div v-if="showDetail" class="modal-overlay" @click.self="showDetail = null">
        <div class="modal">
          <div class="modal-header">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 24px;">{{ getIcon(showDetail.id) }}</span>
              <div>
                <div class="modal-title">{{ getName(showDetail.id) }}</div>
                <div style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">{{ showDetail.id }}</div>
              </div>
            </div>
            <button class="modal-close" @click="showDetail = null">✕</button>
          </div>
          <div class="modal-body">
            <div class="detail-status" :class="showDetail.enabled ? 'on' : 'off'">
              <span>状态</span>
              <span>{{ showDetail.enabled ? '已启用' : '已禁用' }}</span>
            </div>
            <template v-for="(val, key) in showDetail.config" :key="key">
              <div v-if="key !== 'enabled'" class="form-group" style="margin-top: 12px;">
                <div class="form-label">{{ key }}</div>
                <div class="input-wrap">
                  <input v-model="showDetail.config[key]"
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
            <button class="btn" @click="showDetail = null">取消</button>
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
      <div class="page-actions">
        <button class="btn" @click="fetchData">刷新</button>
        <button class="btn btn-primary" @click="showAddModal = true">+ 添加渠道</button>
        <button class="btn" @click="showInstallModal = true">🧩 安装插件</button>
      </div>
    </div>

    <!-- EventLoop 状态 -->
    <div v-if="eventLoop" class="event-loop" :class="eventLoop.degraded ? 'warn' : 'ok'">
      <span>{{ eventLoop.degraded ? '⚠️' : '✅' }}</span>
      <span>事件循环{{ eventLoop.degraded ? '降级' : '正常' }}</span>
      <span class="event-meta" v-if="eventLoop.utilization">利用率 {{ (eventLoop.utilization * 100).toFixed(0) }}%</span>
      <span class="event-meta" v-if="eventLoop.delayP99Ms">P99 {{ eventLoop.delayP99Ms.toFixed(0) }}ms</span>
    </div>

    <!-- Tab 切换 -->
    <div class="tabs">
      <button v-for="tab in tabs" :key="tab.key"
        class="tab" :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key">{{ tab.label }}</button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <span class="loading-text">加载中...</span>
    </div>

    <!-- 渠道列表 -->
    <div v-else-if="activeTab === 'channels'" class="list">
      <div v-if="channelEntries.length === 0" class="empty">
        <div class="empty-icon">📡</div>
        <div class="empty-title">暂无渠道</div>
        <div class="empty-desc">点击"添加渠道"开始配置消息渠道</div>
      </div>
      <div v-for="ch in channelEntries" :key="ch.id" class="card channel-card">
        <div class="card-left">
          <div class="card-icon" :class="ch.enabled !== false ? 'on' : 'off'">{{ getIcon(ch.id) }}</div>
          <div class="card-info">
            <div class="card-name">{{ getName(ch.id) }}</div>
            <div class="card-id">{{ ch.id }}</div>
          </div>
        </div>
        <div class="card-actions">
          <span class="badge" :class="ch.enabled !== false ? 'badge-green' : 'badge-gray'">
            {{ ch.enabled !== false ? '已启用' : '已禁用' }}
          </span>
          <button class="btn btn-sm" @click="openDetail(ch)">配置</button>
          <button class="btn btn-sm" @click="toggleChannel(ch)">{{ ch.enabled !== false ? '禁用' : '启用' }}</button>
          <button class="btn btn-sm btn-danger" @click="removeChannel(ch)">删除</button>
        </div>
      </div>
    </div>

    <!-- 插件管理 -->
    <div v-else-if="activeTab === 'plugins'" class="list">
      <div v-if="pluginEntries.length === 0" class="empty">
        <div class="empty-icon">🧩</div>
        <div class="empty-title">暂无插件</div>
        <div class="empty-desc">点击"安装插件"添加</div>
      </div>
      <div v-for="pl in pluginEntries" :key="pl.id" class="card channel-card">
        <div class="card-left">
          <div class="card-icon" :class="pl.enabled ? 'on' : 'off'">🧩</div>
          <div class="card-info">
            <div class="card-name">{{ pl.id }}</div>
          </div>
        </div>
        <div class="card-actions">
          <span class="badge" :class="pl.enabled ? 'badge-green' : 'badge-gray'">
            {{ pl.enabled ? '已启用' : '已禁用' }}
          </span>
          <button class="btn btn-sm" @click="togglePlugin(pl)">{{ pl.enabled ? '禁用' : '启用' }}</button>
          <button class="btn btn-sm btn-danger" @click="uninstallPlugin(pl)">卸载</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page { max-width: 880px; }

/* ===== 头部 ===== */
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--space-5);
  gap: var(--space-4);
}
.page-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.5px;
  color: var(--text-primary);
}
.page-desc {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-top: var(--space-1);
}
.page-actions { display: flex; gap: var(--space-2); flex-shrink: 0; }

/* ===== EventLoop ===== */
.event-loop {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-size: 13px;
  margin-bottom: var(--space-4);
}
.event-loop.ok { background: var(--green-bg); color: #166534; }
.event-loop.warn { background: var(--amber-bg); color: #92400e; }
.event-meta { color: var(--text-tertiary); margin-left: auto; font-size: 12px; }

/* ===== Tab ===== */
.tabs {
  display: flex;
  gap: 1px;
  background: var(--bg-subtle);
  border-radius: var(--radius);
  padding: 2px;
  width: fit-content;
  margin-bottom: var(--space-4);
}
.tab {
  padding: var(--space-2) var(--space-4);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-tertiary);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease);
}
.tab:hover { color: var(--text-primary); }
.tab.active {
  background: var(--bg-panel);
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
}

/* ===== 列表 ===== */
.list { display: flex; flex-direction: column; gap: var(--space-2); }

/* ===== 卡片 ===== */
.channel-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  gap: var(--space-4);
}
.card-left { display: flex; align-items: center; gap: var(--space-3); min-width: 0; }
.card-actions { display: flex; align-items: center; gap: var(--space-2); flex-shrink: 0; }
.card-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius);
  font-size: 18px;
  flex-shrink: 0;
}
.card-icon.on { background: var(--blue-bg); }
.card-icon.off { background: var(--bg-subtle); }
.card-info { min-width: 0; }
.card-name { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.card-id { font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); margin-top: 1px; }

/* ===== 空状态 ===== */
.empty {
  text-align: center;
  padding: var(--space-12) var(--space-4);
}
.empty-icon { font-size: 40px; margin-bottom: var(--space-3); }
.empty-title { font-size: 15px; font-weight: 600; color: var(--text-secondary); }
.empty-desc { font-size: 13px; color: var(--text-tertiary); margin-top: var(--space-1); }

/* ===== Loading ===== */
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12);
  gap: var(--space-3);
}
.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-top-color: var(--text-primary);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.loading-text { font-size: 13px; color: var(--text-tertiary); }

/* ===== 渠道选择网格 ===== */
.type-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
}
.type-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-2);
  background: var(--bg-subtle);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease);
}
.type-card:hover {
  background: var(--bg-hover);
  border-color: var(--border);
}
.type-card.active {
  background: var(--bg-panel);
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px rgba(26,26,26,0.06);
}
.type-icon { font-size: 20px; }
.type-name { font-size: 12px; font-weight: 500; color: var(--text-secondary); }

/* ===== 预置插件列表 ===== */
.preset-list { display: flex; flex-direction: column; gap: 1px; }
.preset-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease);
}
.preset-item:hover { background: var(--bg-subtle); }
.preset-icon { font-size: 20px; flex-shrink: 0; }
.preset-info { flex: 1; min-width: 0; }
.preset-name { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.preset-desc { font-size: 12px; color: var(--text-tertiary); margin-top: 1px; }
.preset-action {
  font-size: 12px;
  font-weight: 500;
  color: var(--blue);
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease);
}
.preset-item:hover .preset-action { opacity: 1; }
.divider { border-top: 1px solid var(--border-subtle); margin: var(--space-4) 0; }

/* ===== 详情弹窗状态 ===== */
.detail-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius);
  font-size: 13px;
  margin-bottom: var(--space-3);
}
.detail-status.on { background: var(--green-bg); color: #166534; }
.detail-status.off { background: var(--bg-subtle); color: var(--text-tertiary); }
</style>
