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
    <Transition name="dialog">
      <div v-if="visible" class="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div class="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl border border-gray-100">
          <p class="text-sm text-gray-700 mb-6 leading-relaxed">{{ message }}</p>
          <div class="flex gap-2 justify-end">
            <button @click="onCancel"
              class="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors font-medium">
              取消
            </button>
            <button @click="onOk"
              class="px-4 py-2 text-sm text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors font-medium">
              确定
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-enter-active, .dialog-leave-active {
  transition: all 0.2s ease;
}
.dialog-enter-from, .dialog-leave-to {
  opacity: 0;
}
.dialog-enter-from .bg-white,
.dialog-leave-to .bg-white {
  transform: scale(0.95);
}
</style>
