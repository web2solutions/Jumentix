<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

import { drainOutbox } from '@/data/outbox';
import { useI18n } from '@/i18n';

const { t } = useI18n();
const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine);

const refresh = (): void => {
  online.value = navigator.onLine;
  if (online.value) {
    drainOutbox().catch(() => undefined);
  }
};

onMounted(() => {
  window.addEventListener('online', refresh);
  window.addEventListener('offline', refresh);
});
onUnmounted(() => {
  window.removeEventListener('online', refresh);
  window.removeEventListener('offline', refresh);
});
</script>

<template>
  <span
    class="d-inline-flex align-items-center gap-1 px-2"
    :aria-label="online ? t('network.online') : t('network.offline')"
    :data-online="online ? 'true' : 'false'"
  >
    <CIcon :icon="online ? 'cil-check-circle' : 'cil-x-circle'" size="sm" />
    <span class="d-none d-md-inline">{{ online ? t('network.online') : t('network.offline') }}</span>
  </span>
</template>
