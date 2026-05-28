<script setup>
import { ref, watch, onMounted, nextTick, computed } from 'vue'
import { gwRequest, authenticated, connecting } from '../stores/gateway.js'
import { getParsedConfig, updateGatewayConfig } from '../api/config-utils.js'
import { useScrollLock } from '../composables/useScrollLock.js'
import AppToast from '../components/AppToast.vue'
import AppButton from '../components/AppButton.vue'
import AppModal from '../components/AppModal.vue'
import AppBadge from '../components/AppBadge.vue'
import { useEnterAnim } from '../composables/useEnterAnim.js'

const toastRef = ref(null)
const { entered } = useEnterAnim()

const providers = ref([])
const loading = ref(true)
const defaultModel = ref('')
const fallbackModel = ref('')
const thinkingLevel = ref('off')
const reasoningLevel = ref('off')
const saving = ref(false)
const expandedProviders = ref(new Set())
const showAddModal = ref(false)
const newProvider = ref({ id: '', api: 'openai-completions', baseUrl: '', apiKey: '', models: [] })
const showPwd = ref({})
const providerFilter = ref('')

function togglePwd(k) { showPwd.value[k] = !showPwd.value[k] }
function showToast(msg, type = 'info') { toastRef.value?.show(msg, type) }

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
  expandedProviders.value.add(newProvider.value.id)
  newProvider.value = { id: '', api: 'openai-completions', baseUrl: '', apiKey: '', models: [] }
  showPwd.value = {}
}

// Provider 搜索过滤
const filteredProviders = computed(() => {
  if (!providerFilter.value) return providers.value
  const q = providerFilter.value.toLowerCase()
  return providers.value.filter(p => p.id.toLowerCase().includes(q))
})

// 每个 Provider 下的模型过滤（通过 expandModelFilters 单独管理）
const expandModelFilters = ref({})
function modelFilter(pId) { return expandModelFilters.value[pId] || '' }
function setModelFilter(pId, val) { expandModelFilters.value = { ...expandModelFilters.value, [pId]: val } }

function getFilteredModels(p) {
  const q = modelFilter(p.id).toLowerCase()
  if (!q) return p.models || []
  return (p.models || []).filter(m =>
    (m.name || m.id).toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
  )
}

const showDeleteConfirm = ref(null)
function confirmDeleteProvider(id) { showDeleteConfirm.value = id }
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

useScrollLock(showAddModal)
useScrollLock(showDeleteConfirm)
</script>

<template>
  <div class="space-y-5">
    <AppToast ref="toastRef" />

    <!-- 删除确认弹窗 -->
    <AppModal :visible="!!showDeleteConfirm" title="确认删除" width="384px"
      @close="showDeleteConfirm = null" @update:visible="val => { if (!val) showDeleteConfirm = null }">
      <p class="text-sm text-gray-500">确定删除提供商 <span class="font-mono font-medium text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">{{ showDeleteConfirm }}</span>？此操作不可撤销。</p>
      <template #footer>
        <AppButton @click="showDeleteConfirm = null">取消</AppButton>
        <AppButton variant="danger" :loading="saving" @click="doDeleteProvider">删除</AppButton>
      </template>
    </AppModal>

    <!-- 添加提供商弹窗 -->
    <AppModal v-model:visible="showAddModal" title="添加模型提供商" width="440px">
      <p class="text-xs text-gray-400 mb-4 -mt-1">配置新的 AI 模型提供商</p>
      <form autocomplete="off" @submit.prevent="addProvider">
        <!-- 隐藏虚拟输入框，吸收浏览器自动填充 -->
        <input type="text" name="username" autocomplete="username" style="display:none" aria-hidden="true">
        <input type="password" name="password" autocomplete="new-password" style="display:none" aria-hidden="true">
        <div class="space-y-4">
          <div>
            <label for="new-provider-id" class="block text-xs font-medium text-gray-600 mb-1.5">提供商 ID <span class="text-red-500">*</span></label>
            <input id="new-provider-id" v-model="newProvider.id" autocomplete="off" readonly @focus="$event.target.removeAttribute('readonly')"
              class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50/80 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-300 transition-all placeholder:text-gray-300"
              placeholder="openai">
          </div>
          <div>
            <label for="new-provider-api" class="block text-xs font-medium text-gray-600 mb-1.5">API 类型</label>
            <select id="new-provider-api" v-model="newProvider.api"
              class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50/80 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-300 transition-all">
              <option value="openai-completions">OpenAI Compatible</option>
              <option value="anthropic">Anthropic</option>
              <option value="google">Google AI</option>
            </select>
          </div>
          <div>
            <label for="new-provider-url" class="block text-xs font-medium text-gray-600 mb-1.5">Base URL</label>
            <input id="new-provider-url" v-model="newProvider.baseUrl" autocomplete="off" readonly @focus="$event.target.removeAttribute('readonly')"
              class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-mono bg-gray-50/80 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-300 transition-all placeholder:text-gray-300"
              placeholder="https://api.openai.com/v1">
          </div>
          <div>
            <label for="new-provider-key" class="block text-xs font-medium text-gray-600 mb-1.5">API Key</label>
            <div class="relative">
              <input id="new-provider-key" v-model="newProvider.apiKey"
                :type="!showPwd['new_apiKey'] ? 'password' : 'text'"
                autocomplete="new-password" readonly @focus="$event.target.removeAttribute('readonly')"
                class="w-full px-3 py-2.5 pr-9 border border-gray-200 rounded-xl text-sm font-mono bg-gray-50/80 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-300 transition-all placeholder:text-gray-300"
                placeholder="sk-...">
              <button type="button" @click="togglePwd('new_apiKey')"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">
                {{ showPwd['new_apiKey'] ? '🙈' : '👁️' }}
              </button>
            </div>
          </div>
        </div>
      </form>
      <template #footer>
        <AppButton @click="showAddModal = false">取消</AppButton>
        <AppButton variant="primary" :loading="saving" @click="addProvider">
          {{ saving ? '添加中...' : '添加提供商' }}
        </AppButton>
      </template>
    </AppModal>

    <!-- 未连接状态 -->
    <div v-if="!authenticated && !connecting" class="text-center py-16">
      <div class="w-16 h-16 mx-auto rounded-2xl bg-gray-50 flex items-center justify-center text-3xl mb-4 ring-1 ring-gray-200/50">🔌</div>
      <p class="text-sm font-medium text-gray-500">请先配置 Gateway Token</p>
      <p class="text-xs text-gray-400 mt-1">在系统设置中配置 Token 后即可管理模型</p>
    </div>

    <!-- 连接中 -->
    <div v-if="connecting" class="text-center py-16">
      <div class="inline-block w-7 h-7 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin"></div>
      <p class="text-sm text-gray-400 mt-3">正在连接 Gateway...</p>
    </div>

    <template v-if="authenticated">
      <!-- 页面标题 -->
      <div class="flex items-center justify-between enter-anim"
        :class="{ 'is-entered': entered }" style="--delay: 0ms">
        <div>
          <h2 class="text-lg font-bold text-gray-900 tracking-tight">模型管理</h2>
          <p class="text-sm text-gray-500 mt-0.5">管理 AI 模型提供商和默认配置</p>
        </div>
        <div class="flex items-center gap-2">
          <AppButton size="sm" variant="primary" @click="showAddModal = true">+ 添加提供商</AppButton>
          <AppButton size="sm" @click="fetchData">刷新</AppButton>
        </div>
      </div>

      <!-- 全局配置卡片 -->
      <div class="card-accent card-hover bg-white rounded-2xl border border-gray-200/60 p-5 shadow-sm space-y-5 enter-anim"
        :class="{ 'is-entered': entered }" style="--delay: 80ms">
        <h4 class="text-sm font-bold text-gray-800 tracking-tight">默认配置</h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="p-3.5 rounded-xl bg-gradient-to-br from-blue-50/60 to-indigo-50/30 ring-1 ring-blue-100/50">
            <p class="text-xs text-blue-500/80 font-medium mb-1">主模型</p>
            <p class="text-sm font-semibold text-gray-900 font-mono">{{ defaultModel || '未设置' }}</p>
          </div>
          <div class="p-3.5 rounded-xl bg-gradient-to-br from-amber-50/60 to-orange-50/30 ring-1 ring-amber-100/50">
            <p class="text-xs text-amber-500/80 font-medium mb-1">备用模型</p>
            <p class="text-sm font-semibold text-gray-900 font-mono">{{ fallbackModel || '未设置' }}</p>
          </div>
        </div>
        <div class="border-t border-gray-100 pt-4">
          <p class="text-xs text-gray-400 mb-2.5">思考能力（Thinking Default）</p>
          <div class="flex flex-wrap gap-1.5">
            <AppButton size="sm" :variant="thinkingLevel === opt.value ? 'primary' : 'default'"
              v-for="opt in thinkingOptions" :key="opt.value"
              @click="setThinkingLevel(opt.value)" :disabled="saving" :title="opt.desc">
              {{ opt.label }}
            </AppButton>
          </div>
        </div>
        <div class="border-t border-gray-100 pt-4">
          <p class="text-xs text-gray-400 mb-2.5">推理显示（Reasoning Default）</p>
          <div class="flex flex-wrap gap-1.5">
            <AppButton size="sm" :variant="reasoningLevel === opt.value ? 'primary' : 'default'"
              v-for="opt in reasoningOptions" :key="opt.value"
              @click="setReasoningLevel(opt.value)" :disabled="saving" :title="opt.desc">
              {{ opt.label }}
            </AppButton>
          </div>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="text-center py-12">
        <div class="inline-block w-7 h-7 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin"></div>
        <p class="text-sm text-gray-400 mt-3">加载模型信息...</p>
      </div>

      <!-- 提供商列表 -->
      <div v-else class="space-y-3 enter-anim"
        :class="{ 'is-entered': entered }" style="--delay: 160ms">
        <!-- 搜索框 -->
        <div v-if="providers.length > 0" class="relative">
          <input v-model="providerFilter"
            type="search" placeholder="搜索提供商..."
            class="w-full pl-8 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-lg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/5 focus:border-gray-400 transition-all">
          <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        </div>

        <div class="flex items-center justify-between">
          <p class="text-xs text-gray-400 font-medium">共 {{ providers.length }} 个提供商 · 已筛选 {{ filteredProviders.length }} 个</p>
        </div>

        <!-- 空状态（无任何 Provider） -->
        <div v-if="filteredProviders.length === 0 && providers.length === 0" class="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <div class="w-16 h-16 mx-auto rounded-2xl bg-gray-50 flex items-center justify-center text-3xl mb-4 ring-1 ring-gray-200/50">📦</div>
          <p class="text-sm font-medium text-gray-500">暂无模型提供商</p>
          <p class="text-xs text-gray-400 mt-1">点击上方「添加提供商」开始配置</p>
        </div>
        <!-- 无搜索结果 -->
        <div v-else-if="filteredProviders.length === 0 && providers.length > 0" class="text-center py-10 bg-white rounded-2xl border border-gray-200">
          <p class="text-sm text-gray-400">未找到匹配「{{ providerFilter }}」的提供商</p>
        </div>

        <!-- Provider 卡片列表 -->
        <div v-for="p in filteredProviders" :key="p.id" class="card-accent card-hover bg-white rounded-2xl border border-gray-200/60 overflow-hidden shadow-sm">
          <!-- 提供商头部 -->
          <div @click="toggleProvider(p.id)" class="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50/60 transition-colors">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center text-sm font-bold text-indigo-600 ring-1 ring-indigo-100/50">
                {{ p.id[0].toUpperCase() }}
              </div>
              <div>
                <p class="text-sm font-semibold text-gray-900">{{ p.id }}</p>
                <p class="text-xs text-gray-400 mt-0.5">{{ p.api || 'openai-completions' }} · {{ p.models?.length || 0 }} 个模型</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <AppButton size="sm" variant="danger" @click.stop="confirmDeleteProvider(p.id)">删除</AppButton>
              <svg class="w-4 h-4 text-gray-400 transition-transform duration-200" :class="{ 'rotate-180': expandedProviders.has(p.id) }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          <!-- 提供商详情 -->
          <Transition name="expand">
            <div v-if="expandedProviders.has(p.id)" class="border-t border-gray-100">
              <div class="p-4 space-y-3">
                <!-- API Key & Base URL -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div class="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50/80">
                    <span class="text-xs text-gray-400 flex-shrink-0">API Key</span>
                    <span class="text-xs font-mono text-gray-600 truncate">{{ p.apiKey ? p.apiKey.slice(0,4)+'****'+p.apiKey.slice(-4) : '未配置' }}</span>
                  </div>
                  <div class="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50/80">
                    <span class="text-xs text-gray-400 flex-shrink-0">Base URL</span>
                    <span class="text-xs text-gray-600 truncate">{{ p.baseUrl || '默认' }}</span>
                  </div>
                </div>
                <!-- 模型搜索 -->
                <div v-if="p.models?.length > 0" class="relative">
                  <input :value="modelFilter(p.id)" @input="setModelFilter(p.id, $event.target.value)"
                    type="search" placeholder="搜索模型..."
                    class="w-full pl-7 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900/20 focus:border-gray-300 transition-all">
                  <span class="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                </div>
                <!-- 模型列表 -->
                <div v-if="getFilteredModels(p).length" class="space-y-2">
                  <div v-for="m in getFilteredModels(p)" :key="m.id"
                    class="list-item flex items-center justify-between p-3.5 rounded-xl bg-gray-50/70 hover:bg-indigo-50/40 transition-all">
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <p class="text-sm font-medium text-gray-900 truncate">{{ m.name || m.id }}</p>
                        <AppBadge v-if="m.reasoning" type="brand" size="sm">⚡ 推理</AppBadge>
                      </div>
                      <p class="text-xs text-gray-400 mt-0.5">{{ m.contextWindow ? (m.contextWindow/1000).toFixed(0)+'K 上下文' : '' }}</p>
                    </div>
                    <div class="flex gap-1.5 ml-3 flex-shrink-0">
                      <AppButton size="sm"
                        :variant="defaultModel===p.id+'/'+m.id ? 'primary' : 'default'"
                        @click.stop="setDefaultModel(p.id+'/'+m.id)" :disabled="saving">
                        {{ defaultModel===p.id+'/'+m.id ? '✓ 主模型' : '设为主模型' }}
                      </AppButton>
                      <AppButton size="sm"
                        :variant="fallbackModel===p.id+'/'+m.id ? 'primary' : 'default'"
                        @click.stop="setFallbackModel(p.id+'/'+m.id)" :disabled="saving">
                        {{ fallbackModel===p.id+'/'+m.id ? '✓ 备用' : '设为备用' }}
                      </AppButton>
                    </div>
                  </div>
                </div>
                <p v-else-if="p.models?.length && !getFilteredModels(p).length" class="text-xs text-gray-400 text-center py-3">
                  未找到匹配「{{ modelFilter(p.id) }}」的模型
                </p>
                <p v-else class="text-sm text-gray-400 text-center py-4">暂无模型</p>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* Models 使用 shared-animations.css 中的 .enter-anim / .is-entered */
</style>