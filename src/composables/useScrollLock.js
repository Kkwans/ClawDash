import { ref, watch, onBeforeUnmount } from 'vue'

/**
 * 可组合的滚动锁定
 * @param {import('vue').Ref<boolean>|undefined} trigger - 可选的触发 ref，自动同步锁定状态
 * @returns {{ locked: import('vue').Ref<boolean>, lock: () => void, unlock: () => void, toggle: () => void }}
 */
export function useScrollLock(trigger) {
  const locked = ref(false)
  let _locked = false

  function lock() {
    if (!_locked) {
      document.body.style.overflow = 'hidden'
      _locked = true
      locked.value = true
    }
  }

  function unlock() {
    if (_locked) {
      document.body.style.overflow = ''
      _locked = false
      locked.value = false
    }
  }

  function toggle() {
    _locked ? unlock() : lock()
  }

  // 如果传入了 trigger ref，自动同步
  if (trigger) {
    watch(trigger, (val) => {
      val ? lock() : unlock()
    })
  }

  // 组件卸载时自动解锁
  onBeforeUnmount(unlock)

  return { locked, lock, unlock, toggle }
}
