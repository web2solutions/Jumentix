<script setup lang="ts">
import { CDropdown, CDropdownItem, CDropdownMenu, CDropdownToggle } from '@coreui/vue';

/**
 * XCrudRowMenu (JUM-772): contextual menu with the CRUD tools for one record.
 * Actions are permission-filtered by the parent (can() per operationId).
 */
defineProps<{
  canUpdate: boolean;
  canDelete: boolean;
  extraActions?: Array<{ key: string; label: string }>;
}>();

const emit = defineEmits<{
  preview: [];
  edit: [];
  delete: [];
  extra: [key: string];
}>();
</script>

<template>
  <CDropdown variant="btn-group" placement="bottom-end">
    <CDropdownToggle color="secondary" variant="outline" size="sm" aria-label="row actions">
      ⋯
    </CDropdownToggle>
    <CDropdownMenu>
      <CDropdownItem component="button" @click="emit('preview')">Preview</CDropdownItem>
      <CDropdownItem v-if="canUpdate" component="button" @click="emit('edit')">Edit</CDropdownItem>
      <CDropdownItem
        v-for="action in extraActions ?? []"
        :key="action.key"
        component="button"
        @click="emit('extra', action.key)"
      >
        {{ action.label }}
      </CDropdownItem>
      <CDropdownItem
        v-if="canDelete"
        component="button"
        class="text-danger"
        @click="emit('delete')"
      >
        Delete
      </CDropdownItem>
    </CDropdownMenu>
  </CDropdown>
</template>
