<script setup>
defineProps({
  label: { type: String, default: '' },
  required: { type: Boolean, default: false },
  error: { type: String, default: '' },
  help: { type: String, default: '' },
  labelWidth: { type: String, default: '' }
})
</script>

<template>
  <div class="form-field" :class="{ 'form-field--error': error }">
    <label v-if="label" class="form-label" :style="labelWidth ? { width: labelWidth } : {}">
      {{ label }}
      <span v-if="required" class="form-required">*</span>
    </label>
    <div class="form-control">
      <slot />
      <p v-if="error" class="form-error">{{ error }}</p>
      <p v-else-if="help" class="form-help">{{ help }}</p>
    </div>
  </div>
</template>

<style scoped>
.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1-5);
}

.form-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  line-height: var(--leading-tight);
}

.form-required {
  color: var(--danger);
  margin-left: 2px;
}

.form-control {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.form-error {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--danger-text);
  line-height: var(--leading-normal);
}

.form-help {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  line-height: var(--leading-normal);
}
</style>
