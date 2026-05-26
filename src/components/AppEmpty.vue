<template>
  <div class="app-empty">
    <div class="app-empty__icon" aria-hidden="true">{{ icon }}</div>
    <h4 class="app-empty__title">{{ title }}</h4>
    <p v-if="description" class="app-empty__desc">{{ description }}</p>
    <slot name="action" />
  </div>
</template>

<script setup>
defineProps({
  icon: { type: String, default: '📭' },
  title: { type: String, default: '暂无数据' },
  description: { type: String, default: '' }
})
</script>

<style scoped>
.app-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-10) var(--space-4);
  text-align: center;
}

.app-empty__icon {
  font-size: 2.5rem;
  margin-bottom: var(--space-3);
  opacity: 0.6;
}

.app-empty__title {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

.app-empty__desc {
  margin: var(--space-1) 0 0;
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  max-width: 280px;
}
</style>
