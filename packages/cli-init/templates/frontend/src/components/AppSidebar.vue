<script setup lang="ts">
import { RouterLink } from 'vue-router'

import AppSidebarNav from '@/components/AppSidebarNav.vue'
import { useSidebarStore } from '@/stores/sidebar'

const sidebar = useSidebarStore()

const handleVisibleChange = (value: boolean) => {
  sidebar.toggleVisible(value)
}
</script>

<template>
  <CSidebar
    class="border-end"
    colorScheme="dark"
    position="fixed"
    :unfoldable="sidebar.unfoldable"
    :visible="sidebar.visible"
    @visible-change="handleVisibleChange"
  >
    <CSidebarHeader class="border-bottom">
      <RouterLink custom to="/" v-slot="{ href, navigate }">
        <CSidebarBrand v-bind="$attrs" as="a" :href="href" @click="navigate">
          <span class="sidebar-brand-full fw-bold fs-5">Jumentix</span>
          <span class="sidebar-brand-narrow fw-bold">J</span>
        </CSidebarBrand>
      </RouterLink>
      <CCloseButton class="d-lg-none" dark @click="sidebar.toggleVisible()" />
    </CSidebarHeader>
    <AppSidebarNav />
    <CSidebarFooter class="border-top d-none d-lg-flex">
      <CSidebarToggler @click="sidebar.toggleUnfoldable()" />
    </CSidebarFooter>
  </CSidebar>
</template>
