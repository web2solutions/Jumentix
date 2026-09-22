<script setup lang="ts">
import { CButton, CFormCheck } from '@coreui/vue';

import OasFormField from '@/components/OasFormField.vue';
import SearchableEnumInput from '@/components/SearchableEnumInput.vue';
import type { FieldDescriptor } from '@/contracts/formSchema';
import { fieldLabel } from '@/contracts/labels';
import { t } from '@/i18n';

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
      {{ fieldLabel(descriptor) }}
      <span v-if="descriptor.required" class="text-danger">*</span>
    </div>
    <div
      v-for="(item, index) in modelValue"
      :key="index"
      class="d-flex gap-2 align-items-end mb-2 border-bottom pb-2"
    >
      <template v-for="d in itemDescriptors" :key="d.name">
        <div v-if="d.enum" class="xcrud-array-cell">
          <label class="form-label small mb-1" :for="`${descriptor.name}-${index}-${d.name}`">
            {{ fieldLabel(d) }}<span v-if="d.required" class="text-danger">*</span>
          </label>
          <SearchableEnumInput
            :id="`${descriptor.name}-${index}-${d.name}`"
            :model-value="String(item[d.name] ?? '')"
            :options="d.enum"
            :maxlength="d.maxLength"
            :aria-label="`${descriptor.name} ${index} ${d.name}`"
            :placeholder="fieldLabel(d)"
            @update:model-value="setItemField(index, d.name, $event)"
          />
        </div>
        <CFormCheck
          v-else-if="d.type === 'boolean'"
          :id="`${descriptor.name}-${index}-${d.name}`"
          :model-value="Boolean(item[d.name])"
          :label="fieldLabel(d)"
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
        :aria-label="t('crud.remove', { field: descriptor.name, index })"
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
      <CIcon icon="cil-plus" size="sm" /> {{ t('crud.add') }}
    </CButton>
  </div>
</template>
