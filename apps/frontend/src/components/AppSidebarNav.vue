<script setup lang="ts">
import { computed } from 'vue';
import { CBadge, CNavGroup, CNavItem, CNavTitle, CSidebarNav } from '@coreui/vue'

import nav, { type NavItem } from '@/_nav'
import { can } from '@/contracts/rbac'
import { useProfileStore } from '@/stores/profile'

// JUM-772: CNavGroup support + RBAC filtering — an item only renders when the
// session roles satisfy its operationId (groups render when any child does).
const profile = useProfileStore()

const allowed = (item: NavItem): boolean => (
  !item.operationId || can(profile.record?.roles ?? [], item.operationId)
)

const visibleItems = computed(() => nav
  .map((item) => {
    if (!item.items) return allowed(item) ? item : null;
    const children = item.items.filter(allowed);
    return children.length ? { ...item, items: children } : null;
  })
  .filter((item): item is NavItem => item !== null))

const isGroup = (item: NavItem) => Boolean(item.items)
const isTitle = (item: NavItem) => item.component === 'CNavTitle'
</script>

<template>
  <CSidebarNav>
    <template v-for="item in visibleItems" :key="item.name">
      <CNavTitle v-if="isTitle(item)">{{ item.name }}</CNavTitle>
      <CNavGroup v-else-if="isGroup(item)">
        <template #togglerContent>
          <CIcon v-if="item.icon" custom-class-name="nav-icon" :icon="item.icon" />
          {{ item.name }}
        </template>
        <CNavItem v-for="child in item.items" :key="child.name">
          <RouterLink custom :to="child.to ?? '#'" v-slot="{ href, isActive, navigate }">
            <a
              class="nav-link"
              :class="{ active: isActive }"
              :href="href"
              @click="navigate"
            >
              <span class="nav-icon"><span class="nav-icon-bullet" /></span>
              {{ child.name }}
            </a>
          </RouterLink>
        </CNavItem>
      </CNavGroup>
      <CNavItem v-else-if="item.to">
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
      <CNavItem v-else-if="item.href" :href="item.href" target="_blank" rel="noopener noreferrer">
        <CIcon v-if="item.icon" custom-class-name="nav-icon" :icon="item.icon" />
        {{ item.name }}
        <CBadge v-if="item.badge" class="ms-auto" :color="item.badge.color" size="sm">
          {{ item.badge.text }}
        </CBadge>
      </CNavItem>
    </template>
  </CSidebarNav>
</template>
