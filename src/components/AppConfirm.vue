<script setup>
import { ref } from 'vue'

const visible = ref(false)
const message = ref('')
let resolveFn = null

function confirm(msg) {
  return new Promise((resolve) => {
    message.value = msg
    visible.value = true
    resolveFn = resolve
  })
}

function onOk() {
  visible.value = false
  resolveFn?.(true)
}

function onCancel() {
  visible.value = false
  resolveFn?.(false)
}

defineExpose({ confirm })
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="confirm-mask">
        <div class="confirm-content">
          <p class="confirm-message">{{ message }}</p>
          <div class="confirm-actions">
            <button @click="onCancel" class="confirm-btn confirm-btn-cancel">取消</button>
            <button @click="onOk" class="confirm-btn confirm-btn-danger">确定</button>
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
  background: oklch(0 0 0 / 0.4);
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
}

.confirm-message {
  margin: 0 0 var(--space-6);
  font-size: var(--text-sm);
  color: var(--text-primary);
  line-height: var(--leading-relaxed);
}

.confirm-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
}

.confirm-btn {
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  cursor: pointer;
  transition: all var(--duration) var(--ease);
}

.confirm-btn-cancel {
  background: var(--bg-subtle);
  color: var(--text-secondary);
}
.confirm-btn-cancel:hover {
  background: var(--bg-hover);
}

.confirm-btn-danger {
  background: var(--danger);
  color: var(--text-inverse);
  border-color: var(--danger);
}
.confirm-btn-danger:hover {
  filter: brightness(0.9);
}
</style>
