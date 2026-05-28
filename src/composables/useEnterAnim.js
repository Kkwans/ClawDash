/**
 * 入场动画 composable
 * 配合 shared-animations.css 中的 .enter-anim / .is-entered 使用
 *
 * @returns {{ entered: Ref<boolean> }}
 *
 * @example
 * <template>
 *   <div class="enter-anim" :class="{ 'is-entered': entered }" style="--delay: 0ms">
 *     内容
 *   </div>
 * </template>
 *
 * <script setup>
 * import { useEnterAnim } from '../composables/useEnterAnim.js'
 * const { entered } = useEnterAnim()
 * </script>
 */
import { ref, onMounted, nextTick } from 'vue'

export function useEnterAnim() {
  const entered = ref(false)
  onMounted(() => { nextTick(() => { entered.value = true }) })
  return { entered }
}
