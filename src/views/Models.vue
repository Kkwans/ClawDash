<script setup>
import { ref, onMounted } from 'vue'
import { getProviders, getDefaults, updateDefaults } from '../api'

const providers = ref([])
const defaults = ref({})
const loading = ref(true)
const defaultModel = ref('')
const saving = ref(false)

async function fetchData() {
  loading.value = true
  try {
    const [p, d] = await Promise.all([getProviders(), getDefaults()])
    providers.value = Object.entries(p).map(([id, prov]) => ({ id, ...prov }))
    defaults.value = d
    defaultModel.value = d.model?.primary || ''
  } catch {}
  loading.value = false
}

async function setDefaultModel(modelId) {
  saving.value = true
  try {
    await updateDefaults({ model: { primary: modelId } })
    defaultModel.value = modelId
    defaults.value.model = { ...defaults.value.model, primary: modelId }
  } catch {}
  saving.value = false
}

onMounted(fetchData)
</script>

<template>
  <div class="space-y-6">
    <!-- 默认模型 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 class="text-base font-semibold text-gray-800 mb-4">默认模型</h3>
      <div class="flex items-center gap-3">
        <span class="text-sm text-gray-500">当前:</span>
        <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700">
          {{ defaultModel || '-' }}
        </span>
      </div>
    </div>

    <!-- 模型列表 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-semibold text-gray-800">已配置提供商</h3>
        <button @click="fetchData" class="text-sm text-blue-600 hover:text-blue-700">刷新</button>
      </div>

      <div v-if="loading" class="text-center py-8 text-gray-400">加载中...</div>
      <div v-else-if="providers.length === 0" class="text-center py-8 text-gray-400">暂无模型配置</div>
      <div v-else class="space-y-4">
        <div v-for="p in providers" :key="p.id"
          class="border border-gray-200 rounded-xl overflow-hidden">
          <!-- 提供商头部 -->
          <div class="flex items-center justify-between p-4 bg-gray-50">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-lg">🤖</div>
              <div>
                <p class="text-sm font-semibold text-gray-800">{{ p.id }}</p>
                <p class="text-xs text-gray-400">{{ p.api || 'openai-completions' }} · {{ p.baseUrl }}</p>
              </div>
            </div>
          </div>
          <!-- 模型列表 -->
          <div class="p-4 space-y-2">
            <div v-for="m in (p.models || [])" :key="m.id"
              class="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
              <div>
                <p class="text-sm font-medium text-gray-800">{{ m.name || m.id }}</p>
                <p class="text-xs text-gray-400">
                  上下文: {{ (m.contextWindow / 1000).toFixed(0) }}K
                  <span v-if="m.reasoning" class="ml-2 px-1.5 py-0.5 rounded text-xs bg-purple-50 text-purple-700">推理</span>
                </p>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-400">最大输出: {{ (m.maxTokens / 1000).toFixed(0) }}K</span>
                <button
                  @click="setDefaultModel(p.id + '/' + m.id)"
                  :disabled="saving"
                  class="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                  :class="defaultModel === p.id + '/' + m.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600'">
                  {{ defaultModel === p.id + '/' + m.id ? '✓ 默认' : '设为默认' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
