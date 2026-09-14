<script setup lang="ts">
import { CAlert, CContainer } from '@coreui/vue';

import { useI18n } from '@/i18n';

const { t } = useI18n();
</script>

<template>
  <div class="bg-body-tertiary min-vh-100 d-flex flex-row align-items-center">
    <CContainer style="max-width: 32rem">
      <CAlert color="danger" role="alert">
        <h1 class="h4">{{ t('boot.unavailableTitle') }}</h1>
        <p class="mb-0">{{ t('boot.unavailableBody') }}</p>
      </CAlert>
    </CContainer>
  </div>
</template>
