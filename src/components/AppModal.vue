<script setup>
import { watch, nextTick, ref } from 'vue'

const props = defineProps({
  title: { type: String, default: '' },
  visible: { type: Boolean, default: false },
  width: { type: String, default: '440px' },
  closable: { type: Boolean, default: true },
  maskClosable: { type: Boolean, default: true }
})

const emit = defineEmits(['update:visible', 'close'])

const modalRef = ref(null)

function close() {
  emit('update:visible', false)
  emit('close')
}

function onMaskClick() {
  if (props.maskClosable) close()
}

function onKeydown(e) {
  if (e.key === 'Escape' && props.closable) {
    close()
  }
}

// 焦点管理：打开时聚焦弹窗，关闭时恢复
watch(() => props.visible, async (val) => {
  if (val) {
    await nextTick()
    modalRef.value?.focus()
    document.addEventListener('keydown', onKeydown)
  } else {
    document.removeEventListener('keydown', onKeydown)
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="modal-mask" @click="onMaskClick" @keydown="onKeydown">
        <div ref="modalRef" class="modal-content" :style="{ maxWidth: width }" @click.stop
          role="dialog" aria-modal="true" :aria-label="title || '弹窗'" tabindex="-1">
          <div v-if="title || closable" class="modal-header">
            <h3 v-if="title" class="modal-title">{{ title }}</h3>
            <button v-if="closable" class="modal-close" @click="close" aria-label="关闭弹窗">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-mask {
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

.modal-content {
  width: 100%;
  background: var(--bg-panel);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--border);
  overflow: hidden;
  transform-origin: center;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--border);
}

.modal-title {
  margin: 0;
  font-size: var(--text-md);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  line-height: var(--leading-tight);
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: var(--radius);
  transition: all var(--duration) var(--ease);
}
.modal-close:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.modal-body {
  padding: var(--space-6);
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--border);
  background: var(--bg-subtle);
}
</style>
