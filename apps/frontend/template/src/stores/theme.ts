import { ref } from 'vue'
import { defineStore } from 'pinia'

export type ColorMode = 'light' | 'dark' | 'auto'

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<ColorMode>('light')

  const toggleTheme = (_theme: ColorMode) => {
    theme.value = _theme
  }

  return { theme, toggleTheme }
})
