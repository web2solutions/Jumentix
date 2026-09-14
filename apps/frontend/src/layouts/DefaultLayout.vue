<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue';
import { CContainer } from '@coreui/vue';
import { useRoute, useRouter } from 'vue-router';

import AppFooter from '@/components/AppFooter.vue';
import AppHeader from '@/components/AppHeader.vue';
import AppSidebar from '@/components/AppSidebar.vue';
import AppTaskbar from '@/components/AppTaskbar.vue';
import ModuleLayout from '@/components/ModuleLayout.vue';
import { expireIfStaleSession } from '@/contracts/sessionGuard';
import { usePermissions } from '@/contracts/usePermissions';
import { findModule, firstAllowedTab } from '@/modules/manifest';
import { useAuthStore } from '@/stores/auth';
import { useTaskStore } from '@/stores/tasks';
import { useShellViewport } from '@/shell/breakpoints';

const permissions = usePermissions();
const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const tasks = useTaskStore();
const { viewport } = useShellViewport();
let expiryTimer: ReturnType<typeof setInterval> | undefined;

const isProfile = computed(() => route.name === 'Profile');
const moduleId = computed(() => (
  typeof route.params.moduleId === 'string' ? route.params.moduleId : null
));

watch(moduleId, (id) => {
  if (id) tasks.openModule(id);
}, { immediate: true });

watch(() => tasks.active, (id) => {
  if (!id || isProfile.value || route.path === '/profile') return;
  const current = moduleId.value;
  if (current === id) return;
  const mod = findModule(id);
  const tab = mod ? firstAllowedTab(mod, permissions.roles.value) : 'dashboard';
  if (route.path.startsWith(`/m/${id}`)) return;
  router.push(`/m/${id}/${tab}`);
});

onMounted(() => {
  permissions.ensure();
  tasks.hydrate();
  expiryTimer = setInterval(() => {
    if (expireIfStaleSession(auth)) {
      router.push('/login');
    }
  }, 30000);
});

onUnmounted(() => {
  if (expiryTimer) clearInterval(expiryTimer);
});
</script>

<template>
  <div class="shell-root" :data-shell-bp="viewport">
    <AppSidebar />
    <div class="wrapper d-flex flex-column min-vh-100">
      <AppHeader />
      <div class="body flex-grow-1">
        <CContainer class="px-4" lg>
          <router-view />
          <div v-show="!isProfile" class="module-workspace">
            <ModuleLayout
              v-for="id in tasks.open"
              v-show="id === tasks.active"
              :key="id"
              :module-id="id"
            />
          </div>
        </CContainer>
      </div>
      <AppFooter />
      <AppTaskbar />
    </div>
  </div>
</template>
