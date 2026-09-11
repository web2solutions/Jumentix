<script setup lang="ts">
import { CFormInput } from '@coreui/vue';

/** XCrudToolbar (JUM-772): full-text search across the config's searchFields. */
defineProps<{ search: string; placeholder?: string }>();
const emit = defineEmits<{ 'update:search': [value: string] }>();
</script>

<template>
  <div class="d-flex gap-2 align-items-center mb-3 xcrud-toolbar">
    <CFormInput
      :model-value="search"
      type="search"
      :placeholder="placeholder ?? 'Search…'"
      aria-label="search"
      @update:model-value="emit('update:search', String($event))"
    />
    <slot />
  </div>
</template>
