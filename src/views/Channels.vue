<script setup>
import { ref, onMounted } from 'vue'
import { getChannels, getPlugins } from '../api'

const channels = ref([])
const plugins = ref([])
const loading = ref(true)

async function fetchData() {
  loading.value = true
  try {
    const [ch, pl] = await Promise.all([getChannels(), getPlugins()])
    channels.value = Object.entries(ch).map(([id, c]) => ({ id, ...c }))
    plugins.value = Array.isArray(pl) ? pl : []
  } catch {}
  loading.value = false
}

const channelIcons = { feishu: '🐦', qqbot: '🐧', telegram: '✈️', discord: '🎮', wechat: '💚' }

onMounted(fetchData)
</script>

<template>
  <div class="space-y-6">
    <!-- 渠道列表 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-semibold text-gray-800">消息渠道</h3>
        <button @click="fetchData" class="text-sm text-blue-600 hover:text-blue-700">刷新</button>
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
              <p class="text-sm font-semibold text-gray-800">{{ ch.id }}</p>
              <p class="text-xs text-gray-400">
                {{ ch.connectionMode || '-' }}
                <span v-if="ch.streaming" class="ml-2 text-green-500">● 流式</span>
              </p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
              :class="ch.enabled !== false ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'">
              <span class="w-1.5 h-1.5 rounded-full" :class="ch.enabled !== false ? 'bg-green-500' : 'bg-gray-400'"></span>
              {{ ch.enabled !== false ? '已启用' : '已禁用' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 插件列表 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 class="text-base font-semibold text-gray-800 mb-4">插件</h3>
      <div v-if="plugins.length === 0" class="text-center py-4 text-gray-400 text-sm">暂无插件</div>
      <div v-else class="space-y-3">
        <div v-for="pl in plugins" :key="pl.id"
          class="flex items-center justify-between p-4 rounded-lg border border-gray-200">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-lg">🧩</div>
            <div>
              <p class="text-sm font-semibold text-gray-800">{{ pl.name || pl.id }}</p>
              <p class="text-xs text-gray-400">{{ pl.pkgName || pl.type || '-' }}</p>
            </div>
          </div>
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
            :class="pl.status === 'enabled' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'">
            {{ pl.status === 'enabled' ? '已启用' : '已禁用' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
