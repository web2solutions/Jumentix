<script setup lang="ts">
/**
 * App.vue - Main Application Component
 *
 * This is the root component of the CoreUI Free Vue Admin Template.
 * It handles theme initialization and provides the router-view for all routes.
 *
 * Key responsibilities:
 * - Theme detection from URL parameters
 * - Theme persistence with localStorage
 * - Router view rendering for SPA navigation
 *
 * @component
 */
import { onBeforeMount } from 'vue'
import { useColorModes } from '@coreui/vue'

import { useThemeStore } from '@/stores/theme'

// Initialize CoreUI color modes with local storage key
const { isColorModeSet, setColorMode } = useColorModes(
  'coreui-free-vue-admin-template-theme',
)
const currentTheme = useThemeStore()

onBeforeMount(() => {
  const queryString = window.location.href.split('?')[1] ?? ''
  const urlParams = new URLSearchParams(queryString)
  let theme = urlParams.get('theme')

  const normalizedTheme = theme?.match(/^[A-Za-z0-9\s]+/)?.[0]

  if (normalizedTheme) {
    theme = normalizedTheme
  }

  if (theme) {
    setColorMode(theme)
    return
  }

  if (isColorModeSet()) {
    return
  }

  setColorMode(currentTheme.theme)
})
</script>

<template>
  <router-view />
</template>

<style lang="scss">
// Import Main styles for this application
@use 'styles/style';
// We use those styles to show code examples, you should remove them in your application.
@use 'styles/examples';
</style>
