<script setup>
import { ref, onMounted } from 'vue'

const sessions = ref([])
const loading = ref(true)

async function fetchSessions() {
  loading.value = true
  try {
    const r = await fetch('/api/sessions')
    const d = await r.json()
    sessions.value = Array.isArray(d) ? d : (d.sessions || d.data || [])
  } catch { sessions.value = [] }
  loading.value = false
}

function formatTime(ts) {
  if (!ts) return '-'
  const d = new Date(ts)
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

onMounted(fetchSessions)
</script>

<template>
  <div class="space-y-6">
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-semibold text-gray-800">活跃会话</h3>
        <button @click="fetchSessions" class="text-sm text-blue-600 hover:text-blue-700">刷新</button>
      </div>

      <div v-if="loading" class="text-center py-8 text-gray-400">加载中...</div>
      <div v-else-if="sessions.length === 0" class="text-center py-8 text-gray-400">暂无活跃会话</div>
      <table v-else class="w-full">
        <thead>
          <tr class="text-left text-xs text-gray-400 uppercase border-b border-gray-100">
            <th class="pb-3 pr-4">会话</th>
            <th class="pb-3 pr-4">渠道</th>
            <th class="pb-3 pr-4">消息数</th>
            <th class="pb-3">最后活跃</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in sessions" :key="s.id || s.sessionKey" class="border-b border-gray-50 hover:bg-gray-50">
            <td class="py-3 pr-4">
              <p class="text-sm font-medium text-gray-800">{{ s.label || s.sessionKey || s.id }}</p>
              <p class="text-xs text-gray-400">{{ s.agentId || 'main' }}</p>
            </td>
            <td class="py-3 pr-4 text-sm text-gray-600">{{ s.channel || '-' }}</td>
            <td class="py-3 pr-4 text-sm text-gray-600">{{ s.messageCount || s.messages || '-' }}</td>
            <td class="py-3 text-sm text-gray-500">{{ formatTime(s.lastActivity || s.updatedAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
