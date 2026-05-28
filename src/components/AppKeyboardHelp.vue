<script setup>
import { ref } from 'vue'
import AppButton from './AppButton.vue'

const visible = ref(false)

const shortcuts = [
  { group: '导航', items: [
    { keys: ['Ctrl', '1'], desc: '仪表盘' },
    { keys: ['Ctrl', '2'], desc: '模型管理' },
    { keys: ['Ctrl', '3'], desc: '渠道管理' },
    { keys: ['Ctrl', '4'], desc: 'Skill 管理' },
    { keys: ['Ctrl', '5'], desc: '定时任务' },
    { keys: ['Ctrl', '6'], desc: '日志查看' },
    { keys: ['Ctrl', '7'], desc: '系统设置' },
  ]},
  { group: '操作', items: [
    { keys: ['Ctrl', 'K'], desc: '打开命令面板' },
    { keys: ['Ctrl', 'B'], desc: '切换侧边栏' },
    { keys: ['Ctrl', ','], desc: '打开设置' },
    { keys: ['?'], desc: '显示快捷键帮助' },
  ]},
]

function open() { visible.value = true }
function close() { visible.value = false }
function toggle() { visible.value ? close() : open() }

defineExpose({ open, close, toggle })
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible" class="fixed inset-0 z-[150] flex items-center justify-center p-4" tabindex="-1" @keydown.escape="close">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="close"></div>
        <div class="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <div class="flex items-center gap-2">
              <span class="text-lg">⌨️</span>
              <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">键盘快捷键</h3>
            </div>
            <AppButton size="sm" variant="ghost" class="!text-xl" @click="close" aria-label="关闭">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </AppButton>
          </div>
          <div class="px-5 py-4 max-h-[60vh] overflow-y-auto space-y-5">
            <div v-for="section in shortcuts" :key="section.group">
              <p class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2.5">{{ section.group }}</p>
              <div class="space-y-1.5">
                <div v-for="s in section.items" :key="s.desc"
                  class="flex items-center justify-between py-1.5">
                  <span class="text-sm text-gray-700 dark:text-gray-300">{{ s.desc }}</span>
                  <div class="flex items-center gap-1">
                    <kbd v-for="(k, i) in s.keys" :key="i"
                      class="px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-md border border-gray-200 dark:border-gray-600 min-w-[28px] text-center">
                      {{ k }}
                    </kbd>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <p class="text-xs text-gray-400 dark:text-gray-500 text-center">按 <kbd class="px-1.5 py-0.5 text-xs font-mono bg-gray-200 dark:bg-gray-600 rounded">ESC</kbd> 关闭</p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>