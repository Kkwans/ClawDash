<script setup>
import { ref, computed, onMounted } from 'vue'

const skills = ref([])
const loading = ref(true)
const searchQuery = ref('')
const selectedSkills = ref(new Set())
const toast = ref('')
const activeFilter = ref('all')
const batchAction = ref(null)

const filters = [
  { key: 'all', label: '全部', icon: '📦' },
  { key: 'system', label: '系统', icon: '⚙️' },
  { key: 'platform', label: '平台', icon: '🌐' },
  { key: 'custom', label: '自建', icon: '✏️' },
]

// 从 Gateway 获取 Skill 列表
async function fetchSkills() {
  loading.value = true
  try {
    const token = localStorage.getItem('clawdash_token') || ''
    // 尝试通过 Gateway WebSocket 获取
    const res = await fetch('/api/v1/plugins', {
      headers: { 'Authorization': token }
    })
    const data = await res.json()
    if (data.success && data.data) {
      // 转换为 Skill 格式
      const plugins = Array.isArray(data.data) ? data.data : []
      skills.value = plugins.map(p => ({
        id: p.id || p.name,
        name: p.name || p.id,
        description: p.description || p.pkgName || '-',
        source: p.source || (p.builtin ? 'system' : 'platform'),
        enabled: p.status === 'enabled',
        version: p.version || '-',
        author: p.author || '-',
        tags: p.tags || [],
      }))
    }
  } catch (e) {
    console.error('Failed to fetch skills:', e)
  }
  loading.value = false
}

function showToast(msg) {
  toast.value = msg
  setTimeout(() => toast.value = '', 3000)
}

function toggleSelect(id) {
  if (selectedSkills.value.has(id)) {
    selectedSkills.value.delete(id)
  } else {
    selectedSkills.value.add(id)
  }
}

function selectAll() {
  if (selectedSkills.value.size === filteredSkills.value.length) {
    selectedSkills.value.clear()
  } else {
    filteredSkills.value.forEach(s => selectedSkills.value.add(s.id))
  }
}

async function toggleSkill(skill) {
  try {
    const action = skill.enabled ? 'disable' : 'enable'
    const token = localStorage.getItem('clawdash_token') || ''
    const res = await fetch(`/api/v1/plugins/${encodeURIComponent(skill.id)}/${action}`, {
      method: 'POST',
      headers: { 'Authorization': token }
    })
    const data = await res.json()
    if (data.success) {
      skill.enabled = !skill.enabled
      showToast(`${skill.id} 已${skill.enabled ? '启用' : '禁用'}`)
    } else {
      showToast(`操作失败: ${data.error}`)
    }
  } catch (e) {
    showToast(`操作失败: ${e.message}`)
  }
}

async function batchToggle(enable) {
  batchAction.value = enable ? 'enable' : 'disable'
  const ids = [...selectedSkills.value]
  let success = 0
  for (const id of ids) {
    const skill = skills.value.find(s => s.id === id)
    if (skill && skill.enabled !== enable) {
      try {
        const token = localStorage.getItem('clawdash_token') || ''
        await fetch(`/api/v1/plugins/${encodeURIComponent(id)}/${enable ? 'enable' : 'disable'}`, {
          method: 'POST',
          headers: { 'Authorization': token }
        })
        skill.enabled = enable
        success++
      } catch {}
    }
  }
  showToast(`已${enable ? '启用' : '禁用'} ${success} 个 Skill`)
  selectedSkills.value.clear()
  batchAction.value = null
}

const filteredSkills = computed(() => {
  let list = skills.value
  if (activeFilter.value !== 'all') {
    list = list.filter(s => s.source === activeFilter.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags.some(t => t.toLowerCase().includes(q))
    )
  }
  return list
})

const sourceLabel = { system: '系统', platform: '平台', custom: '自建' }
const sourceColor = {
  system: 'bg-blue-50 text-blue-700 border-blue-100',
  platform: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  custom: 'bg-purple-50 text-purple-700 border-purple-100',
}

onMounted(fetchSkills)
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
        <p class="text-sm text-gray-500 mt-0.5">管理 Agent 技能包</p>
      </div>
      <div class="flex items-center gap-2">
        <a href="https://clawh.ai" target="_blank"
          class="px-3 py-1.5 text-xs text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors">
          🔍 搜索 Skill
        </a>
        <button @click="fetchSkills" class="px-3 py-1.5 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
          刷新
        </button>
      </div>
    </div>

    <!-- 搜索和筛选 -->
    <div class="flex flex-col sm:flex-row gap-3">
      <div class="relative flex-1">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input v-model="searchQuery" placeholder="搜索 Skill 名称、描述、标签..."
          class="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
      </div>
      <div class="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
        <button v-for="f in filters" :key="f.key"
          @click="activeFilter = f.key"
          class="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
          :class="activeFilter === f.key
            ? 'bg-white text-gray-800 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'">
          <span>{{ f.icon }}</span>
          <span>{{ f.label }}</span>
        </button>
      </div>
    </div>

    <!-- 批量操作栏 -->
    <div v-if="selectedSkills.size > 0"
      class="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
      <span class="text-sm text-blue-700 font-medium">已选 {{ selectedSkills.size }} 项</span>
      <button @click="batchToggle(true)" :disabled="batchAction"
        class="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
        批量启用
      </button>
      <button @click="batchToggle(false)" :disabled="batchAction"
        class="px-3 py-1 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">
        批量禁用
      </button>
      <button @click="selectedSkills.clear()"
        class="px-3 py-1 text-xs text-gray-500 hover:text-gray-700">
        取消选择
      </button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="flex flex-col items-center gap-3">
        <div class="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        <span class="text-sm text-gray-400">加载中...</span>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else-if="filteredSkills.length === 0" class="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
      <span class="text-4xl mb-4">📦</span>
      <p class="text-sm font-medium text-gray-600">{{ searchQuery ? '未找到匹配的 Skill' : '暂无 Skill' }}</p>
      <p class="text-xs text-gray-400 mt-1">{{ searchQuery ? '请尝试其他关键词' : '请先安装 Skill 或配置 Skill 目录' }}</p>
    </div>

    <!-- Skill 列表 -->
    <div v-else class="space-y-2">
      <!-- 全选 -->
      <div class="flex items-center gap-2 px-1">
        <button @click="selectAll"
          class="text-xs text-gray-500 hover:text-gray-700">
          {{ selectedSkills.size === filteredSkills.length ? '取消全选' : '全选' }}
        </button>
        <span class="text-xs text-gray-400">共 {{ filteredSkills.length }} 个 Skill</span>
      </div>

      <div v-for="skill in filteredSkills" :key="skill.id"
        class="bg-white rounded-xl border border-gray-200 p-4 transition-all hover:border-gray-300 hover:shadow-sm"
        :class="{ 'ring-1 ring-blue-200 border-blue-200': selectedSkills.has(skill.id) }">
        <div class="flex items-start gap-3">
          <!-- 选择框 -->
          <button @click="toggleSelect(skill.id)"
            class="w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center mt-0.5 transition-all"
            :class="selectedSkills.has(skill.id)
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'border-gray-300 hover:border-gray-400'">
            <svg v-if="selectedSkills.has(skill.id)" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
            </svg>
          </button>

          <div class="flex-1 min-w-0">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <p class="text-sm font-semibold text-gray-900">{{ skill.name }}</p>
                  <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border"
                    :class="sourceColor[skill.source] || sourceColor.platform">
                    {{ sourceLabel[skill.source] || skill.source }}
                  </span>
                  <span v-if="skill.version !== '-'" class="text-xs text-gray-400">v{{ skill.version }}</span>
                </div>
                <p class="text-xs text-gray-500 mt-0.5">{{ skill.description }}</p>
                <div v-if="skill.tags.length" class="flex gap-1 mt-1.5">
                  <span v-for="tag in skill.tags" :key="tag"
                    class="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">{{ tag }}</span>
                </div>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                  :class="skill.enabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'">
                  <span class="w-1.5 h-1.5 rounded-full" :class="skill.enabled ? 'bg-green-500' : 'bg-gray-400'"></span>
                  {{ skill.enabled ? '已启用' : '已禁用' }}
                </span>
                <button @click="toggleSkill(skill)"
                  class="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                  :class="skill.enabled
                    ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                    : 'bg-green-50 text-green-600 hover:bg-green-100'">
                  {{ skill.enabled ? '禁用' : '启用' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
