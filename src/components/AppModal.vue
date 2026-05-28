<script setup>
import { watch, nextTick, ref, onBeforeUnmount } from 'vue'
import AppButton from './AppButton.vue'

const props = defineProps({
  title: { type: String, default: '' },
  visible: { type: Boolean, default: false },
  width: { type: String, default: '440px' },
  closable: { type: Boolean, default: true },
  maskClosable: { type: Boolean, default: true }
})

const emit = defineEmits(['update:visible', 'close'])

const modalRef = ref(null)
let scrollLocked = false

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

function lockScroll() {
  if (!scrollLocked) {
    document.body.style.overflow = 'hidden'
    scrollLocked = true
  }
}

function unlockScroll() {
  if (scrollLocked) {
    document.body.style.overflow = ''
    scrollLocked = false
  }
}

// 焦点管理 + 滚动锁定
watch(() => props.visible, async (val) => {
  if (val) {
    lockScroll()
    await nextTick()
    modalRef.value?.focus()
    document.addEventListener('keydown', onKeydown)
  } else {
    unlockScroll()
    document.removeEventListener('keydown', onKeydown)
  }
})

onBeforeUnmount(() => {
  unlockScroll()
  document.removeEventListener('keydown', onKeydown)
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
            <AppButton v-if="closable" size="sm" variant="ghost" @click="close" aria-label="关闭弹窗">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </AppButton>
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

/* 响应式：小屏幕弹窗全宽 */
@media (max-width: 480px) {
  .modal-mask {
    padding: var(--space-2);
    align-items: flex-end;
  }
  .modal-content {
    max-width: 100%;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    max-height: 90vh;
    overflow-y: auto;
  }
  .modal-header {
    padding: var(--space-4) var(--space-5);
  }
  .modal-body {
    padding: var(--space-5);
  }
  .modal-footer {
    padding: var(--space-4) var(--space-5);
  }
}
</style>