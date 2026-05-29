<script setup>
import { ref } from 'vue'
import { useScrollLock } from '../composables/useScrollLock.js'
import AppButton from './AppButton.vue'

const visible = ref(false)
const message = ref('')
const title = ref('')
let resolveFn = null
const { lock: lockScroll, unlock: unlockScroll } = useScrollLock()

function confirm(msg, options = {}) {
  return new Promise((resolve) => {
    message.value = msg
    title.value = options.title || '确认操作'
    visible.value = true
    resolveFn = resolve
    lockScroll()
  })
}

function onOk() {
  visible.value = false
  unlockScroll()
  resolveFn?.(true)
}

function onCancel() {
  visible.value = false
  unlockScroll()
  resolveFn?.(false)
}

defineExpose({ confirm })
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm">
      <div v-if="visible" class="confirm-mask" @click.self="onCancel">
        <div class="confirm-content" role="alertdialog" aria-modal="true" :aria-label="title">
          <div class="confirm-header">
            <div class="confirm-icon-wrapper">
              <svg class="confirm-icon" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
                <path d="M12 8v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <circle cx="12" cy="16" r="1" fill="currentColor"/>
              </svg>
            </div>
            <h3 class="confirm-title">{{ title }}</h3>
          </div>
          <p class="confirm-message">{{ message }}</p>
          <div class="confirm-actions">
            <AppButton variant="ghost" size="sm" @click="onCancel">取消</AppButton>
            <AppButton variant="danger" size="sm" @click="onOk" autofocus>确定</AppButton>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.confirm-mask {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--overlay-bg);
  backdrop-filter: blur(4px);
  padding: var(--space-4);
}

.confirm-content {
  width: 100%;
  max-width: 380px;
  background: var(--bg-panel);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--border);
  padding: var(--space-6);
  transform-origin: center;
}

.confirm-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.confirm-icon-wrapper {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--warning-light);
  flex-shrink: 0;
}

.confirm-icon {
  width: 22px;
  height: 22px;
  color: var(--warning);
}

.confirm-title {
  margin: 0;
  font-size: var(--text-md);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  line-height: var(--leading-tight);
}

.confirm-message {
  margin: 0 0 var(--space-6);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: var(--leading-relaxed);
  padding-left: calc(40px + var(--space-3));
}

.confirm-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
}

/* 弹窗动画 */
.confirm-enter-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.confirm-leave-active {
  transition: all 0.2s ease-in;
}
.confirm-enter-from {
  opacity: 0;
}
.confirm-enter-from .confirm-content {
  transform: scale(0.92) translateY(12px);
  opacity: 0;
}
.confirm-leave-to {
  opacity: 0;
}
.confirm-leave-to .confirm-content {
  transform: scale(0.95);
  opacity: 0;
}

/* 响应式：小屏幕底部弹出 */
@media (max-width: 480px) {
  .confirm-mask {
    padding: var(--space-2);
    align-items: flex-end;
  }
  .confirm-content {
    max-width: 100%;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  }
  .confirm-message {
    padding-left: 0;
  }
}
</style>