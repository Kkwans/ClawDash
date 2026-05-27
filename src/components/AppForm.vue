<script setup>
import { ref, watch, provide } from 'vue'

const props = defineProps({
  label: { type: String, default: '' },
  required: { type: Boolean, default: false },
  error: { type: String, default: '' },
  success: { type: Boolean, default: false },
  help: { type: String, default: '' },
  labelWidth: { type: String, default: '' }
})

const focused = ref(false)
const shakeKey = ref(0)
let prevError = ''

provide('formField', { focused })

// error 出现时触发 shake 动画
watch(() => props.error, (val) => {
  if (val && !prevError) {
    shakeKey.value++
  }
  prevError = val
})
</script>

<template>
  <div
    class="form-field"
    :class="{
      'form-field--error': error,
      'form-field--success': success && !error,
      'form-field--focused': focused
    }"
  >
    <label v-if="label" class="form-label" :style="labelWidth ? { width: labelWidth } : {}">
      {{ label }}
      <span v-if="required" class="form-required">*</span>
    </label>
    <div class="form-control" :key="shakeKey" :class="{ 'form-shake': shakeKey > 0 }">
      <slot />
      <Transition name="error-slide">
        <p v-if="error" class="form-error" role="alert">
          <svg class="form-error-icon" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
            <path d="M8 4.5v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <circle cx="8" cy="11.5" r="0.75" fill="currentColor"/>
          </svg>
          {{ error }}
        </p>
      </Transition>
      <Transition name="error-slide">
        <p v-if="success && !error" class="form-success">
          <svg class="form-success-icon" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
            <path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <slot name="success-text">格式正确</slot>
        </p>
      </Transition>
      <p v-if="!error && !success && help" class="form-help">{{ help }}</p>
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
  transition: color var(--duration) var(--ease);
}

.form-field--focused .form-label {
  color: var(--brand);
}

.form-field--error .form-label {
  color: var(--danger-text);
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

/* Shake 动画 */
.form-shake {
  animation: form-shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97);
}

@keyframes form-shake {
  0%, 100% { transform: translateX(0); }
  15% { transform: translateX(-6px); }
  30% { transform: translateX(5px); }
  45% { transform: translateX(-4px); }
  60% { transform: translateX(3px); }
  75% { transform: translateX(-2px); }
}

/* 错误信息 */
.form-error {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--danger-text);
  line-height: var(--leading-normal);
  display: flex;
  align-items: flex-start;
  gap: var(--space-1);
}

.form-error-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  margin-top: 1px;
}

/* 成功信息 */
.form-success {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--success-text, #16a34a);
  line-height: var(--leading-normal);
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.form-success-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

/* 帮助文本 */
.form-help {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  line-height: var(--leading-normal);
}

/* 错误/成功信息入场动画 */
.error-slide-enter-active {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.error-slide-leave-active {
  transition: all 0.15s ease-in;
}
.error-slide-enter-from {
  opacity: 0;
  transform: translateY(-4px);
  max-height: 0;
}
.error-slide-enter-to {
  opacity: 1;
  transform: translateY(0);
  max-height: 40px;
}
.error-slide-leave-from {
  opacity: 1;
  max-height: 40px;
}
.error-slide-leave-to {
  opacity: 0;
  max-height: 0;
}
</style>
