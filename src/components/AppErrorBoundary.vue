<template>
  <div v-if="hasError" class="error-boundary">
    <div class="error-boundary__icon">⚠️</div>
    <h3 class="error-boundary__title">页面出错了</h3>
    <p class="error-boundary__message">{{ errorMessage }}</p>
    <button class="error-boundary__btn" @click="retry">重试</button>
  </div>
  <slot v-else />
</template>

<script setup>
import { ref, onErrorCaptured, provide } from 'vue'
import { createLogger } from '../utils/logger.js'

const log = createLogger('ErrorBoundary')

const hasError = ref(false)
const errorMessage = ref('')
const errorInstance = ref(null)

onErrorCaptured((err, instance, info) => {
  hasError.value = true
  errorMessage.value = err?.message || '未知渲染错误'
  errorInstance.value = err
  log.error(`[ErrorBoundary] 捕获渲染错误 (${info}):`, err)
  // 阻止错误继续向上传播
  return false
})

function retry() {
  hasError.value = false
  errorMessage.value = ''
  errorInstance.value = null
}

// 提供 reset 方法给子组件
provide('errorBoundary', { reset: retry })
</script>

<style scoped>
.error-boundary {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  padding: 2rem;
  text-align: center;
}

.error-boundary__icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.error-boundary__title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
  margin: 0 0 0.5rem;
}

.error-boundary__message {
  font-size: 0.875rem;
  color: var(--text-secondary, #525252);
  margin: 0 0 1.5rem;
  max-width: 400px;
}

.error-boundary__btn {
  padding: 0.5rem 1.5rem;
  border: 1px solid var(--border, #e5e5e4);
  border-radius: var(--radius, 6px);
  background: var(--bg-panel, #fff);
  color: var(--text-primary, #1a1a1a);
  font-size: 0.875rem;
  cursor: pointer;
  transition: background var(--duration, 200ms) var(--ease, ease);
}

.error-boundary__btn:hover {
  background: var(--bg-subtle, #f5f5f4);
}
</style>
