<script setup>
import { ref, onMounted } from 'vue'
import { getChannels, getPlugins, updateChannel } from '../api'

const channels = ref([])
const plugins = ref([])
const loading = ref(true)
const toggling = ref(null)
const toast = ref('')
const editingChannel = ref(null)
const editJson = ref('')
const saving = ref(false)

async function fetchData() {
  loading.value = true
  try {
    const [ch, pl] = await Promise.all([getChannels(), getPlugins()])
    channels.value = Object.entries(ch).map(([id, c]) => ({ id, ...c }))
    plugins.value = Array.isArray(pl) ? pl : []
  } catch {}
  loading.value = false
}

async function toggleChannel(ch) {
  toggling.value = ch.id
  try {
    const newEnabled = ch.enabled === false ? true : false
    await updateChannel(ch.id, { enabled: newEnabled })
    ch.enabled = newEnabled
    showToast(`${ch.id} 已${newEnabled ? '启用' : '禁用'}`)
  } catch (e) {
    showToast(`操作失败: ${e.message}`)
  }
  toggling.value = null
}

function showToast(msg) {
  toast.value = msg
  setTimeout(() => toast.value = '', 3000)
}

function openEdit(ch) {
  editingChannel.value = ch
  // 排除 id 字段，只编辑配置
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

const channelIcons = { feishu: '🐦', qqbot: '🐧', telegram: '✈️', discord: '🎮', wechat: '💚' }

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

    <!-- 渠道列表 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-semibold text-gray-800">消息渠道</h3>
        <button @click="fetchData" class="text-sm text-blue-600 hover:text-blue-700">刷新</button>
      </div>

      <div v-if="loading" class="text-center py-8 text-gray-400">加载中...</div>
      <div v-else-if="channels.length === 0" class="text-center py-8 text-gray-400">暂无渠道配置</div>
      <div v-else class="space-y-3">
        <div v-for="ch in channels" :key="ch.id"
          class="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-lg">
              {{ channelIcons[ch.id] || '📡' }}
            </div>
            <div>
              <p class="text-sm font-semibold text-gray-800">{{ ch.id }}</p>
              <p class="text-xs text-gray-400">
                {{ ch.connectionMode || '-' }}
                <span v-if="ch.streaming" class="ml-2 text-green-500">● 流式</span>
              </p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
              :class="ch.enabled !== false ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'">
              <span class="w-1.5 h-1.5 rounded-full" :class="ch.enabled !== false ? 'bg-green-500' : 'bg-gray-400'"></span>
              {{ ch.enabled !== false ? '已启用' : '已禁用' }}
            </span>
            <button
              @click="toggleChannel(ch)"
              :disabled="toggling === ch.id"
              class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              :class="ch.enabled !== false
                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                : 'bg-green-50 text-green-600 hover:bg-green-100'">
              {{ toggling === ch.id ? '处理中...' : (ch.enabled !== false ? '禁用' : '启用') }}
            </button>
            <button
              @click="openEdit(ch)"
              class="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all">
              编辑
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 插件列表 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 class="text-base font-semibold text-gray-800 mb-4">插件</h3>
      <div v-if="plugins.length === 0" class="text-center py-4 text-gray-400 text-sm">暂无插件</div>
      <div v-else class="space-y-3">
        <div v-for="pl in plugins" :key="pl.id"
          class="flex items-center justify-between p-4 rounded-lg border border-gray-200">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-lg">🧩</div>
            <div>
              <p class="text-sm font-semibold text-gray-800">{{ pl.name || pl.id }}</p>
              <p class="text-xs text-gray-400">{{ pl.pkgName || pl.type || '-' }}</p>
            </div>
          </div>
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
            :class="pl.status === 'enabled' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'">
            {{ pl.status === 'enabled' ? '已启用' : '已禁用' }}
          </span>
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
            <button @click="closeEdit"
              class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              取消
            </button>
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
