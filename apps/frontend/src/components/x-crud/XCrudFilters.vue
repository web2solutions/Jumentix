<script setup lang="ts">
import { CFormInput, CFormSelect } from '@coreui/vue';

import SearchableEnumInput from '@/components/SearchableEnumInput.vue';
import type { FieldDescriptor } from '@/contracts/formSchema';

/**
 * XCrudFilters (JUM-772): one filter per known data field, with the control
 * that makes sense for the OAS facet — enum → dropdown, boolean → tri-state,
 * date-time → range, everything else → text with the field's maxlength.
 */
defineProps<{
  columns: FieldDescriptor[];
  filters: Record<string, unknown>;
}>();

const emit = defineEmits<{ setFilter: [field: string, value: unknown] }>();

const filterable = (d: FieldDescriptor): boolean => (
  d.type !== 'array' && d.type !== 'object' && d.format !== 'password'
);

const isDate = (d: FieldDescriptor): boolean => d.format === 'date-time' || d.format === 'date'
  || ['createdAt', 'updatedAt'].includes(d.name);
</script>

<template>
  <div class="row g-2 mb-3 xcrud-filters">
    <div v-for="d in columns.filter(filterable)" :key="d.name" class="col-auto">
      <label class="form-label small mb-1" :for="`filter-${d.name}`">{{ d.description ?? d.name }}</label>

      <SearchableEnumInput
        v-if="d.enum"
        :id="`filter-${d.name}`"
        :model-value="String(filters[d.name] ?? '')"
        :options="d.enum"
        :maxlength="d.maxLength"
        @update:model-value="emit('setFilter', d.name, $event)"
      />

      <CFormSelect
        v-else-if="d.type === 'boolean'"
        :id="`filter-${d.name}`"
        :model-value="String(filters[d.name] ?? '')"
        :options="[
          { label: 'todos', value: '' },
          { label: 'sim', value: 'true' },
          { label: 'não', value: 'false' }
        ]"
        @update:model-value="emit('setFilter', d.name, $event === '' ? '' : $event === 'true')"
      />

      <div v-else-if="isDate(d)" class="d-flex gap-1">
        <CFormInput
          :id="`filter-${d.name}-from`"
          type="date"
          aria-label="from"
          :model-value="String((filters[d.name] as string[] | undefined)?.[0] ?? '')"
          @update:model-value="emit('setFilter', d.name, [String($event), (filters[d.name] as string[] | undefined)?.[1] ?? ''])"
        />
        <CFormInput
          :id="`filter-${d.name}-to`"
          type="date"
          aria-label="to"
          :model-value="String((filters[d.name] as string[] | undefined)?.[1] ?? '')"
          @update:model-value="emit('setFilter', d.name, [(filters[d.name] as string[] | undefined)?.[0] ?? '', String($event)])"
        />
      </div>

      <CFormInput
        v-else
        :id="`filter-${d.name}`"
        :model-value="String(filters[d.name] ?? '')"
        :maxlength="d.maxLength"
        size="sm"
        @update:model-value="emit('setFilter', d.name, $event)"
      />
    </div>
  </div>
</template>
