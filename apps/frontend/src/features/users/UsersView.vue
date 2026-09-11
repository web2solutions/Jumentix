<script setup lang="ts">
import { computed } from 'vue';

import XCrud from '@/components/x-crud/XCrud.vue';
import { hasSuperadmin } from '@/contracts/rbac';
import { usePermissions } from '@/contracts/usePermissions';
import { useAuthStore } from '@/stores/auth';
import { useProfileStore } from '@/stores/profile';

import { usersCrudConfig } from './usersCrudConfig';

/**
 * Users sub-app (JUM-772): X-CRUD over the Users domain. Tenancy: non-
 * superadmins only assign their own organization; nobody deletes themselves.
 */
const auth = useAuthStore();
const profile = useProfileStore();
const { roles } = usePermissions();

const referenceRestrictions = computed(() => {
  if (hasSuperadmin(roles.value)) return undefined;
  const ownOrg = profile.record?.organization;
  return ownOrg ? { organization: [ownOrg] } : { organization: [] };
});

const canDeleteRow = (row: Record<string, unknown>) => String(row.id) !== auth.userId;
</script>

<template>
  <div>
    <h3 class="mb-3">Users</h3>
    <XCrud
      :config="usersCrudConfig"
      :can-delete-row="canDeleteRow"
      :reference-restrictions="referenceRestrictions"
    />
  </div>
</template>
