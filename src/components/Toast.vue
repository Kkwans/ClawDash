<script setup>
import { ref } from 'vue'

const message = ref('')
let timer = null

function show(msg, duration = 3000) {
  message.value = msg
  clearTimeout(timer)
  timer = setTimeout(() => { message.value = '' }, duration)
}

defineExpose({ show })
</script>

<template>
  <Transition name="toast">
    <div v-if="message"
      class="fixed top-4 right-4 z-[100] bg-gray-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium max-w-sm">
      {{ message }}
    </div>
  </Transition>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(20px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
