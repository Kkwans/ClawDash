<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  language: { type: String, default: 'json' },
  readOnly: { type: Boolean, default: false },
  lineNumbers: { type: Boolean, default: true },
  placeholder: { type: String, default: '' },
  minHeight: { type: String, default: '200px' },
  maxHeight: { type: String, default: '500px' }
})

const emit = defineEmits(['update:modelValue'])

const textareaRef = ref(null)
const jsonError = ref('')

function onInput(e) {
  const val = e.target.value
  emit('update:modelValue', val)
  validateJson(val)
}

function onKeydown(e) {
  // Tab 缩进
  if (e.key === 'Tab') {
    e.preventDefault()
    const start = e.target.selectionStart
    const end = e.target.selectionEnd
    const val = e.target.value
    e.target.value = val.substring(0, start) + '  ' + val.substring(end)
    e.target.selectionStart = e.target.selectionEnd = start + 2
    emit('update:modelValue', e.target.value)
  }
}

function validateJson(val) {
  if (props.language !== 'json') { jsonError.value = ''; return }
  if (!val.trim()) { jsonError.value = ''; return }
  try {
    JSON.parse(val)
    jsonError.value = ''
  } catch (e) {
    jsonError.value = e.message
  }
}

// 初始化验证
watch(() => props.modelValue, (val) => { validateJson(val) }, { immediate: true })
</script>

<template>
  <div class="app-editor">
    <textarea
      ref="textareaRef"
      :value="modelValue"
      @input="onInput"
      @keydown="onKeydown"
      :readonly="readOnly"
      :placeholder="placeholder"
      spellcheck="false"
      autocomplete="off"
      aria-label="代码编辑器"
      class="editor-textarea"
      :style="{ minHeight, maxHeight }"
    ></textarea>
    <p v-if="jsonError" class="editor-error">⚠️ {{ jsonError }}</p>
  </div>
</template>

<style scoped>
.app-editor {
  position: relative;
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.editor-textarea {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-primary);
  background: var(--editor-bg);
  resize: vertical;
  outline: none;
  tab-size: 2;
  white-space: pre;
  overflow: auto;
}
.editor-textarea::placeholder {
  color: var(--text-tertiary);
}
.editor-textarea:focus {
  box-shadow: inset 0 0 0 2px var(--brand-lighter);
}
.editor-error {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-xs);
  color: var(--danger-text);
  background: var(--danger-light);
  border-top: 1px solid var(--danger-text);
}
</style>
