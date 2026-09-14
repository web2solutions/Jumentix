<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useColorModes } from '@coreui/vue'

import AppBreadcrumb from '@/components/AppBreadcrumb.vue'
import { useI18n } from '@/i18n'
import { listToolbarWidgets } from '@/shell/toolbarWidgets'
import { useShellViewport } from '@/shell/breakpoints'
import { useSidebarStore } from '@/stores/sidebar'
import { useTaskStore } from '@/stores/tasks'
import { usePermissions } from '@/contracts/usePermissions'

const headerClassNames = ref('mb-4 p-0')
const { colorMode, setColorMode } = useColorModes('jumentix-frontend-theme')
const sidebar = useSidebarStore()
const { t } = useI18n()
const { roles } = usePermissions()
const tasks = useTaskStore()
const { widgetsOverflow } = useShellViewport()

const rightWidgets = computed(() => listToolbarWidgets(roles.value, tasks.active, 'right'))
const leftWidgets = computed(() => listToolbarWidgets(roles.value, tasks.active, 'left'))
const overflowWidgets = computed(() => (
  widgetsOverflow.value
    ? rightWidgets.value.filter((widget) => widget.id !== 'account')
    : []
))
const pinnedRight = computed(() => (
  widgetsOverflow.value
    ? rightWidgets.value.filter((widget) => widget.id === 'account')
    : rightWidgets.value
))

const updateHeaderShadow = () => {
  headerClassNames.value =
    document.documentElement.scrollTop > 0 ? 'mb-4 p-0 shadow-sm' : 'mb-4 p-0'
}

onMounted(() => {
  document.addEventListener('scroll', updateHeaderShadow)
})

onUnmounted(() => {
  document.removeEventListener('scroll', updateHeaderShadow)
})
</script>

<template>
  <CHeader position="sticky" :class="headerClassNames" data-shell-header>
    <CContainer class="border-bottom px-4" fluid>
      <CHeaderToggler :aria-label="t('nav.toggleNavigation')" class="app-taskbar__touch" @click="sidebar.toggleVisible()" style="margin-inline-start: -14px">
        <CIcon icon="cil-menu" size="lg" />
      </CHeaderToggler>
      <CHeaderNav class="d-none d-md-flex">
        <component
          :is="widget.component"
          v-for="widget in leftWidgets"
          :key="widget.id"
          v-bind="widget.props"
        />
      </CHeaderNav>
      <CHeaderNav class="ms-auto">
        <li class="nav-item py-1">
          <div class="vr h-100 mx-2 text-body text-opacity-75"></div>
        </li>
        <CDropdown variant="nav-item" placement="bottom-end">
          <CDropdownToggle :caret="false">
            <CIcon v-if="colorMode === 'dark'" icon="cil-moon" size="lg" />
            <CIcon v-else-if="colorMode === 'light'" icon="cil-sun" size="lg" />
            <CIcon v-else icon="cil-contrast" size="lg" />
          </CDropdownToggle>
          <CDropdownMenu>
            <CDropdownItem
              :active="colorMode === 'light'"
              class="d-flex align-items-center"
              component="button"
              type="button"
              @click="setColorMode('light')"
            >
              <CIcon class="me-2" icon="cil-sun" size="lg" /> Light
            </CDropdownItem>
            <CDropdownItem
              :active="colorMode === 'dark'"
              class="d-flex align-items-center"
              component="button"
              type="button"
              @click="setColorMode('dark')"
            >
              <CIcon class="me-2" icon="cil-moon" size="lg" /> Dark
            </CDropdownItem>
            <CDropdownItem
              :active="colorMode === 'auto'"
              class="d-flex align-items-center"
              component="button"
              type="button"
              @click="setColorMode('auto')"
            >
              <CIcon class="cil-contrast me-2" icon="cil-contrast" size="lg" /> Auto
            </CDropdownItem>
          </CDropdownMenu>
        </CDropdown>
        <CDropdown v-if="overflowWidgets.length" variant="nav-item" data-widget-overflow>
          <CDropdownToggle :caret="false" :aria-label="t('toolbar.more')">
            <CIcon icon="cil-options" size="lg" />
          </CDropdownToggle>
          <CDropdownMenu>
            <div class="px-2 py-1">
              <component
                :is="widget.component"
                v-for="widget in overflowWidgets"
                :key="widget.id"
                v-bind="widget.props"
              />
            </div>
          </CDropdownMenu>
        </CDropdown>
        <li class="nav-item py-1">
          <div class="vr h-100 mx-2 text-body text-opacity-75"></div>
        </li>
        <component
          :is="widget.component"
          v-for="widget in pinnedRight"
          :key="widget.id"
          v-bind="widget.props"
        />
      </CHeaderNav>
    </CContainer>
    <CContainer class="px-4" fluid>
      <AppBreadcrumb />
    </CContainer>
  </CHeader>
</template>
