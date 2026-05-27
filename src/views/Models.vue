<script setup>
import { ref, onMounted, watch } from 'vue'
import { gwRequest, authenticated, connecting } from '../stores/gateway.js'
import { getRawConfig, getConfigHash, getParsedConfig, updateGatewayConfig } from '../api/config-utils.js'
import AppToast from '../components/AppToast.vue'

const providers = ref([])
const loading = ref(true)
const defaultModel = ref('')
const fallbackModel = ref('')
const thinkingLevel = ref('off')
const reasoningLevel = ref('off')
const saving = ref(false)
const expandedProviders = ref(new Set())
const toastRef = ref(null)
const showAddModal = ref(false)
const newProvider = ref({ id: '', api: 'openai-completions', baseUrl: '', apiKey: '', models: [] })

function showToast(msg, type = 'info') {
  toastRef.value?.show(msg, type)
}

const thinkingOptions = [
  { value: 'off', label: '关闭', desc: '不使用思考能力' },
  { value: 'minimal', label: '极低', desc: '最简推理' },
  { value: 'low', label: '低', desc: '简单推理' },
  { value: 'medium', label: '中', desc: '标准推理' },
  { value: 'high', label: '高', desc: '深度推理' },
  { value: 'xhigh', label: '极高', desc: '超深度推理' },
  { value: 'adaptive', label: '自适应', desc: '根据复杂度自动调整' },
  { value: 'max', label: '最大', desc: '最大推理能力' },
]

const reasoningOptions = [
  { value: 'off', label: '关闭', desc: '不显示推理过程' },
  { value: 'on', label: '开启', desc: '显示推理过程' },
  { value: 'stream', label: '流式', desc: '实时流式显示推理' },
]

watch(authenticated, (val) => { if (val) fetchData() }, { immediate: true })

async function fetchData() {
  if (!authenticated.value) return
  loading.value = true
  try {
    const cfgRes = await gwRequest('config.get')
    const cfg = getParsedConfig(cfgRes)
    if (!cfg) { showToast('获取配置失败', 'error'); loading.value = false; return }
    const provs = cfg.models?.providers || {}
    providers.value = Object.entries(provs).map(([id, prov]) => ({ id, ...prov }))
    const agentDefaults = cfg.agents?.defaults || {}
    defaultModel.value = agentDefaults.model?.primary || ''
    fallbackModel.value = (agentDefaults.model?.fallbacks || [])[0] || ''
    thinkingLevel.value = agentDefaults.thinkingDefault || 'off'
    reasoningLevel.value = agentDefaults.reasoningDefault || 'off'
    if (providers.value.length > 0 && expandedProviders.value.size === 0) {
      expandedProviders.value.add(providers.value[0].id)
    }
  } catch (e) {
    showToast('加载失败: ' + e.message, 'error')
  }
  loading.value = false
}

async function saveConfig(modifier) {
  saving.value = true
  try {
    await updateGatewayConfig(gwRequest, modifier)
    showToast('设置成功', 'success')
    await fetchData()
  } catch (e) {
    showToast('设置失败: ' + e.message, 'error')
  }
  saving.value = false
}

async function setDefaultModel(modelId) {
  await saveConfig(cfg => {
    if (!cfg.agents) cfg.agents = {}
    if (!cfg.agents.defaults) cfg.agents.defaults = {}
    if (!cfg.agents.defaults.model) cfg.agents.defaults.model = {}
    cfg.agents.defaults.model.primary = modelId
  })
  defaultModel.value = modelId
}

async function setFallbackModel(modelId) {
  await saveConfig(cfg => {
    if (!cfg.agents) cfg.agents = {}
    if (!cfg.agents.defaults) cfg.agents.defaults = {}
    if (!cfg.agents.defaults.model) cfg.agents.defaults.model = {}
    cfg.agents.defaults.model.fallbacks = [modelId]
  })
  fallbackModel.value = modelId
}

async function setThinkingLevel(level) {
  await saveConfig(cfg => {
    if (!cfg.agents) cfg.agents = {}
    if (!cfg.agents.defaults) cfg.agents.defaults = {}
    cfg.agents.defaults.thinkingDefault = level
  })
  thinkingLevel.value = level
}

async function setReasoningLevel(level) {
  await saveConfig(cfg => {
    if (!cfg.agents) cfg.agents = {}
    if (!cfg.agents.defaults) cfg.agents.defaults = {}
    cfg.agents.defaults.reasoningDefault = level
  })
  reasoningLevel.value = level
}

async function addProvider() {
  if (!newProvider.value.id) { showToast('请输入提供商 ID', 'error'); return }
  await saveConfig(cfg => {
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

const showDeleteConfirm = ref(null) // 存储待删除的 provider id

function confirmDeleteProvider(id) {
  showDeleteConfirm.value = id
}

async function doDeleteProvider() {
  const id = showDeleteConfirm.value
  showDeleteConfirm.value = null
  if (!id) return
  await saveConfig(cfg => {
    if (cfg.models?.providers?.[id]) delete cfg.models.providers[id]
  })
}

function toggleProvider(id) {
  if (expandedProviders.value.has(id)) expandedProviders.value.delete(id)
  else expandedProviders.value.add(id)
}
</script>

<template>
  <div class="space-y-6">
    <!-- 共享组件 -->
    <AppToast ref="toastRef" />

    <div v-if="showDeleteConfirm" class="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
      <div class="bg-white rounded-xl p-6 w-full max-w-sm mx-4">
        <h3 class="text-lg font-bold mb-2">确认删除</h3>
        <p class="text-sm text-gray-500 mb-4">确定删除提供商 <span class="font-mono text-gray-700">{{ showDeleteConfirm }}</span>？此操作不可撤销。</p>
        <div class="flex gap-2">
          <button @click="doDeleteProvider" class="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">删除</button>
          <button @click="showDeleteConfirm = null" class="flex-1 px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">取消</button>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showAddModal" class="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm" @click.self="showAddModal = false">
          <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-slide-up">
            <div class="px-5 py-4 border-b border-gray-100">
              <h3 class="text-base font-semibold text-gray-900">添加模型提供商</h3>
              <p class="text-xs text-gray-400 mt-0.5">配置新的 AI 模型提供商</p>
            </div>
            <div class="px-5 py-4 space-y-4">
              <div>
                <label for="new-provider-id" class="block text-xs font-medium text-gray-600 mb-1.5">提供商 ID <span class="text-red-500">*</span></label>
                <input id="new-provider-id" v-model="newProvider.id" autocomplete="off"
                  class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="openai">
              </div>
              <div>
                <label for="new-provider-api" class="block text-xs font-medium text-gray-600 mb-1.5">API 类型</label>
                <select id="new-provider-api" v-model="newProvider.api"
                  class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all">
                  <option value="openai-completions">OpenAI Compatible</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google AI</option>
                </select>
              </div>
              <div>
                <label for="new-provider-url" class="block text-xs font-medium text-gray-600 mb-1.5">Base URL</label>
                <input id="new-provider-url" v-model="newProvider.baseUrl" autocomplete="off"
                  class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="https://api.openai.com/v1">
              </div>
              <div>
                <label for="new-provider-key" class="block text-xs font-medium text-gray-600 mb-1.5">API Key</label>
                <input id="new-provider-key" v-model="newProvider.apiKey" type="password" autocomplete="new-password"
                  class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="sk-...">
              </div>
            </div>
            <div class="flex gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
              <button @click="showAddModal = false" class="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-white transition-all">取消</button>
              <button @click="addProvider" :disabled="saving"
                class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-all">
                {{ saving ? '添加中...' : '添加提供商' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <div v-if="!authenticated && !connecting" class="text-center py-12">
      <p class="text-4xl mb-3">🔌</p>
      <p class="text-sm text-gray-500">请先配置 Gateway Token</p>
    </div>

    <div v-if="connecting" class="text-center py-12">
      <div class="inline-block w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      <p class="text-sm text-gray-400 mt-2">正在连接 Gateway...</p>
    </div>

    <template v-if="authenticated">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold text-gray-900">模型管理</h2>
          <p class="text-sm text-gray-500">管理 AI 模型提供商和默认配置</p>
        </div>
        <div class="flex items-center gap-2">
          <button @click="showAddModal = true" class="px-3 py-1.5 text-xs text-white bg-green-600 rounded-lg hover:bg-green-700">+ 添加提供商</button>
          <button @click="fetchData" class="px-3 py-1.5 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700">刷新</button>
        </div>
      </div>

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
          <p class="text-xs text-gray-400 mb-2">思考能力（Thinking Default）</p>
          <div class="flex flex-wrap gap-2">
            <button v-for="opt in thinkingOptions" :key="opt.value"
              @click="setThinkingLevel(opt.value)" :disabled="saving"
              class="px-3 py-1.5 rounded-lg text-xs font-medium border transition"
              :title="opt.desc"
              :class="thinkingLevel === opt.value ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'">
              {{ opt.label }}
            </button>
          </div>
        </div>
        <div>
          <p class="text-xs text-gray-400 mb-2">推理显示（Reasoning Default）</p>
          <div class="flex flex-wrap gap-2">
            <button v-for="opt in reasoningOptions" :key="opt.value"
              @click="setReasoningLevel(opt.value)" :disabled="saving"
              class="px-3 py-1.5 rounded-lg text-xs font-medium border transition"
              :title="opt.desc"
              :class="reasoningLevel === opt.value ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'">
              {{ opt.label }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="loading" class="text-center py-12">
        <div class="inline-block w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>

      <div v-else class="space-y-3">
        <p class="text-xs text-gray-500">共 {{ providers.length }} 个提供商</p>
        <div v-for="p in providers" :key="p.id" class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div @click="toggleProvider(p.id)" class="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50">
            <div>
              <p class="text-sm font-semibold text-gray-900">{{ p.id }}</p>
              <p class="text-xs text-gray-400 mt-0.5">{{ p.api || 'openai-completions' }}</p>
            </div>
            <div class="flex items-center gap-2">
              <button @click.stop="confirmDeleteProvider(p.id)" class="text-xs text-red-500 hover:text-red-700">删除</button>
              <svg class="w-4 h-4 text-gray-400 transition-transform" :class="{ 'rotate-180': expandedProviders.has(p.id) }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          <div v-if="expandedProviders.has(p.id)" class="border-t border-gray-100 p-4">
            <div class="grid grid-cols-2 gap-3 mb-3 text-xs">
              <div><span class="text-gray-400">API Key:</span> <span class="font-mono">{{ p.apiKey ? p.apiKey.slice(0,4)+'****'+p.apiKey.slice(-4) : '未配置' }}</span></div>
              <div><span class="text-gray-400">Base URL:</span> {{ p.baseUrl || '默认' }}</div>
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
