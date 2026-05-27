<script setup>
import { ref, reactive } from 'vue'

const toasts = reactive([])
let nextId = 0

const icons = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ'
}

function show(msg, options = {}) {
  if (typeof options === 'string') {
    options = { type: options }
  }
  const id = nextId++
  const duration = options.duration || 3000
  const toast = {
    id,
    message: msg,
    type: options.type || 'info',
    duration,
    progress: 100,
    timer: null,
    progressTimer: null
  }

  // 进度条动画
  const startTime = Date.now()
  function updateProgress() {
    const elapsed = Date.now() - startTime
    toast.progress = Math.max(0, 100 - (elapsed / duration) * 100)
    if (toast.progress > 0) {
      toast.progressTimer = requestAnimationFrame(updateProgress)
    }
  }
  toast.progressTimer = requestAnimationFrame(updateProgress)

  // 自动关闭
  toast.timer = setTimeout(() => {
    remove(id)
  }, duration)

  toasts.push(toast)

  // 最多显示 5 条
  while (toasts.length > 5) {
    remove(toasts[0].id)
  }
}

function remove(id) {
  const idx = toasts.findIndex(t => t.id === id)
  if (idx === -1) return
  const toast = toasts[idx]
  clearTimeout(toast.timer)
  cancelAnimationFrame(toast.progressTimer)
  toasts.splice(idx, 1)
}

function close(id) {
  remove(id)
}

// 兼容旧 API
function closeAll() {
  while (toasts.length) {
    remove(toasts[0].id)
  }
}

defineExpose({ show, close, closeAll })
</script>

<template>
  <Teleport to="body">
    <div class="toast-container" aria-live="polite">
      <TransitionGroup name="toast-stack">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="toast-root"
          :class="[`toast-${toast.type}`]"
          role="alert"
        >
          <span class="toast-icon" aria-hidden="true">{{ icons[toast.type] }}</span>
          <span class="toast-message">{{ toast.message }}</span>
          <button class="toast-close" @click="close(toast.id)" aria-label="关闭提示">✕</button>
          <div class="toast-progress" :style="{ width: toast.progress + '%' }" />
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: var(--space-4);
  right: var(--space-4);
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  pointer-events: none;
  max-width: 380px;
  width: 100%;
}

.toast-root {
  display: flex;
  align-items: center;
  gap: var(--space-2-5);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  background: var(--bg-panel);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  min-width: 200px;
  pointer-events: auto;
  position: relative;
  overflow: hidden;
}

.toast-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: var(--font-bold);
  color: var(--text-inverse);
}

.toast-success .toast-icon { background: var(--success); }
.toast-error .toast-icon { background: var(--danger); }
.toast-warning .toast-icon { background: var(--warning); color: var(--text-primary); }
.toast-info .toast-icon { background: var(--info); }

.toast-success { border-color: var(--success); }
.toast-error { border-color: var(--danger); }
.toast-warning { border-color: var(--warning); }
.toast-info { border-color: var(--info); }

.toast-message {
  flex: 1;
  min-width: 0;
  word-break: break-word;
}

.toast-close {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  font-size: 11px;
  transition: all var(--duration) var(--ease);
}
.toast-close:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* 进度条 */
.toast-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  transition: width 0.05s linear;
}

.toast-success .toast-progress { background: var(--success); opacity: 0.6; }
.toast-error .toast-progress { background: var(--danger); opacity: 0.6; }
.toast-warning .toast-progress { background: var(--warning); opacity: 0.6; }
.toast-info .toast-progress { background: var(--info); opacity: 0.6; }

/* 多条 toast 堆叠动画 */
.toast-stack-enter-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-stack-leave-active {
  transition: all 0.2s ease-in;
}
.toast-stack-enter-from {
  opacity: 0;
  transform: translateX(40px) scale(0.95);
}
.toast-stack-leave-to {
  opacity: 0;
  transform: translateX(40px) scale(0.95);
}
.toast-stack-move {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
