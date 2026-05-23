<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Dashboard from './views/Dashboard.vue'
import Models from './views/Models.vue'
import Channels from './views/Channels.vue'
import Sessions from './views/Sessions.vue'
import Settings from './views/Settings.vue'

const currentTab = ref('dashboard')
const gatewayStatus = ref('checking')
const version = ref('')
const uptime = ref('')
const sidebarOpen = ref(true)

const tabs = [
  { id: 'dashboard', name: '仪表盘', icon: '📊' },
  { id: 'models', name: '模型管理', icon: '🤖' },
  { id: 'channels', name: '渠道管理', icon: '📡' },
  { id: 'sessions', name: '会话管理', icon: '💬' },
  { id: 'settings', name: '系统设置', icon: '⚙️' },
]

const currentComponent = computed(() => {
  const map = { dashboard: Dashboard, models: Models, channels: Channels, sessions: Sessions, settings: Settings }
  return map[currentTab.value] || Dashboard
})

async function checkHealth() {
  try {
    const r = await fetch('/api/healthz')
    const d = await r.json()
    gatewayStatus.value = d.ok ? 'running' : 'error'
  } catch {
    gatewayStatus.value = 'error'
  }
}

let healthTimer
onMounted(() => {
  checkHealth()
  healthTimer = setInterval(checkHealth, 30000)
})
onUnmounted(() => clearInterval(healthTimer))
</script>

<template>
  <div class="flex h-screen bg-gray-50">
    <!-- 侧边栏 -->
    <aside class="w-60 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
      <!-- Logo -->
      <div class="p-5 border-b border-gray-200">
        <div class="flex items-center gap-3">
          <span class="text-2xl">🦞</span>
          <div>
            <h1 class="text-lg font-bold text-gray-900">ClawDash</h1>
            <p class="text-xs text-gray-400">OpenClaw 控制台</p>
          </div>
        </div>
      </div>

      <!-- 导航 -->
      <nav class="flex-1 p-3 space-y-1">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="currentTab = tab.id"
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all"
          :class="currentTab === tab.id
            ? 'bg-blue-50 text-blue-600 font-semibold'
            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'"
        >
          <span class="text-base">{{ tab.icon }}</span>
          {{ tab.name }}
        </button>
      </nav>

      <!-- 底部状态 -->
      <div class="p-4 border-t border-gray-200 space-y-3">
        <div class="flex items-center justify-between text-xs">
          <span class="text-gray-400">Gateway</span>
          <span class="flex items-center gap-1.5"
            :class="gatewayStatus === 'running' ? 'text-green-600' : 'text-red-500'">
            <span class="w-2 h-2 rounded-full"
              :class="gatewayStatus === 'running' ? 'bg-green-500' : 'bg-red-500'"></span>
            {{ gatewayStatus === 'running' ? '运行中' : gatewayStatus === 'error' ? '异常' : '检测中' }}
          </span>
        </div>
        <a href="/builtin/" target="_blank"
          class="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all">
          ⚡ 高级设置（内置 UI）
        </a>
      </div>
    </aside>

    <!-- 主内容区 -->
    <main class="flex-1 overflow-y-auto">
      <header class="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between sticky top-0 z-10">
        <h2 class="text-base font-semibold text-gray-800">
          {{ tabs.find(t => t.id === currentTab)?.name }}
        </h2>
        <div class="flex items-center gap-3">
          <span class="text-xs text-gray-400">ClawDash v0.1.0</span>
          <a href="https://github.com/Kkwans/ClawDash" target="_blank"
            class="text-gray-400 hover:text-gray-600 transition-colors">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>
        </div>
      </header>

      <div class="p-6">
        <component :is="currentComponent" />
      </div>
    </main>
  </div>
</template>
