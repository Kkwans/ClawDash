<script setup>
defineProps({
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
  block: { type: Boolean, default: false }
})

defineEmits(['click'])
</script>

<template>
  <button
    class="app-btn"
    :class="[
      `app-btn--${variant}`,
      `app-btn--${size}`,
      { 'app-btn--block': block, 'app-btn--loading': loading }
    ]"
    :disabled="disabled || loading"
    @click="$emit('click', $event)"
  >
    <span v-if="loading" class="app-btn-spinner" />
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
  background: oklch(0.52 0.2 25);
  border-color: oklch(0.52 0.2 25);
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

/* Loading spinner */
.app-btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: var(--radius-full);
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
