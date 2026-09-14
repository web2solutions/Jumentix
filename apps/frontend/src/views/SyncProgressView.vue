<script setup lang="ts">
import { CAlert, CContainer, CSpinner } from '@coreui/vue';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { formatApiError } from '@/contracts/errors';
import { runSessionSync, syncProgress } from '@/data/sync';
import { useI18n } from '@/i18n';

const { t } = useI18n();
const router = useRouter();
const errorMessage = ref('');

const percent = computed(() => {
  if (syncProgress.expected <= 0) return 0;
  return Math.min(100, Math.round((syncProgress.done / syncProgress.expected) * 100));
});

onMounted(async () => {
  errorMessage.value = '';
  try {
    await runSessionSync();
    await router.replace('/dashboard');
  } catch (error) {
    errorMessage.value = formatApiError(error);
  }
});
</script>

<template>
  <div class="bg-body-tertiary min-vh-100 d-flex flex-row align-items-center">
    <CContainer class="text-center" style="max-width: 32rem">
      <CSpinner class="mb-3" />
      <h1 class="h4">{{ t('sync.title') }}</h1>
      <p class="text-body-secondary">{{ t('sync.subtitle') }}</p>
      <div
        role="progressbar"
        :aria-valuemin="0"
        :aria-valuemax="100"
        :aria-valuenow="percent"
        :aria-label="t('sync.progressLabel')"
        class="progress mb-2"
      >
        <div class="progress-bar" :style="{ width: `${percent}%` }" />
      </div>
      <p>
        {{ t('sync.entity', { entity: syncProgress.entity || '—' }) }}
        · {{ syncProgress.done }} / {{ syncProgress.expected }}
      </p>
      <CAlert v-if="errorMessage" color="danger" role="alert">
        {{ errorMessage }}
      </CAlert>
    </CContainer>
  </div>
</template>
