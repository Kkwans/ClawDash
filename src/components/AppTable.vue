<script setup>
defineProps({
  striped: { type: Boolean, default: false },
  hoverable: { type: Boolean, default: true },
  compact: { type: Boolean, default: false }
})
</script>

<template>
  <div class="table-wrapper">
    <table class="app-table" :class="{ 'app-table--striped': striped, 'app-table--compact': compact }">
      <slot />
    </table>
  </div>
</template>

<style scoped>
.table-wrapper {
  width: 100%;
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-panel);
}

.app-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
}

.app-table :deep(th) {
  text-align: left;
  padding: var(--space-3) var(--space-4);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  background: var(--bg-subtle);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.app-table :deep(td) {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border);
  color: var(--text-primary);
  vertical-align: middle;
}

.app-table :deep(tr:last-child td) {
  border-bottom: none;
}

/* Hoverable */
.app-table :deep(tbody tr) {
  transition: background var(--duration) var(--ease);
}
.app-table--striped :deep(tbody tr:nth-child(even)) {
  background: var(--bg-subtle);
}
.app-table :deep(tbody tr:hover) {
  background: var(--bg-hover);
}

/* Compact */
.app-table--compact :deep(th),
.app-table--compact :deep(td) {
  padding: var(--space-2) var(--space-3);
}
</style>
