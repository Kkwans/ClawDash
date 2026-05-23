<script setup>
import { ref, onMounted } from 'vue'

const channels = ref([])
const loading = ref(true)

async function fetchChannels() {
  loading.value = true
  try {
    const r = await fetch('/api/channels')
    const d = await r.json()
    channels.value = Array.isArray(d) ? d : (d.channels || d.data || Object.entries(d).map(([k,v]) => ({ id: k, ...v })))
  } catch { channels.value = [] }
  loading.value = false
}

const channelIcons = { feishu: '🐦', qqbot: '🐧', telegram: '✈️', discord: '🎮', wechat: '💚', whatsapp: '📱' }

onMounted(fetchChannels)
</script>

<template>
  <div class="space-y-6">
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-semibold text-gray-800">消息渠道</h3>
        <button @click="fetchChannels" class="text-sm text-blue-600 hover:text-blue-700">刷新</button>
      </div>

      <div v-if="loading" class="text-center py-8 text-gray-400">加载中...</div>
      <div v-else-if="channels.length === 0" class="text-center py-8 text-gray-400">暂无渠道配置</div>
      <div v-else class="space-y-3">
        <div v-for="ch in channels" :key="ch.id"
          class="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-lg">
              {{ channelIcons[ch.id] || '📡' }}
            </div>
            <div>
              <p class="text-sm font-semibold text-gray-800">{{ ch.name || ch.id }}</p>
              <p class="text-xs text-gray-400">{{ ch.type || ch.id }}</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
              :class="ch.enabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'">
              <span class="w-1.5 h-1.5 rounded-full" :class="ch.enabled ? 'bg-green-500' : 'bg-gray-400'"></span>
              {{ ch.enabled ? '已启用' : '已禁用' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
