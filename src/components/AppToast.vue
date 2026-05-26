<script setup>
import { ref } from 'vue'

const message = ref('')
const type = ref('info')
let timer = null

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
  message.value = msg
  type.value = options.type || 'info'
  const duration = options.duration || 3000
  clearTimeout(timer)
  timer = setTimeout(() => { message.value = '' }, duration)
}

function close() {
  clearTimeout(timer)
  message.value = ''
}

defineExpose({ show, close })
</script>

<template>
  <Transition name="toast">
    <div v-if="message"
      class="toast-root"
      :class="[`toast-${type}`]"
      role="alert"
      aria-live="polite"
    >
      <span class="toast-icon" aria-hidden="true">{{ icons[type] }}</span>
      <span class="toast-message">{{ message }}</span>
      <button class="toast-close" @click="close" aria-label="关闭提示">✕</button>
    </div>
  </Transition>
</template>

<style scoped>
.toast-root {
  position: fixed;
  top: var(--space-4);
  right: var(--space-4);
  z-index: var(--z-toast);
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
  max-width: 360px;
  min-width: 200px;
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
</style>
