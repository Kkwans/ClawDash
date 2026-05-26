<template>
  <div class="app-loading">
    <div class="app-loading__spinner" aria-hidden="true"></div>
    <p v-if="text" class="app-loading__text">{{ text }}</p>
  </div>
</template>

<script setup>
defineProps({
  text: { type: String, default: '加载中...' }
})
</script>

<style scoped>
.app-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-10) var(--space-4);
}

.app-loading__spinner {
  width: 28px;
  height: 28px;
  border: 2px solid var(--border);
  border-top-color: var(--brand);
  border-radius: var(--radius-full);
  animation: spin 0.6s linear infinite;
}

.app-loading__text {
  margin: var(--space-3) 0 0;
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
