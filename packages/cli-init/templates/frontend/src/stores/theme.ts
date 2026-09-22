import { ref } from 'vue';
import { defineStore } from 'pinia';

export type ColorMode = 'light' | 'dark' | 'auto'

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<ColorMode>('light');

  const toggleTheme = (mode: ColorMode) => {
    theme.value = mode;
  };

  return { theme, toggleTheme };
});
