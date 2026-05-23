<script setup>
import { ref, onMounted } from 'vue'

const models = ref([])
const loading = ref(true)

async function fetchModels() {
  loading.value = true
  try {
    const r = await fetch('/api/models')
    const d = await r.json()
    models.value = Array.isArray(d) ? d : (d.models || d.data || [])
  } catch { models.value = [] }
  loading.value = false
}

onMounted(fetchModels)
</script>

<template>
  <div class="space-y-6">
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-semibold text-gray-800">已配置模型</h3>
        <button @click="fetchModels" class="text-sm text-blue-600 hover:text-blue-700">刷新</button>
      </div>

      <div v-if="loading" class="text-center py-8 text-gray-400">加载中...</div>
      <div v-else-if="models.length === 0" class="text-center py-8 text-gray-400">暂无模型配置</div>
      <div v-else class="space-y-3">
        <div v-for="m in models" :key="m.id || m.name"
          class="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-lg">🤖</div>
            <div>
              <p class="text-sm font-semibold text-gray-800">{{ m.name || m.id }}</p>
              <p class="text-xs text-gray-400">{{ m.provider || m.baseUrl || '-' }}</p>
            </div>
          </div>
          <div class="text-right">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
              :class="m.enabled !== false ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'">
              {{ m.enabled !== false ? '可用' : '禁用' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
