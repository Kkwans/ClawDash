<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { connected, authenticated, connecting, connectionError, statusText, statusColor, connect, disconnect, token, updateToken } from './stores/gateway.js'
import Dashboard from './views/Dashboard.vue'
import Models from './views/Models.vue'
import Channels from './views/Channels.vue'
import Sessions from './views/Sessions.vue'
import Settings from './views/Settings.vue'
import Skills from './views/Skills.vue'
import Cron from './views/Cron.vue'
import SessionList from './views/SessionList.vue'
import Chat from './views/Chat.vue'

const currentTab = ref('dashboard')
const sidebarOpen = ref(window.innerWidth >= 768)
const isMobile = ref(window.innerWidth < 768)
const showTokenModal = ref(false)
const tokenInput = ref('')
const tokenSaved = ref(false)

function handleResize() {
  isMobile.value = window.innerWidth < 768
  if (!isMobile.value) sidebarOpen.value = true
}
function toggleSidebar() { sidebarOpen.value = !sidebarOpen.value }
function switchTab(id) {
  currentTab.value = id
  if (isMobile.value) sidebarOpen.value = false
}

function checkToken() { if (!token.value) showTokenModal.value = true }
function saveTokenFromModal() {
  if (tokenInput.value.trim()) {
    updateToken(tokenInput.value.trim())
    tokenSaved.value = true
    setTimeout(() => { showTokenModal.value = false; tokenSaved.value = false; connect() }, 800)
  }
}
function skipToken() { showTokenModal.value = false }
function goToSettings() { showTokenModal.value = false; currentTab.value = 'settings' }

const tabs = [
  { id: 'dashboard', name: '仪表盘', icon: '📊' },
  { id: 'models', name: '模型管理', icon: '🤖' },
  { id: 'channels', name: '渠道管理', icon: '📡' },
  { id: 'skills', name: '技能管理', icon: '📦' },
  { id: 'cron', name: '定时任务', icon: '⏰' },
  { id: 'sessionlist', name: '会话管理', icon: '💬' },
  { id: 'chat', name: '聊天', icon: '🗨️' },
  { id: 'logs', name: '日志', icon: '📋' },
  { id: 'settings', name: '系统设置', icon: '⚙️' },
]

const currentComponent = computed(() => {
  const map = { dashboard: Dashboard, models: Models, channels: Channels, skills: Skills, cron: Cron, sessionlist: SessionList, chat: Chat, logs: Sessions, settings: Settings }
  return map[currentTab.value] || Dashboard
})

onMounted(() => { checkToken(); connect(); window.addEventListener('resize', handleResize) })
onUnmounted(() => { disconnect(); window.removeEventListener('resize', handleResize) })
</script>

<template>
  <div class="app">
    <!-- Token 配置弹窗 -->
    <Teleport to="body">
      <div v-if="showTokenModal" class="modal-overlay">
        <div class="modal" style="max-width: 380px;">
          <div class="modal-header">
            <div class="modal-title">连接 Gateway</div>
            <button class="modal-close" @click="skipToken">✕</button>
          </div>
          <div class="modal-body">
            <p class="token-desc">输入 Gateway Token 以访问控制台功能。Token 可在 OpenClaw 配置中获取。</p>
            <div class="form-group" style="margin-top: 16px;">
              <input v-model="tokenInput" type="password" class="input mono" placeholder="Gateway Token" @keyup.enter="saveTokenFromModal">
            </div>
            <button @click="saveTokenFromModal" :disabled="!tokenInput.trim()" class="btn btn-primary" style="width: 100%; margin-top: 12px; height: 36px;">
              {{ tokenSaved ? '✓ 已保存' : '保存并连接' }}
            </button>
            <div class="token-links">
              <button @click="skipToken" class="btn btn-ghost btn-sm">暂时跳过</button>
              <span class="token-sep">·</span>
              <button @click="goToSettings" class="btn btn-ghost btn-sm">前往设置</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 移动端遮罩 -->
    <div v-if="isMobile && sidebarOpen" class="sidebar-mask" @click="sidebarOpen = false"></div>

    <!-- 侧边栏 -->
    <aside class="sidebar" :class="{ open: sidebarOpen, mobile: isMobile }">
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <span class="sidebar-logo-icon">🦞</span>
          <span class="sidebar-logo-text">ClawDash</span>
        </div>
        <button v-if="isMobile" class="modal-close" @click="sidebarOpen = false">✕</button>
      </div>

      <nav class="sidebar-nav">
        <button v-for="tab in tabs" :key="tab.id"
          class="nav-item" :class="{ active: currentTab === tab.id }"
          @click="switchTab(tab.id)">
          <span class="nav-icon">{{ tab.icon }}</span>
          <span class="nav-label">{{ tab.name }}</span>
        </button>
      </nav>

      <div class="sidebar-footer">
        <div class="sidebar-status">
          <span class="status-dot" :class="authenticated ? 'on' : connecting ? 'pending' : 'off'"></span>
          <span class="status-label">{{ statusText }}</span>
        </div>
        <a href="/builtin/" target="_blank" class="btn btn-ghost btn-sm" style="width: 100%; justify-content: center;">
          ⚡ 内置控制台
        </a>
      </div>
    </aside>

    <!-- 主内容区 -->
    <main class="main">
      <header class="topbar">
        <div class="topbar-left">
          <button v-if="isMobile" class="btn btn-ghost btn-icon" @click="toggleSidebar">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor"><rect y="3" width="18" height="1.5" rx="0.75"/><rect y="8.25" width="18" height="1.5" rx="0.75"/><rect y="13.5" width="18" height="1.5" rx="0.75"/></svg>
          </button>
          <h2 class="topbar-title">{{ tabs.find(t => t.id === currentTab)?.name }}</h2>
        </div>
        <div class="topbar-right">
          <span class="topbar-version">v0.5</span>
          <a href="https://github.com/Kkwans/ClawDash" target="_blank" class="topbar-link">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
          </a>
        </div>
      </header>

      <div class="content">
        <component :is="currentComponent" />
      </div>
    </main>
  </div>
</template>

<style scoped>
/* ===== 布局 ===== */
.app {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--bg-root);
}

/* ===== 侧边栏 ===== */
.sidebar {
  width: var(--sidebar-width);
  background: var(--bg-panel);
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  z-index: 50;
  transition: transform var(--duration-slow) var(--ease);
}
.sidebar.mobile {
  position: fixed;
  inset-y: 0;
  left: 0;
  transform: translateX(-100%);
  box-shadow: var(--shadow-lg);
}
.sidebar.mobile.open {
  transform: translateX(0);
}
.sidebar-mask {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.3);
  z-index: 40;
  animation: fadeIn var(--duration) var(--ease);
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-4);
  height: var(--topbar-height);
  border-bottom: 1px solid var(--border-subtle);
}
.sidebar-logo {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.sidebar-logo-icon { font-size: 20px; }
.sidebar-logo-text {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.5px;
  color: var(--text-primary);
}

.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-2) var(--space-2);
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 450;
  color: var(--text-tertiary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease);
  width: 100%;
  text-align: left;
}
.nav-item:hover {
  background: var(--bg-subtle);
  color: var(--text-primary);
}
.nav-item.active {
  background: var(--bg-subtle);
  color: var(--text-primary);
  font-weight: 600;
}
.nav-icon { font-size: 15px; width: 20px; text-align: center; }

.sidebar-footer {
  padding: var(--space-3) var(--space-3);
  border-top: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.sidebar-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-2);
  font-size: 12px;
  color: var(--text-tertiary);
}
.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-dot.on { background: var(--green); box-shadow: 0 0 6px rgba(22,163,74,0.3); }
.status-dot.pending { background: var(--amber); animation: pulse 1.5s ease infinite; }
.status-dot.off { background: var(--red); }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

/* ===== 主内容区 ===== */
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--topbar-height);
  padding: 0 var(--space-5);
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}
.topbar-left { display: flex; align-items: center; gap: var(--space-3); }
.topbar-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.3px;
}
.topbar-right { display: flex; align-items: center; gap: var(--space-3); }
.topbar-version {
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}
.topbar-link {
  color: var(--text-muted);
  transition: color var(--duration-fast) var(--ease);
  display: flex;
}
.topbar-link:hover { color: var(--text-primary); }

.content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-5);
}

/* ===== Token 弹窗 ===== */
.token-desc {
  font-size: 13px;
  color: var(--text-tertiary);
  line-height: 1.5;
}
.token-links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  margin-top: var(--space-3);
}
.token-sep { color: var(--text-muted); font-size: 12px; }
</style>
