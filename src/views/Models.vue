<script setup>
import { ref, onMounted, watch } from 'vue'
import { gwRequest, authenticated, connecting, connectionError } from '../stores/gateway.js'

const providers = ref([])
const loading = ref(true)
const defaultModel = ref('')
const fallbackModel = ref('')
const thinkingLevel = ref('off')
const saving = ref(false)
const expandedProviders = ref(new Set())
const toast = ref({ show: false, msg: '', type: 'info' })
const showAddModal = ref(false)
const confirmDialog = ref({ show: false, msg: '', onOk: null })
const newProvider = ref({ id: '', api: 'openai-completions', baseUrl: '', apiKey: '', models: [] })
const editingProvider = ref(null)
const editForm = ref({ baseUrl: '', apiKey: '' })

function showConfirm(msg) {
  return new Promise(resolve => {
    confirmDialog.value = { show: true, msg, onOk: () => { confirmDialog.value.show = false; resolve(true) } }
  })
}
function cancelConfirm() { confirmDialog.value.show = false }

function showToast(msg, type = 'info') {
  toast.value = { show: true, msg, type }
  setTimeout(() => toast.value.show = false, 3000)
}

const thinkingOptions = [
  { value: 'off', label: '关闭', desc: '不使用思考能力' },
  { value: 'low', label: '低', desc: '简单推理' },
  { value: 'medium', label: '中', desc: '标准推理' },
  { value: 'high', label: '高', desc: '深度推理' },
  { value: 'auto', label: '自动', desc: '由模型决定' },
]

// 等待连接就绪后加载数据
watch(authenticated, (val) => {
  if (val) fetchData()
}, { immediate: true })

async function fetchData() {
  if (!authenticated.value) return
  loading.value = true
  try {
    const cfgRes = await gwRequest('config.get')
    if (!cfgRes || !cfgRes.parsed) {
      showToast('获取配置失败', 'error')
      loading.value = false
      return
    }
    const cfg = cfgRes.parsed
    const provs = cfg.models?.providers || {}
    providers.value = Object.entries(provs).map(([id, prov]) => ({ id, ...prov }))
    const agentDefaults = cfg.agents?.defaults || {}
    defaultModel.value = agentDefaults.model?.primary || ''
    fallbackModel.value = (agentDefaults.model?.fallbacks || [])[0] || ''
    thinkingLevel.value = agentDefaults.thinking || 'off'
    if (providers.value.length > 0 && expandedProviders.value.size === 0) {
      expandedProviders.value.add(providers.value[0].id)
    }
  } catch (e) {
    showToast('加载失败: ' + e.message, 'error')
  }
  loading.value = false
}

async function updateConfig(modifier) {
  saving.value = true
  try {
    const cfgRes = await gwRequest('config.get')
    if (!cfgRes?.raw || !cfgRes?.hash) throw new Error('无法获取配置')
    const cfg = JSON.parse(cfgRes.raw)
    modifier(cfg)
    await gwRequest('config.set', { raw: JSON.stringify(cfg), baseHash: cfgRes.hash })
    showToast('设置成功', 'success')
    await fetchData()
  } catch (e) {
    showToast('设置失败: ' + e.message, 'error')
  }
  saving.value = false
}

async function setDefaultModel(modelId) {
  await updateConfig(cfg => {
    if (!cfg.agents) cfg.agents = {}
    if (!cfg.agents.defaults) cfg.agents.defaults = {}
    if (!cfg.agents.defaults.model) cfg.agents.defaults.model = {}
    cfg.agents.defaults.model.primary = modelId
  })
  defaultModel.value = modelId
}

async function setFallbackModel(modelId) {
  await updateConfig(cfg => {
    if (!cfg.agents) cfg.agents = {}
    if (!cfg.agents.defaults) cfg.agents.defaults = {}
    if (!cfg.agents.defaults.model) cfg.agents.defaults.model = {}
    cfg.agents.defaults.model.fallbacks = [modelId]
  })
  fallbackModel.value = modelId
}

async function setThinkingLevel(level) {
  await updateConfig(cfg => {
    if (!cfg.agents) cfg.agents = {}
    if (!cfg.agents.defaults) cfg.agents.defaults = {}
    cfg.agents.defaults.thinking = level
  })
  thinkingLevel.value = level
}

async function addProvider() {
  if (!newProvider.value.id) { showToast('请输入提供商 ID', 'error'); return }
  await updateConfig(cfg => {
    if (!cfg.models) cfg.models = {}
    if (!cfg.models.providers) cfg.models.providers = {}
    cfg.models.providers[newProvider.value.id] = {
      api: newProvider.value.api,
      baseUrl: newProvider.value.baseUrl,
      apiKey: newProvider.value.apiKey,
      models: newProvider.value.models
    }
  })
  showAddModal.value = false
  newProvider.value = { id: '', api: 'openai-completions', baseUrl: '', apiKey: '', models: [] }
}

async function deleteProvider(id) {
  const ok = await showConfirm(`确定删除提供商 ${id}？`)
  if (!ok) return
  await updateConfig(cfg => {
    if (cfg.models?.providers?.[id]) delete cfg.models.providers[id]
  })
}

function toggleProvider(id) {
  if (expandedProviders.value.has(id)) {
    expandedProviders.value.delete(id)
    editingProvider.value = null
  } else {
    expandedProviders.value.add(id)
  }
}

function startEditProvider(p) {
  editingProvider.value = p.id
  editForm.value = { baseUrl: p.baseUrl || '', apiKey: p.apiKey || '' }
}

function cancelEdit() {
  editingProvider.value = null
}

async function saveEditProvider(id) {
  await updateConfig(cfg => {
    if (cfg.models?.providers?.[id]) {
      cfg.models.providers[id].baseUrl = editForm.value.baseUrl
      cfg.models.providers[id].apiKey = editForm.value.apiKey
    }
  })
  editingProvider.value = null
}

function expandAll() { providers.value.forEach(p => expandedProviders.value.add(p.id)) }
function collapseAll() { expandedProviders.value.clear() }
</script>

<template>
  <div class="space-y-6">
    <!-- Toast -->
    <div v-if="toast.show" class="fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium"
      :class="toast.type === 'error' ? 'bg-red-500 text-white' : toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'">
      {{ toast.msg }}
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

    <!-- 添加提供商弹窗 -->
    <div v-if="showAddModal" class="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
      <div class="bg-white rounded-xl p-6 w-full max-w-md mx-4">
        <h3 class="text-lg font-bold mb-4">添加模型提供商</h3>
        <div class="space-y-3">
          <div>
            <label class="text-xs text-gray-500">提供商 ID</label>
            <input v-model="newProvider.id" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="openai">
          </div>
          <div>
            <label class="text-xs text-gray-500">API 类型</label>
            <input v-model="newProvider.api" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="openai-completions">
          </div>
          <div>
            <label class="text-xs text-gray-500">Base URL</label>
            <input v-model="newProvider.baseUrl" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="https://api.openai.com/v1">
          </div>
          <div>
            <label class="text-xs text-gray-500">API Key</label>
            <input v-model="newProvider.apiKey" type="password" class="w-full border rounded-lg px-3 py-2 text-sm">
          </div>
        </div>
        <div class="flex gap-2 mt-4">
          <button @click="addProvider" :disabled="saving" class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">添加</button>
          <button @click="showAddModal = false" class="flex-1 px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">取消</button>
        </div>
      </div>
    </div>

    <!-- 未连接提示 -->
    <div v-if="!authenticated && !connecting" class="text-center py-12">
      <p class="text-4xl mb-3">🔌</p>
      <p class="text-sm text-gray-500">请先配置 Gateway Token</p>
    </div>

    <!-- 连接中 -->
    <div v-if="connecting" class="text-center py-12">
      <div class="inline-block w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      <p class="text-sm text-gray-400 mt-2">正在连接 Gateway...</p>
    </div>

    <!-- 主内容 -->
    <template v-if="authenticated">
      <!-- 标题 -->
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold text-gray-900">模型管理</h2>
          <p class="text-sm text-gray-500">管理 AI 模型提供商和默认配置</p>
        </div>
        <div class="flex items-center gap-2">
          <button @click="expandAll" class="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">全部展开</button>
          <button @click="collapseAll" class="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">全部折叠</button>
          <button @click="showAddModal = true" class="px-3 py-1.5 text-xs text-white bg-green-600 rounded-lg hover:bg-green-700">+ 添加提供商</button>
          <button @click="fetchData" class="px-3 py-1.5 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700">刷新</button>
        </div>
      </div>

      <!-- 默认模型配置 -->
      <div class="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p class="text-xs text-gray-400 mb-1">主模型</p>
            <p class="text-sm font-medium text-gray-900">{{ defaultModel || '未设置' }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-400 mb-1">备用模型</p>
            <p class="text-sm font-medium text-gray-900">{{ fallbackModel || '未设置' }}</p>
          </div>
        </div>
        <div>
          <p class="text-xs text-gray-400 mb-2">思考能力</p>
          <div class="flex flex-wrap gap-2">
            <button v-for="opt in thinkingOptions" :key="opt.value"
              @click="setThinkingLevel(opt.value)" :disabled="saving"
              class="px-3 py-1.5 rounded-lg text-xs font-medium border transition"
              :class="thinkingLevel === opt.value ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'">
              {{ opt.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- 加载中 -->
      <div v-if="loading" class="text-center py-12">
        <div class="inline-block w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>

      <!-- 提供商列表 -->
      <div v-else class="space-y-3">
        <p class="text-xs text-gray-500">共 {{ providers.length }} 个提供商</p>
        <div v-for="p in providers" :key="p.id" class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div @click="toggleProvider(p.id)" class="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50">
            <div>
              <p class="text-sm font-semibold text-gray-900">{{ p.id }}</p>
              <p class="text-xs text-gray-400 mt-0.5">{{ p.api || 'openai-completions' }} · {{ p.baseUrl || '默认' }}</p>
            </div>
            <div class="flex items-center gap-2">
              <button @click.stop="deleteProvider(p.id)" class="text-xs text-red-500 hover:text-red-700">删除</button>
              <svg class="w-4 h-4 text-gray-400 transition-transform" :class="{ 'rotate-180': expandedProviders.has(p.id) }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          <div v-if="expandedProviders.has(p.id)" class="border-t border-gray-100 p-4">
            <!-- 查看模式 -->
            <div v-if="editingProvider !== p.id" class="grid grid-cols-2 gap-3 mb-3 text-xs">
              <div><span class="text-gray-400">API Key:</span> <span class="font-mono">{{ p.apiKey ? p.apiKey.slice(0,4)+'****'+p.apiKey.slice(-4) : '未配置' }}</span></div>
              <div><span class="text-gray-400">Base URL:</span> {{ p.baseUrl || '默认' }}</div>
              <div class="col-span-2">
                <button @click.stop="startEditProvider(p)" class="text-xs text-blue-600 hover:text-blue-800">✏️ 编辑配置</button>
              </div>
            </div>
            <!-- 编辑模式 -->
            <div v-else class="space-y-3 mb-3">
              <div>
                <label class="text-xs text-gray-500">Base URL</label>
                <input v-model="editForm.baseUrl" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="https://api.openai.com/v1">
              </div>
              <div>
                <label class="text-xs text-gray-500">API Key</label>
                <input v-model="editForm.apiKey" type="password" class="w-full border rounded-lg px-3 py-2 text-sm">
              </div>
              <div class="flex gap-2">
                <button @click.stop="saveEditProvider(p.id)" :disabled="saving" class="px-3 py-1.5 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700">保存</button>
                <button @click.stop="cancelEdit" class="px-3 py-1.5 text-xs text-gray-600 border rounded-lg hover:bg-gray-50">取消</button>
              </div>
            </div>
            <div v-if="p.models?.length" class="space-y-2">
              <div v-for="m in p.models" :key="m.id" class="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <div>
                  <p class="text-sm font-medium text-gray-900">{{ m.name || m.id }}</p>
                  <p class="text-xs text-gray-400">{{ m.contextWindow ? (m.contextWindow/1000).toFixed(0)+'K' : '' }} <span v-if="m.reasoning" class="text-purple-500">推理</span></p>
                </div>
                <div class="flex gap-2">
                  <button @click.stop="setDefaultModel(p.id+'/'+m.id)" :disabled="saving" class="px-2 py-1 rounded text-xs border"
                    :class="defaultModel===p.id+'/'+m.id ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-blue-50'">
                    {{ defaultModel===p.id+'/'+m.id ? '✓ 主模型' : '设为主' }}
                  </button>
                  <button @click.stop="setFallbackModel(p.id+'/'+m.id)" :disabled="saving" class="px-2 py-1 rounded text-xs border"
                    :class="fallbackModel===p.id+'/'+m.id ? 'bg-amber-50 border-amber-200 text-amber-700' : 'border-gray-200 text-gray-600 hover:bg-amber-50'">
                    {{ fallbackModel===p.id+'/'+m.id ? '✓ 备用' : '设备用' }}
                  </button>
                </div>
              </div>
            </div>
            <p v-else class="text-sm text-gray-400">暂无模型</p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
