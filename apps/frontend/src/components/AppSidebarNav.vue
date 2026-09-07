<script setup lang="ts">
import { CBadge, CSidebarNav, CNavItem, CNavTitle } from '@coreui/vue'
import nav, { type NavItem } from '@/_nav'

// Template-syntax replacement for the template catalog's render-function nav:
// the MVP supports CNavItem and CNavTitle; CNavGroup lands with the first group.
const isGroup = (item: NavItem) => Boolean(item.items)
const isTitle = (item: NavItem) => item.component === 'CNavTitle'
</script>

<template>
  <CSidebarNav>
    <template v-for="item in nav" :key="item.name">
      <CNavTitle v-if="isTitle(item)">{{ item.name }}</CNavTitle>
      <CNavItem v-else-if="!isGroup(item) && item.to">
        <RouterLink custom :to="item.to" v-slot="{ href, isActive, navigate }">
          <a
            class="nav-link"
            :class="{ active: isActive }"
            :href="href"
            @click="navigate"
          >
            <CIcon v-if="item.icon" custom-class-name="nav-icon" :icon="item.icon" />
            <span v-else class="nav-icon"><span class="nav-icon-bullet" /></span>
            {{ item.name }}
            <CBadge v-if="item.badge" class="ms-auto" :color="item.badge.color" size="sm">
              {{ item.badge.text }}
            </CBadge>
          </a>
        </RouterLink>
      </CNavItem>
      <CNavItem v-else-if="!isGroup(item) && item.href" :href="item.href" target="_blank" rel="noopener noreferrer">
        <CIcon v-if="item.icon" custom-class-name="nav-icon" :icon="item.icon" />
        {{ item.name }}
        <CBadge v-if="item.badge" class="ms-auto" :color="item.badge.color" size="sm">
          {{ item.badge.text }}
        </CBadge>
      </CNavItem>
    </template>
  </CSidebarNav>
</template>
