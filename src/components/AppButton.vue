<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  variant: {
    type: String,
    default: 'default',
    validator: (v) => ['default', 'primary', 'danger', 'ghost', 'link'].includes(v)
  },
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg'].includes(v)
  },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  block: { type: Boolean, default: false },
  // 新增：提交结果状态
  status: {
    type: String,
    default: '',
    validator: (v) => ['', 'success', 'error'].includes(v)
  },
  // 新增：状态自动重置时间（ms），0 表示不自动重置
  statusDuration: { type: Number, default: 2000 }
})

const emit = defineEmits(['click'])

const showStatus = ref('')

// status 变化时显示动画，自动恢复
watch(() => props.status, (val) => {
  if (val) {
    showStatus.value = val
    if (props.statusDuration > 0) {
      setTimeout(() => { showStatus.value = '' }, props.statusDuration)
    }
  } else {
    showStatus.value = ''
  }
})
</script>

<template>
  <button
    class="app-btn"
    :class="[
      `app-btn--${variant}`,
      `app-btn--${size}`,
      {
        'app-btn--block': block,
        'app-btn--loading': loading,
        'app-btn--success': showStatus === 'success',
        'app-btn--error': showStatus === 'error'
      }
    ]"
    :disabled="disabled || loading"
    @click="$emit('click', $event)"
  >
    <Transition name="btn-icon" mode="out-in">
      <span v-if="loading" key="loading" class="app-btn-spinner" />
      <span v-else-if="showStatus === 'success'" key="success" class="app-btn-status-icon app-btn-status-icon--success">
        <svg viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
      <span v-else-if="showStatus === 'error'" key="error" class="app-btn-status-icon app-btn-status-icon--error">
        <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </span>
    </Transition>
    <slot />
  </button>
</template>

<style scoped>
.app-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid var(--border);
  background: var(--bg-panel);
  color: var(--text-primary);
  font-weight: var(--font-medium);
  cursor: pointer;
  white-space: nowrap;
  border-radius: var(--radius);
  transition: all var(--duration) var(--ease);
  line-height: 1;
  font-family: inherit;
  position: relative;
  overflow: hidden;
}
.app-btn:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}
.app-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Sizes */
.app-btn--sm {
  padding: var(--space-1-5) var(--space-3);
  font-size: var(--text-xs);
  height: 28px;
}
.app-btn--md {
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  height: 34px;
}
.app-btn--lg {
  padding: var(--space-2-5) var(--space-5);
  font-size: var(--text-base);
  height: 40px;
}

/* Variants */
.app-btn--default:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}
.app-btn--default:active:not(:disabled) {
  background: var(--bg-active);
}

.app-btn--primary {
  background: var(--brand);
  border-color: var(--brand);
  color: var(--text-inverse);
}
.app-btn--primary:hover:not(:disabled) {
  background: var(--brand-dark);
  border-color: var(--brand-dark);
}

.app-btn--danger {
  background: var(--danger);
  border-color: var(--danger);
  color: var(--text-inverse);
}
.app-btn--danger:hover:not(:disabled) {
  background: var(--danger);
  border-color: var(--danger);
}

.app-btn--ghost {
  background: transparent;
  border-color: transparent;
}
.app-btn--ghost:hover:not(:disabled) {
  background: var(--bg-hover);
}

.app-btn--link {
  background: transparent;
  border-color: transparent;
  color: var(--text-link);
  padding-left: 0;
  padding-right: 0;
  height: auto;
}
.app-btn--link:hover:not(:disabled) {
  color: var(--brand);
  text-decoration: underline;
}

/* Block */
.app-btn--block {
  width: 100%;
}

/* Status states */
.app-btn--success {
  border-color: var(--success) !important;
  background: var(--success-light) !important;
  color: var(--success-text) !important;
}

.app-btn--error {
  border-color: var(--danger) !important;
  background: var(--danger-light) !important;
  color: var(--danger-text) !important;
}

/* Loading spinner */
.app-btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: var(--radius-full);
  animation: spin 0.6s linear infinite;
  flex-shrink: 0;
}

/* Status icons */
.app-btn-status-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.app-btn-status-icon svg {
  width: 14px;
  height: 14px;
}
.app-btn-status-icon--success {
  color: var(--success, #16a34a);
  animation: status-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.app-btn-status-icon--error {
  color: var(--danger);
  animation: status-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes status-pop {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}

/* Icon transition */
.btn-icon-enter-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.btn-icon-leave-active {
  transition: all 0.1s ease-in;
}
.btn-icon-enter-from {
  opacity: 0;
  transform: scale(0.6);
}
.btn-icon-leave-to {
  opacity: 0;
  transform: scale(0.6);
}

/* Active press effect */
.app-btn:active:not(:disabled) {
  transform: scale(0.97);
}
</style>
