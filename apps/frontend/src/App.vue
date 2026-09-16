<script setup lang="ts">
import { inject, onBeforeMount } from 'vue'
import { useColorModes } from '@coreui/vue'

import BootErrorView from '@/views/BootErrorView.vue'
import { useThemeStore } from '@/stores/theme'

const canaBoot = inject<'ok' | 'unavailable'>('canaBoot', 'ok')

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
  <BootErrorView v-if="canaBoot !== 'ok'" />
  <router-view v-else />
</template>

<style lang="scss">
@use 'styles/style';
</style>
