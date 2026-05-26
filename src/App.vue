<script setup>
import { ref, computed, onMounted, onUnmounted, defineAsyncComponent, h } from 'vue'
import { connected, authenticated, connecting, connectionError, statusText, statusColor, connect, disconnect, token, updateToken } from './stores/gateway.js'

// 异步组件 loading/error 配置
const loadingComponent = {
  render() {
    return h('div', { class: 'flex items-center justify-center py-16' }, [
      h('div', { class: 'text-center' }, [
        h('div', { class: 'w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3' }),
        h('p', { class: 'text-sm text-gray-400' }, '加载中...')
      ])
    ])
  }
}
const errorComponent = {
  render() {
    return h('div', { class: 'flex items-center justify-center py-16' }, [
      h('div', { class: 'text-center' }, [
        h('p', { class: 'text-4xl mb-3' }, '⚠️'),
        h('p', { class: 'text-sm text-gray-500' }, '页面加载失败，请刷新重试')
      ])
    ])
  }
}

// 懒加载页面组件 - 代码分割
const asyncOptions = { loadingComponent, errorComponent, delay: 200, timeout: 10000 }
const Dashboard = defineAsyncComponent({ ...asyncOptions, loader: () => import('./views/Dashboard.vue') })
const Models = defineAsyncComponent({ ...asyncOptions, loader: () => import('./views/Models.vue') })
const Channels = defineAsyncComponent({ ...asyncOptions, loader: () => import('./views/Channels.vue') })
const Sessions = defineAsyncComponent({ ...asyncOptions, loader: () => import('./views/Sessions.vue') })
const Settings = defineAsyncComponent({ ...asyncOptions, loader: () => import('./views/Settings.vue') })
const Skills = defineAsyncComponent({ ...asyncOptions, loader: () => import('./views/Skills.vue') })
const Cron = defineAsyncComponent({ ...asyncOptions, loader: () => import('./views/Cron.vue') })
const SessionList = defineAsyncComponent({ ...asyncOptions, loader: () => import('./views/SessionList.vue') })
const Chat = defineAsyncComponent({ ...asyncOptions, loader: () => import('./views/Chat.vue') })

const currentTab = ref('dashboard')
const gatewayStatus = ref('checking')
const sidebarOpen = ref(window.innerWidth >= 768)
const isMobile = ref(window.innerWidth < 768)
const showTokenModal = ref(false)
const tokenInput = ref('')
const tokenSaved = ref(false)

function handleResize() {
  isMobile.value = window.innerWidth < 768
  if (!isMobile.value) sidebarOpen.value = true
}

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

function switchTab(id) {
  currentTab.value = id
  if (isMobile.value) sidebarOpen.value = false
}

// Token 弹窗相关
function checkToken() {
  if (!token.value) {
    showTokenModal.value = true
  }
}

function saveTokenFromModal() {
  if (tokenInput.value.trim()) {
    updateToken(tokenInput.value.trim())
    tokenSaved.value = true
    setTimeout(() => {
      showTokenModal.value = false
      tokenSaved.value = false
      // 重新连接
      connect()
    }, 1000)
  }
}

function skipToken() {
  showTokenModal.value = false
}

function goToSettings() {
  showTokenModal.value = false
  currentTab.value = 'settings'
}

const tabs = [
  { id: 'dashboard', name: '仪表盘', icon: '📊' },
  { id: 'models', name: '模型管理', icon: '🤖' },
  { id: 'channels', name: '渠道管理', icon: '📡' },
  { id: 'skills', name: 'Skill 管理', icon: '📦' },
  { id: 'cron', name: '定时任务', icon: '⏰' },
  { id: 'sessionlist', name: '会话管理', icon: '💬' },
  { id: 'chat', name: '聊天', icon: '🗨️' },
  { id: 'logs', name: '日志查看', icon: '📋' },
  { id: 'settings', name: '系统设置', icon: '⚙️' },
]

const currentComponent = computed(() => {
  const map = { dashboard: Dashboard, models: Models, channels: Channels, skills: Skills, cron: Cron, sessionlist: SessionList, chat: Chat, logs: Sessions, settings: Settings }
  return map[currentTab.value] || Dashboard
})

let healthTimer
onMounted(() => {
  checkToken()
  connect()
  window.addEventListener('resize', handleResize)
})
onUnmounted(() => {
  disconnect()
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <div class="flex h-screen bg-gray-50">
    <!-- Token 配置弹窗 -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showTokenModal" class="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div class="text-center">
              <div class="w-16 h-16 mx-auto bg-blue-50 rounded-full flex items-center justify-center text-3xl mb-4">🔑</div>
              <h3 class="text-lg font-bold text-gray-900">配置 Gateway Token</h3>
              <p class="text-sm text-gray-500 mt-2">
                需要输入 Gateway Token 才能访问 API 功能。Token 可以在 OpenClaw 配置中获取。
              </p>
            </div>

            <div class="space-y-3">
              <input v-model="tokenInput" type="password" placeholder="输入 Gateway Token"
                class="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                @keyup.enter="saveTokenFromModal">

              <button @click="saveTokenFromModal" :disabled="!tokenInput.trim()"
                class="w-full py-3 rounded-xl text-sm font-medium transition-all"
                :class="tokenSaved
                  ? 'bg-green-500 text-white'
                  : tokenInput.trim()
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'">
                {{ tokenSaved ? '✓ 已保存' : '保存并继续' }}
              </button>
            </div>

            <div class="flex items-center justify-center gap-4 text-xs">
              <button @click="skipToken" class="text-gray-400 hover:text-gray-600">暂时跳过</button>
              <span class="text-gray-300">|</span>
              <button @click="goToSettings" class="text-blue-500 hover:text-blue-600">前往系统设置</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 移动端遮罩 -->
    <Transition name="fade">
      <div v-if="isMobile && sidebarOpen" class="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" @click="sidebarOpen = false"></div>
    </Transition>

    <!-- 侧边栏 -->
    <aside class="bg-white border-r border-gray-200 flex flex-col flex-shrink-0 z-50 transition-transform duration-300 ease-in-out"
      :class="isMobile
        ? (sidebarOpen ? 'fixed inset-y-0 left-0 w-72 shadow-2xl' : 'fixed inset-y-0 left-0 w-72 -translate-x-full')
        : 'w-60'">
      <!-- Logo -->
      <div class="p-5 border-b border-gray-200">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="text-2xl">🦞</span>
            <div>
              <h1 class="text-lg font-bold text-gray-900">ClawDash</h1>
              <p class="text-xs text-gray-400">OpenClaw 控制台</p>
            </div>
          </div>
          <button v-if="isMobile" @click="sidebarOpen = false" class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      <!-- 导航 -->
      <nav class="flex-1 p-3 space-y-1">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="switchTab(tab.id)"
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
          <span class="text-gray-400">网关状态</span>
          <span class="flex items-center gap-1.5"
            :class="authenticated ? 'text-green-600' : connecting ? 'text-yellow-600' : 'text-red-500'">
            <span class="w-2 h-2 rounded-full"
              :class="authenticated ? 'bg-green-500' : connecting ? 'bg-yellow-500' : 'bg-red-500'"></span>
            {{ statusText }}
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
      <header class="bg-white border-b border-gray-200 px-4 md:px-6 h-14 flex items-center justify-between sticky top-0 z-10">
        <div class="flex items-center gap-3">
          <button v-if="isMobile" @click="toggleSidebar" class="text-gray-600 hover:text-gray-800">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h2 class="text-base font-semibold text-gray-800">
            {{ tabs.find(t => t.id === currentTab)?.name }}
          </h2>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xs text-gray-400">ClawDash v0.6.0</span>
          <a href="https://github.com/Kkwans/ClawDash" target="_blank"
            class="text-gray-400 hover:text-gray-600 transition-colors">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>
        </div>
      </header>

      <div class="p-4 md:p-6">
        <component :is="currentComponent" />
      </div>
    </main>
  </div>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
