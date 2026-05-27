import { ref, watch } from 'vue'

const STORAGE_KEY = 'clawdash_favorites'

const favorites = ref(loadFavorites())

function loadFavorites() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : ['dashboard', 'chat']
  } catch {
    return ['dashboard', 'chat']
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites.value))
  } catch {}
}

function toggleFavorite(tabId) {
  const idx = favorites.value.indexOf(tabId)
  if (idx >= 0) {
    favorites.value.splice(idx, 1)
  } else {
    favorites.value.push(tabId)
  }
  saveFavorites()
}

function isFavorite(tabId) {
  return favorites.value.includes(tabId)
}

export function useFavorites() {
  return { favorites, toggleFavorite, isFavorite }
}
