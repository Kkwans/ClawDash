<script setup>
import { ref, watch, onMounted, nextTick } from 'vue'
import { gwRequest, authenticated, connecting } from '../stores/gateway.js'
import { getParsedConfig, updateGatewayConfig } from '../api/config-utils.js'
import { useScrollLock } from '../composables/useScrollLock.js'
import AppToast from '../components/AppToast.vue'

// 入场动画状态
const entered = ref(false)
onMounted(() => { nextTick(() => { entered.value = true }) })

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

// 弹窗状态自动锁定滚动
useScrollLock(showAddModal)
useScrollLock(showDeleteConfirm)
</script>

<template>
  <div class="space-y-5">
    <!-- 共享组件 -->
    <AppToast ref="toastRef" />

    <!-- 删除确认弹窗 -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showDeleteConfirm" class="modal-mask fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" @click.self="showDeleteConfirm = null" @keyup.escape="showDeleteConfirm = null">
          <div class="modal-content bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div class="px-5 py-4 border-b border-gray-100">
              <h3 class="text-base font-semibold text-gray-900">确认删除</h3>
            </div>
            <div class="px-5 py-4">
              <p class="text-sm text-gray-500">确定删除提供商 <span class="font-mono font-medium text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">{{ showDeleteConfirm }}</span>？此操作不可撤销。</p>
            </div>
            <div class="flex gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
              <button @click="showDeleteConfirm = null" class="btn-press flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-white transition-all">取消</button>
              <button @click="doDeleteProvider" class="btn-press flex-1 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-all">删除</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 添加提供商弹窗 -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showAddModal" class="modal-mask fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" @click.self="showAddModal = false" @keyup.escape="showAddModal = false">
          <div class="modal-content bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div class="px-5 py-4 border-b border-gray-100">
              <h3 class="text-base font-semibold text-gray-900">添加模型提供商</h3>
              <p class="text-xs text-gray-400 mt-0.5">配置新的 AI 模型提供商</p>
            </div>
            <div class="px-5 py-4 space-y-4">
              <div>
                <label for="new-provider-id" class="block text-xs font-medium text-gray-600 mb-1.5">提供商 ID <span class="text-red-500">*</span></label>
                <input id="new-provider-id" v-model="newProvider.id" autocomplete="off"
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
                <input id="new-provider-url" v-model="newProvider.baseUrl" autocomplete="off"
                  class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-mono bg-gray-50/80 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-300 transition-all placeholder:text-gray-300"
                  placeholder="https://api.openai.com/v1">
              </div>
              <div>
                <label for="new-provider-key" class="block text-xs font-medium text-gray-600 mb-1.5">API Key</label>
                <input id="new-provider-key" v-model="newProvider.apiKey" type="password" autocomplete="new-password"
                  class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-mono bg-gray-50/80 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-300 transition-all placeholder:text-gray-300"
                  placeholder="sk-...">
              </div>
            </div>
            <div class="flex gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
              <button @click="showAddModal = false" class="btn-press flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-white transition-all">取消</button>
              <button @click="addProvider" :disabled="saving"
                class="btn-press flex-1 px-4 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-medium hover:bg-indigo-600 disabled:opacity-50 transition-all">
                {{ saving ? '添加中...' : '添加提供商' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

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
      <div class="flex items-center justify-between"
        :class="entered ? 'dashboard-enter-active' : 'dashboard-enter'"
        :style="{ transitionDelay: '0ms' }">
        <div>
          <h2 class="text-lg font-bold text-gray-900 tracking-tight">模型管理</h2>
          <p class="text-sm text-gray-500 mt-0.5">管理 AI 模型提供商和默认配置</p>
        </div>
        <div class="flex items-center gap-2">
          <button @click="showAddModal = true" class="btn-press px-4 py-2 text-xs font-semibold text-white bg-green-500 rounded-xl hover:bg-green-600 shadow-sm transition-all">
            + 添加提供商
          </button>
          <button @click="fetchData" class="btn-press px-4 py-2 text-xs font-semibold text-gray-600 bg-white border border-gray-200/80 rounded-xl hover:bg-gray-50 hover:border-gray-300 shadow-sm transition-all">
            刷新
          </button>
        </div>
      </div>

      <!-- 全局配置卡片 -->
      <div class="card-accent card-hover bg-white rounded-2xl border border-gray-200/60 p-5 shadow-sm space-y-5"
        :class="entered ? 'dashboard-enter-active' : 'dashboard-enter'"
        :style="{ transitionDelay: '80ms' }">
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
            <button v-for="opt in thinkingOptions" :key="opt.value"
              @click="setThinkingLevel(opt.value)" :disabled="saving"
              class="btn-press px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
              :title="opt.desc"
              :class="thinkingLevel === opt.value
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700 ring-1 ring-indigo-200/50'
                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'">
              {{ opt.label }}
            </button>
          </div>
        </div>
        <div class="border-t border-gray-100 pt-4">
          <p class="text-xs text-gray-400 mb-2.5">推理显示（Reasoning Default）</p>
          <div class="flex flex-wrap gap-1.5">
            <button v-for="opt in reasoningOptions" :key="opt.value"
              @click="setReasoningLevel(opt.value)" :disabled="saving"
              class="btn-press px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
              :title="opt.desc"
              :class="reasoningLevel === opt.value
                ? 'bg-purple-50 border-purple-300 text-purple-700 ring-1 ring-purple-200/50'
                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'">
              {{ opt.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="text-center py-12">
        <div class="inline-block w-7 h-7 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin"></div>
        <p class="text-sm text-gray-400 mt-3">加载模型信息...</p>
      </div>

      <!-- 提供商列表 -->
      <div v-else class="space-y-3"
        :class="entered ? 'dashboard-enter-active' : 'dashboard-enter'"
        :style="{ transitionDelay: '160ms' }">
        <div class="flex items-center justify-between">
          <p class="text-xs text-gray-400 font-medium">共 {{ providers.length }} 个提供商</p>
        </div>
        <div v-for="p in providers" :key="p.id" class="card-accent card-hover bg-white rounded-2xl border border-gray-200/60 overflow-hidden shadow-sm">
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
              <button @click.stop="confirmDeleteProvider(p.id)" class="btn-press px-2.5 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all">
                删除
              </button>
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
                <!-- 模型列表 -->
                <div v-if="p.models?.length" class="space-y-2">
                  <div v-for="m in p.models" :key="m.id"
                    class="list-item flex items-center justify-between p-3.5 rounded-xl bg-gray-50/70 hover:bg-indigo-50/40 transition-all">
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <p class="text-sm font-medium text-gray-900 truncate">{{ m.name || m.id }}</p>
                        <span v-if="m.reasoning" class="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium">
                          ⚡ 推理
                        </span>
                      </div>
                      <p class="text-xs text-gray-400 mt-0.5">{{ m.contextWindow ? (m.contextWindow/1000).toFixed(0)+'K 上下文' : '' }}</p>
                    </div>
                    <div class="flex gap-1.5 ml-3 flex-shrink-0">
                      <button @click.stop="setDefaultModel(p.id+'/'+m.id)" :disabled="saving"
                        class="btn-press px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all"
                        :class="defaultModel===p.id+'/'+m.id
                          ? 'bg-blue-50 border-blue-200 text-blue-700 ring-1 ring-blue-200/50'
                          : 'border-gray-200 text-gray-500 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700'">
                        {{ defaultModel===p.id+'/'+m.id ? '✓ 主模型' : '设为主' }}
                      </button>
                      <button @click.stop="setFallbackModel(p.id+'/'+m.id)" :disabled="saving"
                        class="btn-press px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all"
                        :class="fallbackModel===p.id+'/'+m.id
                          ? 'bg-amber-50 border-amber-200 text-amber-700 ring-1 ring-amber-200/50'
                          : 'border-gray-200 text-gray-500 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700'">
                        {{ fallbackModel===p.id+'/'+m.id ? '✓ 备用' : '设备用' }}
                      </button>
                    </div>
                  </div>
                </div>
                <p v-else class="text-sm text-gray-400 text-center py-4">暂无模型</p>
              </div>
            </div>
          </Transition>
        </div>
        <!-- 空状态 -->
        <div v-if="providers.length === 0" class="text-center py-16">
          <div class="w-16 h-16 mx-auto rounded-2xl bg-gray-50 flex items-center justify-center text-3xl mb-4 ring-1 ring-gray-200/50">📦</div>
          <p class="text-sm font-medium text-gray-500">暂无模型提供商</p>
          <p class="text-xs text-gray-400 mt-1">点击上方「添加提供商」开始配置</p>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* 入场动画 */
.dashboard-enter {
  opacity: 0;
  transform: translateY(16px);
}
.dashboard-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1),
              transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

/* 卡片悬浮效果 */
.card-hover {
  transition: box-shadow 0.3s ease, transform 0.3s ease, border-color 0.3s ease;
}
.card-hover:hover {
  box-shadow: 0 8px 25px -5px rgba(0, 0, 0, 0.08), 0 4px 10px -6px rgba(0, 0, 0, 0.04);
  transform: translateY(-2px);
  border-color: rgba(99, 102, 241, 0.2);
}

/* 渐变顶部边框装饰 */
.card-accent {
  position: relative;
  overflow: hidden;
}
.card-accent::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa);
  opacity: 0;
  transition: opacity 0.3s ease;
}
.card-accent:hover::before {
  opacity: 1;
}

/* 列表项悬浮 */
.list-item {
  transition: background-color 0.2s ease, transform 0.2s ease;
}
.list-item:hover {
  transform: translateX(2px);
}

/* 按钮微交互 */
.btn-press {
  transition: all 0.15s ease;
}
.btn-press:active {
  transform: scale(0.96);
}

/* 展开/折叠动画 */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}
.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}
.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 500px;
}
</style>
