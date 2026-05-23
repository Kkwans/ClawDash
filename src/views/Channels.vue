<script setup>
import { ref, computed, onMounted } from 'vue'
import { getChannels, getKnownChannels, getPlugins, updateChannel, deleteChannel } from '../api'

const channels = ref([])
const knownChannels = ref([])
const plugins = ref([])
const loading = ref(true)
const toggling = ref(null)
const toast = ref('')
const editingChannel = ref(null)
const editJson = ref('')
const saving = ref(false)
const activeTab = ref('channels')
const pluginAction = ref(null)

const tabs = [
  { key: 'channels', label: '渠道列表', icon: '📡' },
  { key: 'plugins', label: '插件管理', icon: '🧩' },
]

async function fetchData() {
  loading.value = true
  try {
    const [ch, pl, kc] = await Promise.all([
      getChannels().catch(() => ({})),
      getPlugins().catch(() => []),
      getKnownChannels().catch(() => [])
    ])
    // 修复 qqbot 状态不一致：统一 enabled 字段
    channels.value = Object.entries(ch).map(([id, c]) => ({
      id,
      ...c,
      // 确保 enabled 字段一致（有些渠道可能用 disabled 字段）
      enabled: c.disabled === true ? false : (c.enabled !== false)
    }))
    plugins.value = Array.isArray(pl) ? pl : []
    knownChannels.value = Array.isArray(kc) ? kc : []
  } catch (e) {
    showToast('加载失败: ' + e.message)
  }
  loading.value = false
}

async function toggleChannel(ch) {
  toggling.value = ch.id
  try {
    const newEnabled = !ch.enabled
    await updateChannel(ch.id, { enabled: newEnabled, disabled: !newEnabled })
    ch.enabled = newEnabled
    showToast(`${ch.id} 已${newEnabled ? '启用' : '禁用'}`)
  } catch (e) {
    showToast(`操作失败: ${e.message}`)
  }
  toggling.value = null
}

async function removeChannel(ch) {
  if (!confirm(`确定要删除渠道 ${ch.id} 吗？此操作不可恢复。`)) return
  try {
    await deleteChannel(ch.id)
    showToast(`${ch.id} 已删除`)
    await fetchData()
  } catch (e) {
    showToast(`删除失败: ${e.message}`)
  }
}

function showToast(msg) {
  toast.value = msg
  setTimeout(() => toast.value = '', 3000)
}

function openEdit(ch) {
  editingChannel.value = ch
  const { id, ...config } = ch
  editJson.value = JSON.stringify(config, null, 2)
}

function closeEdit() {
  editingChannel.value = null
  editJson.value = ''
}

async function saveChannel() {
  saving.value = true
  try {
    const config = JSON.parse(editJson.value)
    await updateChannel(editingChannel.value.id, config)
    showToast(`${editingChannel.value.id} 配置已保存`)
    closeEdit()
    await fetchData()
  } catch (e) {
    if (e instanceof SyntaxError) {
      showToast('JSON 格式错误，请检查')
    } else {
      showToast(`保存失败: ${e.message}`)
    }
  }
  saving.value = false
}

async function installPlugin(plugin) {
  pluginAction.value = plugin.id
  try {
    const res = await fetch(`/api/v1/plugins/${encodeURIComponent(plugin.id)}/install`, {
      method: 'POST',
      headers: { 'Authorization': localStorage.getItem('clawdash_token') || '' }
    })
    const data = await res.json()
    if (data.success) {
      showToast(`${plugin.id} 安装成功`)
      await fetchData()
    } else {
      showToast(`安装失败: ${data.error}`)
    }
  } catch (e) {
    showToast(`安装失败: ${e.message}`)
  }
  pluginAction.value = null
}

async function togglePlugin(pl) {
  pluginAction.value = pl.id
  try {
    const action = pl.status === 'enabled' ? 'disable' : 'enable'
    const res = await fetch(`/api/v1/plugins/${encodeURIComponent(pl.id)}/${action}`, {
      method: 'POST',
      headers: { 'Authorization': localStorage.getItem('clawdash_token') || '' }
    })
    const data = await res.json()
    if (data.success) {
      showToast(`${pl.id} 已${action === 'enable' ? '启用' : '禁用'}`)
      await fetchData()
    } else {
      showToast(`操作失败: ${data.error}`)
    }
  } catch (e) {
    showToast(`操作失败: ${e.message}`)
  }
  pluginAction.value = null
}

const channelIcons = {
  feishu: '🐦', qqbot: '🐧', telegram: '✈️', discord: '🎮',
  wechat: '💚', slack: '💼', whatsapp: '📱', matrix: '🔗'
}

const enabledCount = computed(() => channels.value.filter(c => c.enabled !== false).length)
const installedPlugins = computed(() => plugins.value.filter(p => p.status === 'enabled').length)
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
        <p class="text-sm text-gray-500 mt-0.5">管理消息渠道和插件</p>
      </div>
      <button @click="fetchData" class="px-3 py-1.5 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
        刷新
      </button>
    </div>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="bg-white rounded-xl border border-gray-200 p-4 text-center">
        <p class="text-2xl font-bold text-blue-600">{{ channels.length }}</p>
        <p class="text-xs text-gray-500 mt-1">渠道总数</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4 text-center">
        <p class="text-2xl font-bold text-emerald-600">{{ enabledCount }}</p>
        <p class="text-xs text-gray-500 mt-1">已启用</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4 text-center">
        <p class="text-2xl font-bold text-purple-600">{{ plugins.length }}</p>
        <p class="text-xs text-gray-500 mt-1">已安装插件</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4 text-center">
        <p class="text-2xl font-bold text-amber-600">{{ installedPlugins }}</p>
        <p class="text-xs text-gray-500 mt-1">活跃插件</p>
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
      <div v-if="channels.length === 0" class="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
        <span class="text-4xl mb-4">📡</span>
        <p class="text-sm font-medium text-gray-600">暂无渠道配置</p>
        <p class="text-xs text-gray-400 mt-1">请先安装渠道插件（如飞书、QQ Bot 等）</p>
      </div>
      <div v-for="ch in channels" :key="ch.id"
        class="bg-white rounded-xl border border-gray-200 overflow-hidden transition-all hover:border-gray-300 hover:shadow-sm">
        <div class="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 p-4">
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
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
              <p class="text-xs text-gray-500 truncate mt-0.5">
                {{ ch.connectionMode || '默认连接' }}
                <span v-if="ch.streaming" class="ml-2 text-green-500">● 流式</span>
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <button
              @click="toggleChannel(ch)"
              :disabled="toggling === ch.id"
              class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              :class="ch.enabled !== false
                ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100'
                : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-100'">
              {{ toggling === ch.id ? '处理中...' : (ch.enabled !== false ? '禁用' : '启用') }}
            </button>
            <button
              @click="openEdit(ch)"
              class="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100 transition-all">
              编辑
            </button>
            <button
              @click="removeChannel(ch)"
              class="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-600 border border-gray-200 transition-all">
              删除
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 插件管理 -->
    <div v-else-if="activeTab === 'plugins'" class="space-y-3">
      <!-- 已安装插件 -->
      <div class="bg-white rounded-xl border border-gray-200 p-5">
        <h3 class="text-sm font-semibold text-gray-800 mb-4">已安装插件</h3>
        <div v-if="plugins.length === 0" class="text-center py-6 text-gray-400 text-sm">暂无已安装插件</div>
        <div v-else class="space-y-2">
          <div v-for="pl in plugins" :key="pl.id"
            class="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-all">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-sm">🧩</div>
              <div>
                <p class="text-sm font-medium text-gray-800">{{ pl.name || pl.id }}</p>
                <p class="text-xs text-gray-400">{{ pl.pkgName || pl.type || '-' }}</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                :class="pl.status === 'enabled' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'">
                {{ pl.status === 'enabled' ? '已启用' : '已禁用' }}
              </span>
              <button
                @click="togglePlugin(pl)"
                :disabled="pluginAction === pl.id"
                class="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                :class="pl.status === 'enabled'
                  ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                  : 'bg-green-50 text-green-600 hover:bg-green-100'">
                {{ pluginAction === pl.id ? '...' : (pl.status === 'enabled' ? '禁用' : '启用') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 可安装插件 -->
      <div v-if="knownChannels.length > 0" class="bg-white rounded-xl border border-gray-200 p-5">
        <h3 class="text-sm font-semibold text-gray-800 mb-4">可安装渠道</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div v-for="kc in knownChannels" :key="kc.id"
            class="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-all">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-sm">
                {{ channelIcons[kc.id] || '📡' }}
              </div>
              <div>
                <p class="text-sm font-medium text-gray-800">{{ kc.name || kc.id }}</p>
                <p class="text-xs text-gray-400">{{ kc.description || '-' }}</p>
              </div>
            </div>
            <button
              @click="installPlugin(kc)"
              :disabled="pluginAction === kc.id"
              class="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all">
              {{ pluginAction === kc.id ? '安装中...' : '安装' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <Teleport to="body">
      <div v-if="editingChannel" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/40" @click="closeEdit"></div>
        <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
          <div class="flex items-center justify-between p-5 border-b border-gray-200">
            <h3 class="text-base font-semibold text-gray-800">编辑渠道: {{ editingChannel.id }}</h3>
            <button @click="closeEdit" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
          </div>
          <div class="flex-1 overflow-y-auto p-5">
            <p class="text-xs text-gray-400 mb-3">编辑 JSON 配置（修改后点击保存）</p>
            <textarea
              v-model="editJson"
              class="w-full h-64 font-mono text-sm border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              spellcheck="false"
            ></textarea>
          </div>
          <div class="flex justify-end gap-3 p-5 border-t border-gray-200">
            <button @click="closeEdit" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">取消</button>
            <button @click="saveChannel" :disabled="saving"
              class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {{ saving ? '保存中...' : '保存' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
