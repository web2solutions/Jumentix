<script setup lang="ts">
import { computed } from 'vue';
import { CBadge, CNavGroup, CNavItem, CNavTitle, CSidebarNav } from '@coreui/vue'

import { can } from '@/contracts/rbac'
import { useI18n } from '@/i18n'
import { navFromModules } from '@/modules/nav'
import type { NavItem } from '@/modules/navTypes'
import { useProfileStore } from '@/stores/profile'
import { useTaskStore } from '@/stores/tasks'
import { useRouter } from 'vue-router'

const profile = useProfileStore()
const { t } = useI18n()
const tasks = useTaskStore()
const router = useRouter()

const allowed = (item: NavItem): boolean => (
  !item.operationId || can(profile.record?.roles ?? [], item.operationId)
)

const visibleItems = computed(() => navFromModules(profile.record?.roles ?? [])
  .map((item) => {
    if (!item.items) return allowed(item) ? item : null;
    const children = item.items.filter(allowed);
    return children.length ? { ...item, items: children } : null;
  })
  .filter((item): item is NavItem => item !== null))

const isGroup = (item: NavItem) => Boolean(item.items)
const isTitle = (item: NavItem) => item.component === 'CNavTitle'

const openModule = (to: string) => {
  const match = to.match(/^\/m\/([^/]+)/);
  if (match) {
    tasks.openModule(match[1]);
    router.push(to);
  }
}
</script>

<template>
  <CSidebarNav>
    <template v-for="item in visibleItems" :key="item.name">
      <CNavTitle v-if="isTitle(item)">{{ t(item.name) }}</CNavTitle>
      <CNavGroup v-else-if="isGroup(item)">
        <template #togglerContent>
          <CIcon v-if="item.icon" custom-class-name="nav-icon" :icon="item.icon" />
          {{ t(item.name) }}
        </template>
        <CNavItem v-for="child in item.items" :key="child.name">
          <RouterLink custom :to="child.to ?? '#'" v-slot="{ href, isActive, navigate }">
            <a
              class="nav-link"
              :class="{ active: isActive }"
              :href="href"
              @click="(event) => { event.preventDefault(); openModule(child.to ?? '#'); navigate(event); }"
            >
              <span class="nav-icon"><span class="nav-icon-bullet" /></span>
              {{ t(child.name) }}
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
            @click="(event) => { event.preventDefault(); openModule(item.to ?? '#'); navigate(event); }"
          >
            <CIcon v-if="item.icon" custom-class-name="nav-icon" :icon="item.icon" />
            <span v-else class="nav-icon"><span class="nav-icon-bullet" /></span>
            {{ t(item.name) }}
            <CBadge v-if="item.badge" class="ms-auto" :color="item.badge.color" size="sm">
              {{ item.badge.text }}
            </CBadge>
          </a>
        </RouterLink>
      </CNavItem>
      <CNavItem v-else-if="item.href" :href="item.href" target="_blank" rel="noopener noreferrer">
        <CIcon v-if="item.icon" custom-class-name="nav-icon" :icon="item.icon" />
        {{ t(item.name) }}
        <CBadge v-if="item.badge" class="ms-auto" :color="item.badge.color" size="sm">
          {{ item.badge.text }}
        </CBadge>
      </CNavItem>
    </template>
  </CSidebarNav>
</template>
