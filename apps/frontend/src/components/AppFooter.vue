<script setup lang="ts">
import { useI18n } from '@/i18n';

const { t } = useI18n();
</script>

<template>
  <CFooter class="px-4">
    <div>
      <span class="fw-semibold">Jumentix</span>
      <span class="ms-1">&copy; {{ new Date().getFullYear() }} XpertMinds.</span>
    </div>
    <div class="ms-auto">
      <span class="me-1">{{ t('app.generatedBy') }}</span>
      <a href="https://jumentix-website.vercel.app" target="_blank" rel="noreferrer">Jumentix</a>
    </div>
  </CFooter>
</template>
