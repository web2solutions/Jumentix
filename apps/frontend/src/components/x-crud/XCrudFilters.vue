<script setup lang="ts">
import { CFormInput, CFormSelect } from '@coreui/vue';

import type { FieldDescriptor } from '@/contracts/formSchema';

/**
 * XCrudColumnFilter (JUM-772 redesign): one compact filter control per column,
 * rendered in the grid's second thead row (Smart Table style). The control
 * matches the OAS facet: enum → select, boolean → tri-state, date → range.
 */
const props = defineProps<{
  descriptor: FieldDescriptor;
  value: unknown;
}>();

const emit = defineEmits<{ set: [value: unknown] }>();

const isDate = (d: FieldDescriptor): boolean => d.format === 'date-time' || d.format === 'date'
  || ['createdAt', 'updatedAt'].includes(d.name);

const range = () => (Array.isArray(props.value) ? props.value as [string?, string?] : ['', '']);
</script>

<template>
  <CFormSelect
    v-if="descriptor.enum"
    size="sm"
    :aria-label="`filter-${descriptor.name}`"
    :model-value="String(value ?? '')"
    :options="[{ label: 'All', value: '' }, ...descriptor.enum.map((option) => ({ label: option, value: option }))]"
    @update:model-value="emit('set', String($event))"
  />
  <CFormSelect
    v-else-if="descriptor.type === 'boolean'"
    size="sm"
    :aria-label="`filter-${descriptor.name}`"
    :model-value="String(value ?? '')"
    :options="[
      { label: 'All', value: '' },
      { label: 'Yes', value: 'true' },
      { label: 'No', value: 'false' }
    ]"
    @update:model-value="emit('set', $event === '' ? '' : $event === 'true')"
  />
  <div v-else-if="isDate(descriptor)" class="d-flex gap-1">
    <CFormInput
      size="sm"
      type="date"
      :aria-label="`filter-${descriptor.name}-from`"
      :model-value="String(range()[0] ?? '')"
      @update:model-value="emit('set', [String($event), range()[1] ?? ''])"
    />
    <CFormInput
      size="sm"
      type="date"
      :aria-label="`filter-${descriptor.name}-to`"
      :model-value="String(range()[1] ?? '')"
      @update:model-value="emit('set', [range()[0] ?? '', String($event)])"
    />
  </div>
  <CFormInput
    v-else
    size="sm"
    :aria-label="`filter-${descriptor.name}`"
    :model-value="String(value ?? '')"
    :maxlength="descriptor.maxLength"
    @update:model-value="emit('set', $event)"
  />
</template>
