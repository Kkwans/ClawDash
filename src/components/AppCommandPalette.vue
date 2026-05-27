<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'

const props = defineProps({
  tabs: { type: Array, default: () => [] },
  currentTab: { type: String, default: '' },
})

const emit = defineEmits(['navigate', 'action'])

const visible = ref(false)
const query = ref('')
const inputRef = ref(null)
const selectedIndex = ref(0)

// 内置命令
const builtInCommands = [
  { id: 'refresh', label: '刷新当前页面', icon: '🔄', category: '操作', keywords: ['refresh', 'reload', '刷新', '重新加载'] },
  { id: 'toggle-sidebar', label: '切换侧边栏', icon: '📐', category: '操作', keywords: ['sidebar', 'toggle', '侧边栏', '切换'] },
  { id: 'go-settings', label: '前往系统设置', icon: '⚙️', category: '导航', keywords: ['settings', 'config', '设置', '配置'] },
  { id: 'go-dashboard', label: '前往仪表盘', icon: '📊', category: '导航', keywords: ['dashboard', 'home', '仪表盘', '首页', '主页'] },
]

// 搜索结果
const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  const items = []

  // 添加页面导航
  for (const tab of props.tabs) {
    items.push({
      id: `nav:${tab.id}`,
      label: tab.name,
      icon: tab.icon,
      category: '页面导航',
      keywords: [tab.id, tab.name],
      type: 'nav',
      target: tab.id,
    })
  }

  // 添加内置命令
  for (const cmd of builtInCommands) {
    items.push({ ...cmd, type: 'action' })
  }

  if (!q) return items.slice(0, 12)

  return items.filter(item => {
    const searchText = [item.label, item.category, ...(item.keywords || [])].join(' ').toLowerCase()
    return q.split('').every(char => searchText.includes(char))
  }).slice(0, 12)
})

watch(query, () => { selectedIndex.value = 0 })

function open() {
  visible.value = true
  query.value = ''
  selectedIndex.value = 0
  nextTick(() => { inputRef.value?.focus() })
}

function close() {
  visible.value = false
  query.value = ''
}

function toggle() {
  visible.value ? close() : open()
}

function moveUp() {
  selectedIndex.value = Math.max(0, selectedIndex.value - 1)
}

function moveDown() {
  selectedIndex.value = Math.min(results.value.length - 1, selectedIndex.value + 1)
}

function execute(item) {
  if (!item) item = results.value[selectedIndex.value]
  if (!item) return

  close()

  if (item.type === 'nav') {
    emit('navigate', item.target)
  } else if (item.type === 'action') {
    emit('action', item.id)
  }
}

function handleKeydown(e) {
  if (e.key === 'Escape') { close(); return }
  if (e.key === 'ArrowUp') { e.preventDefault(); moveUp(); return }
  if (e.key === 'ArrowDown') { e.preventDefault(); moveDown(); return }
  if (e.key === 'Enter') { e.preventDefault(); execute(); return }
}

defineExpose({ open, close, toggle })
</script>

<template>
  <Teleport to="body">
    <Transition name="palette">
      <div v-if="visible" class="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4"
        @click.self="close" @keydown="handleKeydown">
        <!-- 遮罩 -->
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="close"></div>

        <!-- 面板 -->
        <div class="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden ring-1 ring-gray-200/60">
          <!-- 搜索框 -->
          <div class="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
            <svg class="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input ref="inputRef" v-model="query" autocomplete="off" spellcheck="false"
              placeholder="搜索页面、命令..."
              aria-label="快速搜索"
              class="flex-1 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none bg-transparent">
            <kbd class="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-gray-400 bg-gray-100 rounded">ESC</kbd>
          </div>

          <!-- 结果列表 -->
          <div class="max-h-80 overflow-y-auto py-1.5">
            <div v-if="results.length === 0" class="px-4 py-8 text-center">
              <p class="text-sm text-gray-400">无匹配结果</p>
            </div>
            <template v-else>
              <div v-for="(item, idx) in results" :key="item.id"
                class="flex items-center gap-3 px-4 py-2.5 mx-1.5 rounded-xl cursor-pointer transition-colors"
                :class="idx === selectedIndex ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'"
                @click="execute(item)"
                @mouseenter="selectedIndex = idx">
                <span class="text-base flex-shrink-0 w-6 text-center">{{ item.icon }}</span>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium truncate">{{ item.label }}</p>
                </div>
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 flex-shrink-0"
                  :class="idx === selectedIndex ? 'bg-indigo-100 text-indigo-500' : ''">
                  {{ item.category }}
                </span>
              </div>
            </template>
          </div>

          <!-- 底部提示 -->
          <div class="px-4 py-2 border-t border-gray-100 flex items-center gap-4 text-[10px] text-gray-400">
            <span class="flex items-center gap-1"><kbd class="px-1 py-0.5 bg-gray-100 rounded font-mono">↑↓</kbd> 移动</span>
            <span class="flex items-center gap-1"><kbd class="px-1 py-0.5 bg-gray-100 rounded font-mono">↵</kbd> 执行</span>
            <span class="flex items-center gap-1"><kbd class="px-1 py-0.5 bg-gray-100 rounded font-mono">ESC</kbd> 关闭</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.palette-enter-active,
.palette-leave-active {
  transition: opacity 0.15s ease;
}
.palette-enter-active .relative,
.palette-leave-active .relative {
  transition: opacity 0.15s ease, transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}
.palette-enter-from,
.palette-leave-to {
  opacity: 0;
}
.palette-enter-from .relative {
  opacity: 0;
  transform: scale(0.96) translateY(-8px);
}
.palette-leave-to .relative {
  opacity: 0;
  transform: scale(0.96) translateY(-8px);
}
</style>
