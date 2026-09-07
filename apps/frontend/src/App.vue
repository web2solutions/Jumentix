<script setup lang="ts">
import { onBeforeMount } from 'vue'
import { useColorModes } from '@coreui/vue'

import { useThemeStore } from '@/stores/theme'

const { isColorModeSet, setColorMode } = useColorModes('jumentix-frontend-theme')
const currentTheme = useThemeStore()

onBeforeMount(() => {
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
@use 'styles/style';
</style>
