<script setup>
defineProps({
  type: {
    type: String,
    default: 'default',
    validator: (v) => ['default', 'success', 'warning', 'danger', 'info', 'brand'].includes(v)
  },
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg'].includes(v)
  },
  dot: { type: Boolean, default: false }
})
</script>

<template>
  <span class="app-badge" :class="[`app-badge--${type}`, `app-badge--${size}`, { 'app-badge--dot': dot }]">
    <span v-if="dot" class="app-badge-dot" />
    <slot />
  </span>
</template>

<style scoped>
.app-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-weight: var(--font-medium);
  white-space: nowrap;
  border-radius: var(--radius-full);
  line-height: 1;
}

/* Sizes */
.app-badge--sm {
  padding: 2px 6px;
  font-size: 11px;
}
.app-badge--md {
  padding: 3px 8px;
  font-size: var(--text-xs);
}
.app-badge--lg {
  padding: 4px 12px;
  font-size: var(--text-sm);
}

/* Types */
.app-badge--default {
  background: var(--bg-muted);
  color: var(--text-secondary);
}
.app-badge--success {
  background: var(--success-light);
  color: var(--success-text);
}
.app-badge--warning {
  background: var(--warning-light);
  color: var(--warning-text);
}
.app-badge--danger {
  background: var(--danger-light);
  color: var(--danger-text);
}
.app-badge--info {
  background: var(--info-light);
  color: var(--info-text);
}
.app-badge--brand {
  background: var(--brand-lighter);
  color: var(--brand-dark);
}

/* Dot */
.app-badge-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}
.app-badge--default .app-badge-dot { background: var(--text-tertiary); }
.app-badge--success .app-badge-dot { background: var(--success); }
.app-badge--warning .app-badge-dot { background: var(--warning); }
.app-badge--danger .app-badge-dot { background: var(--danger); }
.app-badge--info .app-badge-dot { background: var(--info); }
.app-badge--brand .app-badge-dot { background: var(--brand); }
</style>
