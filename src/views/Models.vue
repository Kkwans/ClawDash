<script setup>
import { ref, onMounted, computed } from 'vue'
import { gwRequest, authenticated, useGatewayEvent } from '../stores/gateway.js'

const providers = ref([])
const defaults = ref({})
const loading = ref(true)
const defaultModel = ref('')
const fallbackModel = ref('')
const thinkingLevel = ref('off')
const saving = ref(false)
const expandedProviders = ref(new Set())

const thinkingOptions = [
  { value: 'off', label: '关闭', desc: '不使用思考能力', icon: '⚪' },
  { value: 'low', label: '低', desc: '简单推理', icon: '🔵' },
  { value: 'medium', label: '中', desc: '标准推理', icon: '🟡' },
  { value: 'high', label: '高', desc: '深度推理', icon: '🟠' },
  { value: 'auto', label: '自动', desc: '由模型决定', icon: '🟢' },
]

const providerMeta = {
  openai: { icon: '🟢', label: 'OpenAI', color: 'emerald' },
  anthropic: { icon: '🟣', label: 'Anthropic', color: 'violet' },
  google: { icon: '🔵', label: 'Google', color: 'blue' },
  deepseek: { icon: '🟦', label: 'DeepSeek', color: 'sky' },
  minimax: { icon: '🟠', label: 'MiniMax', color: 'orange' },
  mimo: { icon: '🟡', label: 'MiMo', color: 'yellow' },
  qwen: { icon: '🔴', label: '通义千问', color: 'red' },
  zhipu: { icon: '🟤', label: '智谱', color: 'amber' },
  moonshot: { icon: '🌙', label: '月之暗面', color: 'indigo' },
  baichuan: { icon: '⚪', label: '百川', color: 'gray' },
  yi: { icon: '⚡', label: '零一万物', color: 'cyan' },
  ollama: { icon: '🦙', label: 'Ollama', color: 'stone' },
}

function getMeta(id) {
  const key = id.toLowerCase()
  for (const [k, v] of Object.entries(providerMeta)) {
    if (key.includes(k)) return v
  }
  return { icon: '🤖', label: id, color: 'gray' }
}

function toggleProvider(id) {
  if (expandedProviders.value.has(id)) {
    expandedProviders.value.delete(id)
  } else {
    expandedProviders.value.add(id)
  }
}

function isExpanded(id) {
  return expandedProviders.value.has(id)
}

function expandAll() {
  providers.value.forEach(p => expandedProviders.value.add(p.id))
}

function collapseAll() {
  expandedProviders.value.clear()
}

async function fetchData() {
  loading.value = true
  try {
    const [config, modelsList] = await Promise.all([
      gwRequest('config.get'),
      gwRequest('models.list')
    ])
    const cfg = config?.parsed || {}
    const provs = cfg.models?.providers || {}
    providers.value = Object.entries(provs).map(([id, prov]) => ({ id, ...prov }))
    const agentDefaults = cfg.agents?.defaults || {}
    defaults.value = agentDefaults
    defaultModel.value = agentDefaults.model?.primary || ''
    fallbackModel.value = (agentDefaults.model?.fallbacks || [])[0] || ''
    thinkingLevel.value = agentDefaults.thinking || 'off'
    // 默认展开第一个
    if (providers.value.length > 0 && expandedProviders.value.size === 0) {
      expandedProviders.value.add(providers.value[0].id)
    }
  } catch (e) {
    console.error('[Models] fetchData error:', e)
  }
  loading.value = false
}

/**
 * config.set 需要: raw (完整 JSON 字符串) + baseHash (乐观锁)
 * 流程: config.get → 修改 → config.set
 */
async function configUpdate(modifier) {
  const cfgRes = await gwRequest('config.get')
  const raw = cfgRes?.raw
  const hash = cfgRes?.hash
  if (!raw || !hash) throw new Error('无法获取当前配置')
  const cfg = JSON.parse(raw)
  modifier(cfg)
  await gwRequest('config.set', { raw: JSON.stringify(cfg), baseHash: hash })
}

async function setDefaultModel(modelId) {
  saving.value = true
  try {
    await configUpdate((cfg) => {
      if (!cfg.agents) cfg.agents = {}
      if (!cfg.agents.defaults) cfg.agents.defaults = {}
      if (!cfg.agents.defaults.model) cfg.agents.defaults.model = {}
      cfg.agents.defaults.model.primary = modelId
    })
    defaultModel.value = modelId
  } catch (e) {
    alert('设置失败: ' + e.message)
  }
  saving.value = false
}

async function setFallbackModel(modelId) {
  saving.value = true
  try {
    await configUpdate((cfg) => {
      if (!cfg.agents) cfg.agents = {}
      if (!cfg.agents.defaults) cfg.agents.defaults = {}
      if (!cfg.agents.defaults.model) cfg.agents.defaults.model = {}
      cfg.agents.defaults.model.fallbacks = [modelId]
    })
    fallbackModel.value = modelId
  } catch (e) {
    alert('设置失败: ' + e.message)
  }
  saving.value = false
}

async function setThinkingLevel(level) {
  saving.value = true
  try {
    await configUpdate((cfg) => {
      if (!cfg.agents) cfg.agents = {}
      if (!cfg.agents.defaults) cfg.agents.defaults = {}
      cfg.agents.defaults.thinking = level
    })
    thinkingLevel.value = level
  } catch (e) {
    alert('设置失败: ' + e.message)
  }
  saving.value = false
}

function formatKey(key) {
  if (!key) return '未配置'
  if (key.length <= 8) return key
  return key.slice(0, 4) + '****' + key.slice(-4)
}

onMounted(fetchData)
</script>

<template>
  <div class="space-y-6">
    <!-- 页面标题 -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-bold text-gray-900">模型管理</h2>
        <p class="text-sm text-gray-500 mt-0.5">管理 AI 模型提供商和默认配置</p>
      </div>
      <div class="flex items-center gap-2">
        <button @click="expandAll" class="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
          全部展开
        </button>
        <button @click="collapseAll" class="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
          全部折叠
        </button>
        <button @click="fetchData" class="px-3 py-1.5 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
          刷新
        </button>
      </div>
    </div>

    <!-- 默认模型配置 -->
    <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-5 space-y-5">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <!-- 主模型 -->
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-blue-500"></span>
            <h3 class="text-sm font-semibold text-gray-800">主模型</h3>
          </div>
          <p class="text-xs text-gray-500 ml-4">所有会话默认使用</p>
          <span class="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-blue-200 text-blue-700 shadow-sm ml-4 w-fit">
            {{ defaultModel || '未设置' }}
          </span>
        </div>
        <!-- 备用模型 -->
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-amber-500"></span>
            <h3 class="text-sm font-semibold text-gray-800">备用模型</h3>
          </div>
          <p class="text-xs text-gray-500 ml-4">主模型不可用时自动切换</p>
          <span class="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-amber-200 text-amber-700 shadow-sm ml-4 w-fit">
            {{ fallbackModel || '未设置' }}
          </span>
        </div>
      </div>
      <!-- 思考能力配置 -->
      <div class="border-t border-blue-100 pt-4">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-sm">🧠</span>
          <h3 class="text-sm font-semibold text-gray-800">思考能力</h3>
          <span class="text-xs text-gray-400">控制模型的推理深度</span>
        </div>
        <div class="flex flex-wrap gap-2">
          <button v-for="opt in thinkingOptions" :key="opt.value"
            @click="setThinkingLevel(opt.value)"
            :disabled="saving"
            class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border"
            :class="thinkingLevel === opt.value
              ? 'bg-white border-blue-300 text-blue-700 shadow-sm'
              : 'bg-white/50 border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-white'">
            <span>{{ opt.icon }}</span>
            <span>{{ opt.label }}</span>
            <span class="text-gray-400 hidden sm:inline">· {{ opt.desc }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="flex flex-col items-center gap-3">
        <div class="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        <span class="text-sm text-gray-400">加载中...</span>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else-if="providers.length === 0" class="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
      <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <span class="text-3xl">🤖</span>
      </div>
      <p class="text-sm font-medium text-gray-600">暂无模型配置</p>
      <p class="text-xs text-gray-400 mt-1">请先在 OpenClaw 配置文件中添加模型提供商</p>
    </div>

    <!-- 提供商列表 -->
    <div v-else class="space-y-3">
      <!-- 统计信息 -->
      <div class="flex items-center gap-4 text-xs text-gray-500">
        <span>共 {{ providers.length }} 个提供商</span>
        <span>{{ providers.reduce((s, p) => s + (p.models?.length || 0), 0) }} 个模型</span>
      </div>

      <!-- 提供商卡片 -->
      <div v-for="p in providers" :key="p.id"
        class="bg-white rounded-xl border border-gray-200 overflow-hidden transition-all duration-200 hover:border-gray-300 hover:shadow-sm"
        :class="{ 'ring-1 ring-blue-200 border-blue-200': isExpanded(p.id) }">
        
        <!-- 提供商头部（可点击展开） -->
        <div @click="toggleProvider(p.id)"
          class="flex items-center justify-between p-4 cursor-pointer select-none transition-colors"
          :class="isExpanded(p.id) ? 'bg-gray-50' : 'hover:bg-gray-50'">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              :class="`bg-${getMeta(p.id).color}-50`">
              {{ getMeta(p.id).icon }}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <p class="text-sm font-semibold text-gray-900 truncate">{{ getMeta(p.id).label }}</p>
                <span class="text-xs text-gray-400 font-mono">{{ p.id }}</span>
              </div>
              <p class="text-xs text-gray-500 truncate">
                {{ p.api || 'openai-completions' }} · {{ p.baseUrl || '默认地址' }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-3 flex-shrink-0 ml-3">
            <span class="text-xs text-gray-400">
              {{ p.models?.length || 0 }} 个模型
            </span>
            <svg class="w-4 h-4 text-gray-400 transition-transform duration-200"
              :class="{ 'rotate-180': isExpanded(p.id) }"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <!-- 展开内容：提供商详情 -->
        <div v-if="isExpanded(p.id)" class="border-t border-gray-100">
          <!-- 提供商详情 -->
          <div class="px-4 py-3 bg-gray-50/50 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p class="text-xs text-gray-400">API 类型</p>
              <p class="text-sm font-medium text-gray-700">{{ p.api || 'openai-completions' }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400">Base URL</p>
              <p class="text-sm font-medium text-gray-700 truncate" :title="p.baseUrl">{{ p.baseUrl || '默认' }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400">API Key</p>
              <p class="text-sm font-medium text-gray-700 font-mono">{{ formatKey(p.apiKey) }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400">模型数量</p>
              <p class="text-sm font-medium text-gray-700">{{ p.models?.length || 0 }} 个</p>
            </div>
          </div>

          <!-- 模型列表 -->
          <div class="p-4">
            <p class="text-xs font-medium text-gray-500 mb-3">模型列表</p>
            <div v-if="p.models?.length" class="space-y-2">
              <div v-for="m in p.models" :key="m.id"
                class="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50/50 transition-all">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <p class="text-sm font-medium text-gray-900">{{ m.name || m.id }}</p>
                    <!-- 能力标签 -->
                    <span v-if="m.input?.includes('text')" class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                      文本
                    </span>
                    <span v-if="m.input?.includes('image')" class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                      图片
                    </span>
                    <span v-if="m.reasoning" class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                      推理
                    </span>
                  </div>
                  <div class="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span v-if="m.contextWindow">上下文: {{ (m.contextWindow / 1000).toFixed(0) }}K</span>
                    <span v-if="m.maxTokens">最大输出: {{ (m.maxTokens / 1000).toFixed(0) }}K</span>
                  </div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <button
                    @click.stop="setDefaultModel(p.id + '/' + m.id)"
                    :disabled="saving"
                    class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    :class="defaultModel === p.id + '/' + m.id
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 border border-transparent'">
                    {{ defaultModel === p.id + '/' + m.id ? '✓ 主模型' : '设为主模型' }}
                  </button>
                  <button
                    @click.stop="setFallbackModel(p.id + '/' + m.id)"
                    :disabled="saving"
                    class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    :class="fallbackModel === p.id + '/' + m.id
                      ? 'bg-amber-100 text-amber-700 border border-amber-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 border border-transparent'">
                    {{ fallbackModel === p.id + '/' + m.id ? '✓ 备用' : '设为备用' }}
                  </button>
                </div>
              </div>
            </div>
            <div v-else class="text-center py-4 text-sm text-gray-400">
              该提供商下暂无模型配置
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
