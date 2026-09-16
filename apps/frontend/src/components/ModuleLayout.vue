<script setup lang="ts">
import { computed, markRaw, ref, watch, type Component } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CNav, CNavItem, CNavLink } from '@coreui/vue';

import { usePermissions } from '@/contracts/usePermissions';
import { localized, useI18n } from '@/i18n';
import {
  findModule,
  firstAllowedTab,
  visibleEntityTabs,
  type ModuleManifest
} from '@/modules/manifest';

const props = defineProps<{ moduleId: string }>();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { roles } = usePermissions();

const mod = computed<ModuleManifest | undefined>(() => findModule(props.moduleId));

const tabs = computed(() => {
  const manifest = mod.value;
  if (!manifest) return [];
  const entities = visibleEntityTabs(manifest, roles.value).map((entity) => ({
    id: entity.id,
    label: localized(entity.title),
    kind: 'entity' as const
  }));
  return [
    ...entities,
    { id: 'dashboard', label: t('nav.dashboard'), kind: 'dashboard' as const }
  ];
});

const activeTab = computed(() => {
  const tab = typeof route.params.tab === 'string' ? route.params.tab : '';
  if (tabs.value.some((item) => item.id === tab)) return tab;
  const manifest = mod.value;
  return manifest ? firstAllowedTab(manifest, roles.value) : 'dashboard';
});

watch(
  [() => props.moduleId, tabs, () => route.params.tab, () => route.name],
  () => {
    if (route.name !== 'Module') return;
    if (route.params.moduleId !== props.moduleId) return;
    const tab = typeof route.params.tab === 'string' ? route.params.tab : '';
    if (!mod.value) return;
    if (!tab || !tabs.value.some((item) => item.id === tab)) {
      const next = firstAllowedTab(mod.value, roles.value);
      if (route.path !== `/m/${props.moduleId}/${next}`) {
        router.replace(`/m/${props.moduleId}/${next}`);
      }
    }
  },
  { immediate: true }
);

const loaded = ref<Record<string, Component>>({});

watch(
  [activeTab, mod],
  async () => {
    const manifest = mod.value;
    const tab = activeTab.value;
    if (!manifest || loaded.value[tab]) return;
    if (tab === 'dashboard' && manifest.dashboard) {
      const chunk = await manifest.dashboard.load();
      loaded.value = { ...loaded.value, dashboard: markRaw(chunk.default) };
      return;
    }
    const entity = manifest.entities.find((item) => item.id === tab);
    if (!entity) return;
    const chunk = await entity.load();
    loaded.value = { ...loaded.value, [tab]: markRaw(chunk.default) };
  },
  { immediate: true }
);

const selectTab = (tabId: string) => {
  router.push(`/m/${props.moduleId}/${tabId}`);
};
</script>

<template>
  <div v-if="mod" class="module-layout">
    <CNav variant="underline" class="module-tabs mb-3" data-module-tabs role="tablist">
      <CNavItem v-for="tab in tabs" :key="tab.id">
        <CNavLink
          component="button"
          type="button"
          role="tab"
          :active="tab.id === activeTab"
          :aria-selected="tab.id === activeTab"
          @click="selectTab(tab.id)"
        >
          {{ tab.label }}
        </CNavLink>
      </CNavItem>
    </CNav>
    <div
      v-for="tab in tabs"
      :key="tab.id"
      v-show="tab.id === activeTab"
      class="module-pane"
      role="tabpanel"
    >
      <component :is="loaded[tab.id]" v-if="loaded[tab.id]" />
      <p v-else class="text-body-secondary">{{ t('app.loading') }}</p>
    </div>
  </div>
  <p v-else class="text-danger">{{ t('module.unknown', { id: moduleId }) }}</p>
</template>
