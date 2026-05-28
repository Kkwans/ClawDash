<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const visible = ref(false)
const scrollContainer = ref(null)

function checkScroll() {
  const el = scrollContainer.value || document.documentElement
  visible.value = el.scrollTop > 300
}

function scrollToTop() {
  const el = scrollContainer.value || document.documentElement
  el.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  const el = scrollContainer.value || window
  el.addEventListener('scroll', checkScroll, { passive: true })
})

onUnmounted(() => {
  const el = scrollContainer.value || window
  el.removeEventListener('scroll', checkScroll)
})
</script>

<template>
  <Transition name="back-to-top">
    <button v-if="visible" @click="scrollToTop"
      class="back-to-top-btn"
      aria-label="回到顶部">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    </button>
  </Transition>
</template>

<style scoped>
.back-to-top-btn {
  position: fixed;
  bottom: var(--space-6);
  right: var(--space-6);
  z-index: var(--z-modal);
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  background: var(--bg-panel);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all var(--duration) var(--ease);
}
.back-to-top-btn:hover {
  color: var(--text-primary);
  box-shadow: var(--shadow-xl);
}
.back-to-top-btn:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}

.back-to-top-enter-active,
.back-to-top-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.back-to-top-enter-from,
.back-to-top-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.9);
}
</style>