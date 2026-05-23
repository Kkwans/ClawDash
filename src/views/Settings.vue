<script setup>
import { ref, onMounted } from 'vue'
import { getToken, setToken, getDefaults, getPlugins, controlProcess, getProcessStatus } from '../api'

const token = ref('')
const saved = ref(false)
const defaults = ref({})
const plugins = ref([])
const loading = ref(true)
const processStatus = ref({})
const controlling = ref(null)
const toast = ref('')

function saveToken() {
  setToken(token.value)
  saved.value = true
  showToast('Token 已保存')
  setTimeout(() => { saved.value = false }, 2000)
}

function showToast(msg) {
  toast.value = msg
  setTimeout(() => toast.value = '', 3000)
}

async function fetchData() {
  loading.value = true
  try {
    const [d, p, s] = await Promise.all([
      getDefaults().catch(() => ({})),
      getPlugins().catch(() => []),
      getProcessStatus().catch(() => ({}))
    ])
    defaults.value = d
    plugins.value = Array.isArray(p) ? p : []
    processStatus.value = s
  } catch {}
  loading.value = false
}

async function handleControl(action) {
  const labels = { start: '启动', stop: '停止', restart: '重启' }
  if (action === 'stop' && !confirm('确定要停止 OpenClaw 吗？停止后将无法通过此界面恢复。')) return
  if (action === 'restart' && !confirm('确定要重启 OpenClaw 吗？')) return

  controlling.value = action
  try {
    await controlProcess(action)
    showToast(`OpenClaw ${labels[action]}成功`)
    // 等待一会儿再刷新状态
    setTimeout(async () => {
      try {
        processStatus.value = await getProcessStatus()
      } catch {}
    }, 3000)
  } catch (e) {
    showToast(`${labels[action]}失败: ${e.message}`)
  }
  controlling.value = null
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatUptime(seconds) {
  if (!seconds) return '-'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}天 ${h}小时`
  if (h > 0) return `${h}小时 ${m}分钟`
  return `${m}分钟`
}

onMounted(() => {
  token.value = getToken()
  fetchData()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Toast -->
    <Transition name="fade">
      <div v-if="toast" class="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
        {{ toast }}
      </div>
    </Transition>

    <!-- 页面标题 -->
    <div>
      <h2 class="text-lg font-bold text-gray-900">系统设置</h2>
      <p class="text-sm text-gray-500 mt-0.5">管理 Gateway 配置和系统控制</p>
    </div>

    <!-- 启停控制 -->
    <div class="bg-white rounded-xl border border-gray-200 p-6">
      <h3 class="text-base font-semibold text-gray-800 mb-4">🎛️ 进程控制</h3>
      <div class="flex flex-col sm:flex-row sm:items-center gap-4">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-2">
            <span class="w-3 h-3 rounded-full"
              :class="processStatus.state === 'running' ? 'bg-green-500' : 'bg-red-500'"></span>
            <span class="text-sm font-medium" :class="processStatus.state === 'running' ? 'text-green-700' : 'text-red-700'">
              {{ processStatus.state === 'running' ? '运行中' : processStatus.state || '未知' }}
            </span>
          </div>
          <div class="flex items-center gap-4 text-xs text-gray-500">
            <span v-if="processStatus.pid">PID: {{ processStatus.pid }}</span>
            <span v-if="processStatus.uptimeSeconds">运行: {{ formatUptime(processStatus.uptimeSeconds) }}</span>
            <span v-if="processStatus.memoryRss">内存: {{ formatBytes(processStatus.memoryRss) }}</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button @click="handleControl('restart')" :disabled="controlling"
            class="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-all">
            {{ controlling === 'restart' ? '重启中...' : '🔄 重启' }}
          </button>
          <button @click="handleControl('stop')" :disabled="controlling"
            class="px-4 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 transition-all border border-red-200">
            {{ controlling === 'stop' ? '停止中...' : '⏹ 停止' }}
          </button>
          <button @click="handleControl('start')" :disabled="controlling"
            class="px-4 py-2 rounded-lg text-sm font-medium bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-50 transition-all border border-green-200">
            {{ controlling === 'start' ? '启动中...' : '▶ 启动' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Token 配置 -->
    <div class="bg-white rounded-xl border border-gray-200 p-6">
      <h3 class="text-base font-semibold text-gray-800 mb-2">🔑 Gateway Token</h3>
      <p class="text-sm text-gray-500 mb-4">输入 Gateway Token 以访问 API 功能。Token 保存在本地浏览器中。</p>
      <div class="flex items-center gap-3">
        <input v-model="token" type="password" placeholder="输入 Gateway Token"
          class="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
        <button @click="saveToken"
          class="px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
          :class="saved ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'">
          {{ saved ? '✓ 已保存' : '保存' }}
        </button>
      </div>
    </div>

    <!-- 当前配置 -->
    <div class="bg-white rounded-xl border border-gray-200 p-6">
      <h3 class="text-base font-semibold text-gray-800 mb-4">⚙️ 当前配置</h3>
      <div v-if="loading" class="text-center py-4 text-gray-400">加载中...</div>
      <div v-else class="space-y-1">
        <div class="flex items-center justify-between py-2.5 border-b border-gray-100">
          <span class="text-sm text-gray-500">默认模型</span>
          <span class="text-sm font-medium text-gray-800 font-mono">{{ defaults.model?.primary || '-' }}</span>
        </div>
        <div class="flex items-center justify-between py-2.5 border-b border-gray-100">
          <span class="text-sm text-gray-500">备用模型</span>
          <span class="text-sm font-medium text-gray-800 font-mono">{{ defaults.model?.fallback || '-' }}</span>
        </div>
        <div class="flex items-center justify-between py-2.5 border-b border-gray-100">
          <span class="text-sm text-gray-500">图像模型</span>
          <span class="text-sm font-medium text-gray-800 font-mono">{{ defaults.imageModel?.primary || '-' }}</span>
        </div>
        <div class="flex items-center justify-between py-2.5 border-b border-gray-100">
          <span class="text-sm text-gray-500">思考能力</span>
          <span class="text-sm font-medium text-gray-800">{{ defaults.thinking || '关闭' }}</span>
        </div>
        <div class="flex items-center justify-between py-2.5 border-b border-gray-100">
          <span class="text-sm text-gray-500">心跳间隔</span>
          <span class="text-sm font-medium text-gray-800">{{ defaults.heartbeat?.every || '-' }}</span>
        </div>
        <div class="flex items-center justify-between py-2.5 border-b border-gray-100">
          <span class="text-sm text-gray-500">沙箱模式</span>
          <span class="text-sm font-medium text-gray-800">{{ defaults.sandbox?.mode || '-' }}</span>
        </div>
        <div class="flex items-center justify-between py-2.5">
          <span class="text-sm text-gray-500">工作区</span>
          <span class="text-sm font-medium text-gray-800 font-mono truncate ml-4">{{ defaults.workspace || '-' }}</span>
        </div>
      </div>
    </div>

    <!-- 已安装插件 -->
    <div class="bg-white rounded-xl border border-gray-200 p-6">
      <h3 class="text-base font-semibold text-gray-800 mb-4">🧩 已安装插件</h3>
      <div v-if="plugins.length === 0" class="text-center py-4 text-gray-400 text-sm">暂无插件</div>
      <div v-else class="space-y-2">
        <div v-for="pl in plugins" :key="pl.id"
          class="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-sm">🧩</div>
            <div>
              <p class="text-sm font-medium text-gray-800">{{ pl.name || pl.id }}</p>
              <p class="text-xs text-gray-400">{{ pl.pkgName || pl.type || '-' }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span v-if="pl.configured" class="text-xs text-green-600">✓ 已配置</span>
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
              :class="pl.status === 'enabled' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'">
              {{ pl.status === 'enabled' ? '启用' : '禁用' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 关于 -->
    <div class="bg-white rounded-xl border border-gray-200 p-6">
      <h3 class="text-base font-semibold text-gray-800 mb-4">ℹ️ 关于</h3>
      <div class="space-y-2 text-sm text-gray-500">
        <p>ClawDash v0.2.0 — OpenClaw 增强版控制台</p>
        <p>基于 Vue 3 + Tailwind CSS + Chart.js 构建</p>
        <div class="flex items-center gap-3 mt-3">
          <a href="/builtin/" target="_blank"
            class="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-all">
            ⚡ 内置 Control UI
          </a>
          <a href="https://github.com/Kkwans/ClawDash" target="_blank"
            class="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-all">
            GitHub
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
