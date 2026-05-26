<script setup>
import { ref, watch, onMounted, onUnmounted, shallowRef } from 'vue'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter } from '@codemirror/language'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { lintGutter } from '@codemirror/lint'

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

const editorRef = ref(null)
const view = shallowRef(null)

function createExtensions() {
  const extensions = [
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      ...closeBracketsKeymap
    ]),
    history(),
    bracketMatching(),
    closeBrackets(),
    foldGutter(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    highlightActiveLine(),
    oneDark,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        emit('update:modelValue', update.state.doc.toString())
      }
    }),
    EditorView.theme({
      '&': {
        fontSize: '13px',
        maxHeight: props.maxHeight
      },
      '.cm-scroller': {
        fontFamily: "'Geist Mono', 'JetBrains Mono', 'Fira Code', monospace",
        overflow: 'auto'
      },
      '.cm-content': {
        minHeight: props.minHeight
      }
    })
  ]

  if (props.lineNumbers) {
    extensions.push(lineNumbers())
    extensions.push(highlightActiveLineGutter())
  }

  if (props.language === 'json') {
    extensions.push(json())
  }

  if (props.readOnly) {
    extensions.push(EditorState.readOnly.of(true))
    extensions.push(EditorView.editable.of(false))
  }

  return extensions
}

onMounted(() => {
  if (!editorRef.value) return

  const state = EditorState.create({
    doc: props.modelValue,
    extensions: createExtensions()
  })

  view.value = new EditorView({
    state,
    parent: editorRef.value
  })
})

onUnmounted(() => {
  view.value?.destroy()
})

watch(() => props.modelValue, (newVal) => {
  if (view.value && view.value.state.doc.toString() !== newVal) {
    view.value.dispatch({
      changes: {
        from: 0,
        to: view.value.state.doc.length,
        insert: newVal
      }
    })
  }
})
</script>

<template>
  <div ref="editorRef" class="app-editor rounded-lg overflow-hidden border border-gray-200"></div>
</template>

<style scoped>
.app-editor :deep(.cm-editor) {
  min-height: v-bind(minHeight);
}
</style>
