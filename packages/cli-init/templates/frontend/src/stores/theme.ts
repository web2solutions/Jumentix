import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ColorMode = 'light' | 'dark' | 'auto';

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<ColorMode>('light');

  const toggleTheme = (mode: ColorMode) => {
    theme.value = mode;
  };

  return { theme, toggleTheme };
});
