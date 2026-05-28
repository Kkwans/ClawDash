<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { gwRequest, token } from '../stores/gateway.js'
import { getRawConfig } from "../api/config-utils.js"
import AppToast from '../components/AppToast.vue'
import AppEmpty from '../components/AppEmpty.vue'
import AppLoading from '../components/AppLoading.vue'
import AppConfirm from '../components/AppConfirm.vue'
import AppButton from '../components/AppButton.vue'
import AppBadge from '../components/AppBadge.vue'
import { createLogger } from '../utils/logger.js'
import { useEnterAnim } from '../composables/useEnterAnim.js'

const log = createLogger('Skills')
const { entered } = useEnterAnim()

const searchResults = ref([])
const installedSkills = ref([])
const pluginEntries = ref([])
const loading = ref(true)
const searching = ref(false)
const searchQuery = ref('')
const toastRef = ref(null)
const confirmRef = ref(null)
const activeTab = ref('installed')
const selectedPlugins = ref(new Set())

function showToast(msg, type = 'info') {
  toastRef.value?.show(msg, type)
}

async function showConfirm(msg) {
  return confirmRef.value?.confirm(msg) || false
}

async function fetchData() {
  loading.value = true
  try {
    const [skillsRes, cfg] = await Promise.all([
      fetch(`/skills.json`).then(r => r.json()).catch(() => []),
      gwRequest('config.get').catch(() => null)
    ])
    installedSkills.value = Array.isArray(skillsRes) ? skillsRes : []
    const entries = cfg?.parsed?.plugins?.entries || {}
    pluginEntries.value = Object.entries(entries).map(([id, c]) => ({
      id, config: c, enabled: c.enabled !== false
    }))
  } catch (e) {
    log.warn('加载 Skill 列表失败:', e)
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
    showToast('搜索失败: ' + e.message, 'error')
  }
  searching.value = false
}

async function installSkill(skill) {
  try {
    const res = await fetch('/api/skills/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token.value },
      body: JSON.stringify({ slug: skill.slug })
    })
    const data = await res.json()
    if (data.ok) {
      showToast(`${skill.displayName || skill.name} 安装成功`, 'success')
      await fetchData()
    } else {
      showToast(`安装失败: ${data.error || '未知错误'}`, 'error')
    }
  } catch (e) {
    showToast(`安装失败: ${e.message}`, 'error')
  }
}

async function deleteSkill(skill) {
  const ok = await showConfirm(`确定删除 Skill "${skill.name || skill.id}"？`)
  if (!ok) return
  try {
    const res = await fetch('/api/skills/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token.value },
      body: JSON.stringify({ name: skill.name || skill.id })
    })
    const data = await res.json()
    if (data.ok) {
      showToast(`${skill.name || skill.id} 已删除`, 'success')
      await fetchData()
    } else {
      showToast(`删除失败: ${data.error || '未知错误'}`, 'error')
    }
  } catch (e) {
    showToast(`删除失败: ${e.message}`, 'error')
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
    showToast(`${plugin.id} 已${entry.enabled ? '启用' : '禁用'}`)
    await fetchData()
  } catch (e) {
    showToast('操作失败: ' + e.message, 'error')
  }
}

function formatDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('zh-CN')
}

function toggleSelectPlugin(id) {
  const newSet = new Set(selectedPlugins.value)
  if (newSet.has(id)) newSet.delete(id)
  else newSet.add(id)
  selectedPlugins.value = newSet
}

function toggleSelectAllPlugins() {
  if (selectedPlugins.value.size === pluginEntries.value.length) {
    selectedPlugins.value = new Set()
  } else {
    selectedPlugins.value = new Set(pluginEntries.value.map(p => p.id))
  }
}

async function batchTogglePlugins(enable) {
  if (selectedPlugins.value.size === 0) return
  const ok = await showConfirm(`确定批量${enable ? '启用' : '禁用'} ${selectedPlugins.value.size} 个插件？`)
  if (!ok) return
  try {
    const cfgRes = await gwRequest('config.get')
    const raw = getRawConfig(cfgRes)
    const hash = cfgRes?.hash
    if (!raw || !hash) throw new Error('无法获取配置')
    const cfg = JSON.parse(raw)
    let count = 0
    for (const id of selectedPlugins.value) {
      const entry = cfg.plugins?.entries?.[id]
      if (entry && entry.enabled !== enable) {
        entry.enabled = enable
        count++
      }
    }
    await gwRequest('config.set', { raw: JSON.stringify(cfg), baseHash: hash })
    selectedPlugins.value = new Set()
    showToast(`已${enable ? '启用' : '禁用'} ${count} 个插件`)
    await fetchData()
  } catch (e) {
    showToast(`批量操作失败: ${e.message}`, 'error')
  }
}

onMounted(fetchData)
</script>

<template>
  <div class="space-y-6">
    <AppToast ref="toastRef" />
    <AppConfirm ref="confirmRef" />

    <!-- 页面标题 -->
    <div class="enter-anim" :class="{ 'is-entered': entered }" style="--delay: 0ms">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold text-gray-900 tracking-tight">Skill 管理</h2>
          <p class="text-sm text-gray-500 mt-0.5">管理本地插件和搜索 ClawHub Skill</p>
        </div>
        <AppButton size="sm" variant="primary" @click="fetchData">
          <span class="flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            刷新
          </span>
        </AppButton>
      </div>
    </div>

    <!-- Tab 切换 -->
    <div class="enter-anim" :class="{ 'is-entered': entered }" style="--delay: 80ms">
      <div class="flex items-center gap-1 bg-gray-100/80 rounded-xl p-1 w-fit">
        <button @click="activeTab = 'installed'"
          class="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          :class="activeTab === 'installed' ? 'bg-white text-gray-800 shadow-sm ring-1 ring-gray-200/60' : 'text-gray-500 hover:text-gray-700'">
          🧩 已安装插件
          <span v-if="installedSkills.length + pluginEntries.length > 0"
            class="ml-1 px-1.5 py-0.5 text-xs rounded-full"
            :class="activeTab === 'installed' ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-200 text-gray-500'">
            {{ installedSkills.length + pluginEntries.length }}
          </span>
        </button>
        <button @click="activeTab = 'search'"
          class="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          :class="activeTab === 'search' ? 'bg-white text-gray-800 shadow-sm ring-1 ring-gray-200/60' : 'text-gray-500 hover:text-gray-700'">
          🔍 搜索 ClawHub
        </button>
      </div>
    </div>

    <!-- 已安装 Skill -->
    <div v-if="activeTab === 'installed'" class="enter-anim" :class="{ 'is-entered': entered }" style="--delay: 160ms">
      <AppLoading v-if="loading" text="加载 Skill 中..." />
      <AppEmpty v-else-if="installedSkills.length === 0 && pluginEntries.length === 0"
        icon="🧩"
        title="暂无已安装 Skill"
        description="切换到「搜索 ClawHub」查找并安装 Skill"
      />
      <div v-else class="space-y-3">
        <!-- Skills from skills.list -->
        <div v-for="(skill, idx) in installedSkills" :key="skill.name || skill.id"
          class="card-hover bg-white rounded-2xl border border-gray-200/60 p-5 shadow-sm transition-all"
          :style="{ '--card-delay': idx * 40 + 'ms' }">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4 min-w-0">
              <div class="w-11 h-11 rounded-xl flex items-center justify-center text-xl bg-gradient-to-br from-indigo-50 to-blue-50 ring-1 ring-indigo-100/60">
                ⚡
              </div>
              <div class="min-w-0">
                <p class="text-sm font-semibold text-gray-900 tracking-tight">{{ skill.displayName || skill.name }}</p>
                <p class="text-xs text-gray-400 mt-0.5 line-clamp-1">{{ skill.description || skill.source || '本地 Skill' }}</p>
              </div>
            </div>
            <AppButton size="sm" variant="danger" @click="deleteSkill(skill)">删除</AppButton>
          </div>
        </div>

        <!-- Batch operations for plugins -->
        <div v-if="pluginEntries.length > 0" class="flex items-center gap-3 pt-2 pb-1">
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" :checked="selectedPlugins.size === pluginEntries.length && pluginEntries.length > 0" @change="toggleSelectAllPlugins"
              aria-label="全选插件"
              class="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 transition-colors">
            <span class="text-xs text-gray-500">全选插件</span>
          </label>
          <AppButton v-if="selectedPlugins.size > 0" size="sm" @click="batchTogglePlugins(true)">
            批量启用 ({{ selectedPlugins.size }})
          </AppButton>
          <AppButton v-if="selectedPlugins.size > 0" size="sm" @click="batchTogglePlugins(false)">
            批量禁用 ({{ selectedPlugins.size }})
          </AppButton>
        </div>

        <!-- Plugins from config -->
        <div v-for="(pl, idx) in pluginEntries" :key="pl.id"
          class="card-hover card-accent bg-white rounded-2xl border border-gray-200/60 p-5 shadow-sm transition-all"
          :style="{ '--card-delay': (installedSkills.length + idx) * 40 + 'ms' }">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4 min-w-0">
              <input type="checkbox" :checked="selectedPlugins.has(pl.id)" @click.stop="toggleSelectPlugin(pl.id)"
                class="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 flex-shrink-0 transition-colors">
              <div class="w-11 h-11 rounded-xl flex items-center justify-center text-xl transition-colors"
                :class="pl.enabled ? 'bg-gradient-to-br from-green-50 to-emerald-50 ring-1 ring-green-100/60' : 'bg-gray-100 ring-1 ring-gray-200/60'">
                🧩
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2.5">
                  <p class="text-sm font-semibold text-gray-900 tracking-tight">{{ pl.id }}</p>
                  <AppBadge :type="pl.enabled ? 'success' : 'default'" size="sm" dot>
                    {{ pl.enabled ? '已启用' : '已禁用' }}
                  </AppBadge>
                </div>
                <p v-if="pl.config?.description" class="text-xs text-gray-400 mt-0.5 line-clamp-1">{{ pl.config.description }}</p>
              </div>
            </div>
            <AppButton size="sm" @click="togglePlugin(pl)">
              {{ pl.enabled ? '禁用' : '启用' }}
            </AppButton>
          </div>
        </div>
      </div>
    </div>

    <!-- 搜索 ClawHub -->
    <div v-if="activeTab === 'search'" class="enter-anim" :class="{ 'is-entered': entered }" style="--delay: 160ms">
      <!-- 搜索框 -->
      <div class="flex gap-3">
        <div class="relative flex-1">
          <svg class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input v-model="searchQuery" @keyup.enter="searchSkills"
            placeholder="搜索 Skill（如 docker、git、deploy...）"
            autocomplete="off"
            aria-label="搜索 Skill"
            class="w-full pl-10 pr-4 py-3 border border-gray-200/80 rounded-xl text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-300 placeholder:text-gray-400 transition-all">
        </div>
        <AppButton variant="primary" :loading="searching" :disabled="!searchQuery.trim()" @click="searchSkills">
          {{ searching ? '搜索中...' : '搜索' }}
        </AppButton>
      </div>

      <!-- 搜索中 -->
      <div v-if="searching" class="flex flex-col items-center justify-center py-16">
        <div class="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p class="text-xs text-gray-400 mt-3">正在搜索 ClawHub...</p>
      </div>

      <!-- 无结果 -->
      <div v-else-if="searchResults.length === 0 && searchQuery" class="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-200/60 shadow-sm">
        <div class="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center text-3xl mb-3">🔍</div>
        <p class="text-sm font-medium text-gray-600">未找到匹配的 Skill</p>
        <p class="text-xs text-gray-400 mt-1">试试其他关键词</p>
      </div>

      <!-- 搜索结果 -->
      <div v-else class="space-y-2.5">
        <div v-for="(skill, idx) in searchResults" :key="skill.slug"
          class="card-hover card-accent bg-white rounded-2xl border border-gray-200/60 p-5 shadow-sm transition-all"
          :style="{ '--card-delay': idx * 40 + 'ms' }">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2.5">
                <div class="w-9 h-9 rounded-xl flex items-center justify-center text-base bg-gradient-to-br from-purple-50 to-indigo-50 ring-1 ring-purple-100/60 flex-shrink-0">
                  ⚡
                </div>
                <div>
                  <p class="text-sm font-semibold text-gray-900 tracking-tight">{{ skill.displayName }}</p>
                  <p class="text-xs text-gray-400 font-mono">{{ skill.slug }}</p>
                </div>
              </div>
              <p class="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">{{ skill.summary }}</p>
              <div class="flex items-center gap-4 mt-2.5 text-xs text-gray-400">
                <span v-if="skill.owner?.displayName" class="flex items-center gap-1">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                  {{ skill.owner.displayName }}
                </span>
                <span v-if="skill.updatedAt" class="flex items-center gap-1">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  {{ formatDate(skill.updatedAt) }}
                </span>
              </div>
            </div>
            <AppButton size="sm" @click="installSkill(skill)">安装</AppButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Skills 使用 shared-animations.css 中的 .enter-anim / .is-entered */
</style>
