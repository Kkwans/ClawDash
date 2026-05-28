/**
 * 主题管理 composable
 * 支持 dark / light / system 三种模式
 * 自动跟随系统主题，支持手动切换
 */

import { ref, watch, onMounted, onUnmounted } from 'vue'

const THEME_KEY = 'clawdash_theme'

const theme = ref(localStorage.getItem(THEME_KEY) || 'system')
const isDark = ref(false)

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme() {
  const effective = theme.value === 'system' ? getSystemTheme() : theme.value
  isDark.value = effective === 'dark'
  document.documentElement.classList.toggle('dark', isDark.value)
  document.documentElement.setAttribute('data-theme', effective)
}

function setTheme(newTheme) {
  theme.value = newTheme
  localStorage.setItem(THEME_KEY, newTheme)
  applyTheme()
}

function toggleTheme() {
  const order = ['system', 'light', 'dark']
  const idx = order.indexOf(theme.value)
  setTheme(order[(idx + 1) % order.length])
}

let mediaQuery = null
let mediaHandler = null

export function useTheme() {
  onMounted(() => {
    applyTheme()
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaHandler = () => { if (theme.value === 'system') applyTheme() }
    mediaQuery.addEventListener('change', mediaHandler)
  })

  onUnmounted(() => {
    mediaQuery?.removeEventListener('change', mediaHandler)
  })

  return {
    theme,
    isDark,
    setTheme,
    toggleTheme
  }
}
