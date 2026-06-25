import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export type ThemeMode = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

const THEME_MODE_KEY = 'LIFTLOG_THEME_MODE'

function readSystemTheme(): ResolvedTheme {
  try {
    return uni.getSystemInfoSync().theme === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export const useThemeStore = defineStore('theme', () => {
  const stored = uni.getStorageSync(THEME_MODE_KEY) as ThemeMode | undefined
  const mode = ref<ThemeMode>(
    ['system', 'light', 'dark'].includes(stored || '') ? stored! : 'system'
  )
  const systemTheme = ref<ResolvedTheme>(readSystemTheme())
  const resolvedTheme = computed<ResolvedTheme>(() =>
    mode.value === 'system' ? systemTheme.value : mode.value
  )
  const themeClass = computed(() => `theme-${resolvedTheme.value}`)
  let initialized = false

  function applyTheme() {
    const resolved = resolvedTheme.value
    const backgroundColor = resolved === 'dark' ? '#101115' : '#F3F6F9'
    // #ifdef H5
    document.documentElement.classList.remove('theme-light', 'theme-dark')
    document.documentElement.classList.add(`theme-${resolved}`)
    // #endif
    if (typeof uni.setBackgroundColor === 'function') {
      uni.setBackgroundColor({
        backgroundColor,
        backgroundColorTop: backgroundColor,
        backgroundColorBottom: backgroundColor
      })
    }
    uni.setTabBarStyle({
      color: resolved === 'dark' ? '#9399A6' : '#8491A3',
      selectedColor: resolved === 'dark' ? '#FF7138' : '#FF6418',
      backgroundColor: resolved === 'dark' ? '#101115' : '#FFFFFF',
      borderStyle: resolved === 'dark' ? 'black' : 'white'
    })
  }

  function setMode(next: ThemeMode) {
    mode.value = next
    uni.setStorageSync(THEME_MODE_KEY, next)
    applyTheme()
  }

  function initialize() {
    if (initialized) {
      applyTheme()
      return
    }
    initialized = true
    applyTheme()
    uni.onThemeChange?.((result) => {
      systemTheme.value = result.theme === 'dark' ? 'dark' : 'light'
      if (mode.value === 'system') {
        applyTheme()
      }
    })
  }

  return {
    mode,
    resolvedTheme,
    themeClass,
    initialize,
    setMode
  }
})
