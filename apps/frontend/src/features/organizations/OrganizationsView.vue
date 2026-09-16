<script setup lang="ts">
import { useI18n } from '@/i18n';
import XCrud from '@/components/x-crud/XCrud.vue';

import { organizationsCrudConfig } from './organizationsCrudConfig';

/**
 * Organizations sub-app (JUM-772): X-CRUD over the Organizations domain.
 * Only superadmins manage multiple organizations — the x-rbac matrix (read
 * from the OAS) hides create/delete from other roles; the backend enforces.
 */
const { t } = useI18n();
</script>

<template>
  <div>
    <h3 class="mb-3">{{ t('nav.organizations') }}</h3>
    <XCrud :config="organizationsCrudConfig" />
  </div>
</template>
