<script setup>
import { ref, onMounted } from 'vue'

const config = ref({})
const loading = ref(true)

async function fetchConfig() {
  loading.value = true
  try {
    const r = await fetch('/api/config')
    const d = await r.json()
    config.value = d
  } catch { config.value = {} }
  loading.value = false
}

onMounted(fetchConfig)
</script>

<template>
  <div class="space-y-6">
    <!-- Gateway 配置 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 class="text-base font-semibold text-gray-800 mb-4">Gateway 配置</h3>
      <div v-if="loading" class="text-center py-8 text-gray-400">加载中...</div>
      <div v-else class="space-y-3">
        <div class="flex items-center justify-between py-3 border-b border-gray-100">
          <span class="text-sm text-gray-500">端口</span>
          <span class="text-sm font-mono font-medium text-gray-800">{{ config.gateway?.port || '-' }}</span>
        </div>
        <div class="flex items-center justify-between py-3 border-b border-gray-100">
          <span class="text-sm text-gray-500">绑定模式</span>
          <span class="text-sm font-mono font-medium text-gray-800">{{ config.gateway?.bind || '-' }}</span>
        </div>
        <div class="flex items-center justify-between py-3 border-b border-gray-100">
          <span class="text-sm text-gray-500">认证模式</span>
          <span class="text-sm font-mono font-medium text-gray-800">{{ config.gateway?.auth?.mode || '-' }}</span>
        </div>
        <div class="flex items-center justify-between py-3">
          <span class="text-sm text-gray-500">运行模式</span>
          <span class="text-sm font-mono font-medium text-gray-800">{{ config.gateway?.mode || '-' }}</span>
        </div>
      </div>
    </div>

    <!-- 模型配置 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 class="text-base font-semibold text-gray-800 mb-4">默认模型</h3>
      <div v-if="loading" class="text-center py-8 text-gray-400">加载中...</div>
      <div v-else class="space-y-3">
        <div class="flex items-center justify-between py-3 border-b border-gray-100">
          <span class="text-sm text-gray-500">主模型</span>
          <span class="text-sm font-medium text-gray-800">{{ config.agents?.defaults?.model?.primary || '-' }}</span>
        </div>
        <div class="flex items-center justify-between py-3">
          <span class="text-sm text-gray-500">备用模型</span>
          <span class="text-sm font-medium text-gray-800">{{ config.agents?.defaults?.model?.fallbacks?.join(', ') || '-' }}</span>
        </div>
      </div>
    </div>

    <!-- 高级入口 -->
    <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-6">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-base font-semibold text-gray-800">高级设置</h3>
          <p class="text-sm text-gray-500 mt-1">访问 OpenClaw 内置 Control UI，进行更详细的配置</p>
        </div>
        <a href="/builtin/" target="_blank"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          打开 →
        </a>
      </div>
    </div>
  </div>
</template>
