import { onMounted, onUnmounted } from 'vue'

/**
 * 全局快捷键注册
 * @param {Object} shortcuts - { 'ctrl+k': () => {}, 'escape': () => {}, ... }
 */
export function useKeyboard(shortcuts) {
  function handler(e) {
    const parts = []
    if (e.ctrlKey || e.metaKey) parts.push('ctrl')
    if (e.shiftKey) parts.push('shift')
    if (e.altKey) parts.push('alt')

    const key = e.key.toLowerCase()
    // 忽略单独的修饰键
    if (['control', 'meta', 'shift', 'alt'].includes(key)) return

    parts.push(key)
    const combo = parts.join('+')

    if (shortcuts[combo]) {
      e.preventDefault()
      e.stopPropagation()
      shortcuts[combo](e)
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handler)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handler)
  })
}
