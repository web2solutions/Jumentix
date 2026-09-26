<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter, type RouteLocationNormalizedLoaded } from 'vue-router'
import { localized, useI18n } from '@/i18n'
import { findModule } from '@/modules/manifest'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

interface Breadcrumb {
  active: boolean
  label: string
  href: string
}

/**
 * Crumbs for the current location (JUM-906).
 *
 * `route.matched` holds route records, whose `path` is the pattern — a module
 * page rendered "Home / Home" linking to `/#/m/:moduleId/:tab?`. Each crumb now
 * links to a resolved location, and a module route shows the module and the
 * active tab by name.
 */
const buildBreadcrumbs = (current: RouteLocationNormalizedLoaded): Breadcrumb[] => {
  const crumbs: Breadcrumb[] = []
  for (const record of current.matched) {
    if (record.name === 'Module') {
      const moduleId = String(current.params.moduleId ?? '')
      const manifest = findModule(moduleId)
      crumbs.push({
        active: false,
        label: manifest ? localized(manifest.title) : moduleId,
        href: router.resolve({ name: 'Module', params: { moduleId } }).href
      })
      const tab = typeof current.params.tab === 'string' ? current.params.tab : ''
      const entity = manifest?.entities.find((item) => item.id === tab)
      const tabLabel = entity ? localized(entity.title) : tab === 'dashboard' ? t('nav.dashboard') : ''
      if (tabLabel) crumbs.push({ active: false, label: tabLabel, href: router.resolve(current.fullPath).href })
      continue
    }
    const key = record.meta.titleKey as string | undefined
    crumbs.push({
      active: false,
      label: key ? t(key) : String(record.name ?? ''),
      href: record.name
        ? router.resolve({ name: record.name, params: record.path.includes(':') ? current.params : {} }).href
        : router.resolve(current.fullPath).href
    })
  }
  if (crumbs.length > 0) crumbs[crumbs.length - 1].active = true
  return crumbs
}

const breadcrumbs = computed(() => buildBreadcrumbs(route))
</script>

<template>
  <CBreadcrumb class="my-0">
    <CBreadcrumbItem
      v-for="item in breadcrumbs"
      :key="item.href + item.label"
      :href="item.active ? '' : item.href"
      :active="item.active"
    >
      {{ item.label }}
    </CBreadcrumbItem>
  </CBreadcrumb>
</template>
