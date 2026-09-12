<script setup lang="ts">
import { CButton } from '@coreui/vue';

import OasFormField from '@/components/OasFormField.vue';
import SearchableEnumInput from '@/components/SearchableEnumInput.vue';
import type { FieldDescriptor } from '@/contracts/formSchema';

/**
 * XCrudArrayEditor (JUM-772): editor for array-of-objects fields (documents,
 * phones, emails…). Each item edits inline against the item schema's
 * descriptors (OAS-driven); add/remove rows; nothing is hardcoded.
 */
const props = defineProps<{
  descriptor: FieldDescriptor;
  itemDescriptors: FieldDescriptor[];
  modelValue: Array<Record<string, unknown>>;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: Array<Record<string, unknown>>];
}>();

const blankItem = (): Record<string, unknown> => Object.fromEntries(
  props.itemDescriptors
    .filter((d) => d.default !== undefined)
    .map((d) => [d.name, d.default])
);

const addItem = (): void => {
  emit('update:modelValue', [...props.modelValue, blankItem()]);
};

const removeItem = (index: number): void => {
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== index));
};

const setItemField = (index: number, field: string, value: unknown): void => {
  emit('update:modelValue', props.modelValue.map((item, i) => (
    i === index ? { ...item, [field]: value } : item
  )));
};
</script>

<template>
  <div class="xcrud-array-editor border rounded p-2">
    <div class="small text-uppercase text-body-secondary mb-2">
      {{ descriptor.description ?? descriptor.name }}
      <span v-if="descriptor.required" class="text-danger">*</span>
    </div>
    <div
      v-for="(item, index) in modelValue"
      :key="index"
      class="d-flex gap-2 align-items-end mb-2 border-bottom pb-2"
    >
      <template v-for="d in itemDescriptors" :key="d.name">
        <SearchableEnumInput
          v-if="d.enum"
          :id="`${descriptor.name}-${index}-${d.name}`"
          :model-value="String(item[d.name] ?? '')"
          :options="d.enum"
          :maxlength="d.maxLength"
          :aria-label="`${descriptor.name} ${index} ${d.name}`"
          :placeholder="d.description ?? d.name"
          @update:model-value="setItemField(index, d.name, $event)"
        />
        <CFormCheck
          v-else-if="d.type === 'boolean'"
          :id="`${descriptor.name}-${index}-${d.name}`"
          :model-value="Boolean(item[d.name])"
          :label="d.description ?? d.name"
          @update:model-value="setItemField(index, d.name, $event)"
        />
        <div v-else class="flex-grow-1">
          <OasFormField
            :descriptor="d"
            :model-value="item[d.name]"
            class="mb-0"
            @update:model-value="setItemField(index, d.name, $event)"
          />
        </div>
      </template>
      <CButton
        color="danger"
        variant="outline"
        size="sm"
        :aria-label="`remove ${descriptor.name} ${index}`"
        @click="removeItem(index)"
      >
        <CIcon icon="cil-trash" size="sm" />
      </CButton>
    </div>
    <CButton
      color="success"
      variant="outline"
      size="sm"
      :aria-label="`add ${descriptor.name}`"
      @click="addItem"
    >
      <CIcon icon="cil-plus" size="sm" /> Add
    </CButton>
  </div>
</template>
