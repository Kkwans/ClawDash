<script setup>
import { ref, onMounted } from 'vue'
import { getToken, setToken, getDefaults, getPlugins } from '../api'

const token = ref('')
const saved = ref(false)
const defaults = ref({})
const plugins = ref([])
const loading = ref(true)

function saveToken() {
  setToken(token.value)
  saved.value = true
  setTimeout(() => { saved.value = false }, 2000)
}

async function fetchData() {
  loading.value = true
  try {
    const [d, p] = await Promise.all([getDefaults(), getPlugins()])
    defaults.value = d
    plugins.value = Array.isArray(p) ? p : []
  } catch {}
  loading.value = false
}

onMounted(() => {
  token.value = getToken()
  fetchData()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Token 配置 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 class="text-base font-semibold text-gray-800 mb-4">🔑 Gateway Token</h3>
      <p class="text-sm text-gray-500 mb-4">输入 Gateway Token 以访问 API 功能。Token 保存在本地浏览器中。</p>
      <div class="flex items-center gap-3">
        <input v-model="token" type="password" placeholder="输入 Gateway Token"
          class="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
        <button @click="saveToken"
          class="px-4 py-2 rounded-lg text-sm font-medium transition-all"
          :class="saved ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'">
          {{ saved ? '✓ 已保存' : '保存' }}
        </button>
      </div>
    </div>

    <!-- 当前配置 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 class="text-base font-semibold text-gray-800 mb-4">⚙️ 当前配置</h3>
      <div v-if="loading" class="text-center py-4 text-gray-400">加载中...</div>
      <div v-else class="space-y-3">
        <div class="flex items-center justify-between py-2 border-b border-gray-100">
          <span class="text-sm text-gray-500">默认模型</span>
          <span class="text-sm font-medium text-gray-800">{{ defaults.model?.primary || '-' }}</span>
        </div>
        <div class="flex items-center justify-between py-2 border-b border-gray-100">
          <span class="text-sm text-gray-500">图像模型</span>
          <span class="text-sm font-medium text-gray-800">{{ defaults.imageModel?.primary || '-' }}</span>
        </div>
        <div class="flex items-center justify-between py-2 border-b border-gray-100">
          <span class="text-sm text-gray-500">心跳间隔</span>
          <span class="text-sm font-medium text-gray-800">{{ defaults.heartbeat?.every || '-' }}</span>
        </div>
        <div class="flex items-center justify-between py-2 border-b border-gray-100">
          <span class="text-sm text-gray-500">沙箱模式</span>
          <span class="text-sm font-medium text-gray-800">{{ defaults.sandbox?.mode || '-' }}</span>
        </div>
        <div class="flex items-center justify-between py-2">
          <span class="text-sm text-gray-500">工作区</span>
          <span class="text-sm font-medium text-gray-800 font-mono">{{ defaults.workspace || '-' }}</span>
        </div>
      </div>
    </div>

    <!-- 插件列表 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 class="text-base font-semibold text-gray-800 mb-4">🧩 已安装插件</h3>
      <div v-if="plugins.length === 0" class="text-center py-4 text-gray-400 text-sm">暂无插件</div>
      <div v-else class="space-y-3">
        <div v-for="pl in plugins" :key="pl.id"
          class="flex items-center justify-between p-3 rounded-lg border border-gray-100">
          <div>
            <p class="text-sm font-medium text-gray-800">{{ pl.name || pl.id }}</p>
            <p class="text-xs text-gray-400">{{ pl.pkgName || pl.type || '-' }}</p>
          </div>
          <div class="flex items-center gap-2">
            <span v-if="pl.configured" class="text-xs text-green-600">已配置</span>
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
              :class="pl.status === 'enabled' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'">
              {{ pl.status === 'enabled' ? '启用' : '禁用' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 关于 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 class="text-base font-semibold text-gray-800 mb-4">ℹ️ 关于</h3>
      <div class="space-y-2 text-sm text-gray-500">
        <p>ClawDash v0.1.0 — OpenClaw 增强版控制台</p>
        <p>基于 Vue 3 + Tailwind CSS 构建</p>
        <div class="flex items-center gap-3 mt-3">
          <a href="/builtin/" target="_blank"
            class="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50">
            ⚡ 内置 Control UI
          </a>
          <a href="https://github.com/Kkwans/ClawDash" target="_blank"
            class="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50">
            GitHub
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
