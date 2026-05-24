<script setup>
import { ref, computed, onMounted } from 'vue'
import { gwRequest } from '../stores/gateway.js'

const searchResults = ref([])
const installedSkills = ref([])
const pluginEntries = ref([])
const loading = ref(true)
const searching = ref(false)
const searchQuery = ref('')
const toast = ref('')
const confirmDialog = ref({ show: false, msg: '', onOk: null })
const activeTab = ref('installed')

function showConfirm(msg) {
  return new Promise(resolve => {
    confirmDialog.value = { show: true, msg, onOk: () => { confirmDialog.value.show = false; resolve(true) } }
  })
}
function cancelConfirm() { confirmDialog.value.show = false }

async function fetchData() {
  loading.value = true
  try {
    const [skills, cfg] = await Promise.all([
      gwRequest('skills.list').catch(() => null),
      gwRequest('config.get').catch(() => null)
    ])
    installedSkills.value = skills?.skills || []
    const entries = cfg?.parsed?.plugins?.entries || {}
    pluginEntries.value = Object.entries(entries).map(([id, c]) => ({
      id, config: c, enabled: c.enabled !== false
    }))
  } catch (e) {
    console.error('Failed to fetch skills:', e)
  }
  loading.value = false
}

async function searchSkills() {
  if (!searchQuery.value.trim()) return
  searching.value = true
  try {
    const res = await gwRequest('skills.search', { query: searchQuery.value.trim() })
    searchResults.value = res?.results || []
  } catch (e) {
    showToast('搜索失败: ' + e.message)
  }
  searching.value = false
}

async function installSkill(skill) {
  try {
    await gwRequest('skills.install', { uploadId: skill.uploadId || skill.slug })
    showToast(`${skill.displayName || skill.name} 安装成功`)
    await fetchData()
  } catch (e) {
    showToast(`安装失败: ${e.message}`)
  }
}

async function deleteSkill(skill) {
  const ok = await showConfirm(`确定删除 Skill "${skill.name || skill.id}"？`)
  if (!ok) return
  try {
    await gwRequest('skills.delete', { name: skill.name || skill.id })
    showToast(`${skill.name || skill.id} 已删除`)
    await fetchData()
  } catch (e) {
    showToast(`删除失败: ${e.message}`)
  }
}

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

function showToast(msg) {
  toast.value = msg
  setTimeout(() => toast.value = '', 3000)
}

function formatDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('zh-CN')
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
        <h2 class="text-lg font-bold text-gray-900">Skill 管理</h2>
        <p class="text-sm text-gray-500 mt-0.5">管理本地插件和搜索 ClawHub Skill</p>
      </div>
      <button @click="fetchData" class="px-3 py-1.5 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
        刷新
      </button>
    </div>

    <!-- Tab 切换 -->
    <div class="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
      <button @click="activeTab = 'installed'"
        class="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all"
        :class="activeTab === 'installed' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'">
        🧩 已安装插件
      </button>
      <button @click="activeTab = 'search'"
        class="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all"
        :class="activeTab === 'search' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'">
        🔍 搜索 ClawHub
      </button>
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

    <!-- 已安装 Skill -->
    <div v-if="activeTab === 'installed'" class="space-y-3">
      <div v-if="loading" class="flex items-center justify-center py-16">
        <div class="flex flex-col items-center gap-3">
          <div class="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <span class="text-sm text-gray-400">加载中...</span>
        </div>
      </div>
      <div v-else-if="installedSkills.length === 0 && pluginEntries.length === 0" class="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
        <span class="text-4xl mb-4">🧩</span>
        <p class="text-sm font-medium text-gray-600">暂无已安装 Skill</p>
        <p class="text-xs text-gray-400 mt-1">切换到「搜索 ClawHub」查找并安装 Skill</p>
      </div>
      <div v-else>
        <!-- Skills from skills.list -->
        <div v-for="skill in installedSkills" :key="skill.name || skill.id"
          class="bg-white rounded-xl border border-gray-200 p-4 transition-all hover:border-gray-300">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-blue-50">⚡</div>
              <div class="min-w-0">
                <p class="text-sm font-semibold text-gray-900">{{ skill.displayName || skill.name }}</p>
                <p class="text-xs text-gray-400 mt-0.5">{{ skill.description || skill.source || '本地 Skill' }}</p>
              </div>
            </div>
            <div class="flex gap-2">
              <button @click="deleteSkill(skill)"
                class="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 transition-all">
                删除
              </button>
            </div>
          </div>
        </div>
        <!-- Plugins from config -->
        <div v-for="pl in pluginEntries" :key="pl.id"
          class="bg-white rounded-xl border border-gray-200 p-4 transition-all hover:border-gray-300">
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
            <button @click="togglePlugin(pl)"
              class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              :class="pl.enabled
                ? 'bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-100'
                : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-100'">
              {{ pl.enabled ? '禁用' : '启用' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 搜索 ClawHub -->
    <div v-if="activeTab === 'search'" class="space-y-4">
      <div class="flex gap-2">
        <div class="relative flex-1">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input v-model="searchQuery" @keyup.enter="searchSkills"
            placeholder="搜索 Skill（如 docker、git、deploy...）"
            class="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <button @click="searchSkills" :disabled="searching || !searchQuery.trim()"
          class="px-4 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all">
          {{ searching ? '搜索中...' : '搜索' }}
        </button>
      </div>

      <div v-if="searching" class="flex items-center justify-center py-12">
        <div class="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>

      <div v-else-if="searchResults.length === 0 && searchQuery" class="flex flex-col items-center justify-center py-12 bg-white rounded-xl border border-gray-100">
        <span class="text-3xl mb-3">🔍</span>
        <p class="text-sm text-gray-500">未找到匹配的 Skill</p>
      </div>

      <div v-else class="space-y-2">
        <div v-for="skill in searchResults" :key="skill.slug"
          class="bg-white rounded-xl border border-gray-200 p-4 transition-all hover:border-gray-300 hover:shadow-sm">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <p class="text-sm font-semibold text-gray-900">{{ skill.displayName }}</p>
                <span class="text-xs text-gray-400 font-mono">{{ skill.slug }}</span>
              </div>
              <p class="text-xs text-gray-500 mt-1 line-clamp-2">{{ skill.summary }}</p>
              <div class="flex items-center gap-3 mt-2 text-xs text-gray-400">
                <span v-if="skill.owner?.displayName">👤 {{ skill.owner.displayName }}</span>
                <span v-if="skill.updatedAt">📅 {{ formatDate(skill.updatedAt) }}</span>
              </div>
            </div>
            <button @click="installSkill(skill)"
              class="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100 transition-all flex-shrink-0">
              安装
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
