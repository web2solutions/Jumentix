<script setup lang="ts">
import { computed } from 'vue';
import { CFormCheck, CFormInput, CFormLabel, CFormSelect } from '@coreui/vue';

import type { FieldDescriptor } from '@/contracts/formSchema';

/**
 * Renders one OAS field descriptor (JUM-766): type/format/required/lengths/
 * enum/pattern/default/example all come from the spec — this component owns
 * nothing static about the field.
 */
const props = defineProps<{
  descriptor: FieldDescriptor;
  modelValue: unknown;
  mask?: (raw: string) => string;
  invalid?: string | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: unknown];
}>();

const inputId = computed(() => `oas-field-${props.descriptor.name}`);

const text = computed({
  get: () => (props.modelValue === undefined || props.modelValue === null
    ? ''
    : String(props.modelValue)),
  set: (value: string) => {
    emit('update:modelValue', props.mask ? props.mask(value) : value);
  }
});

const checked = computed({
  get: () => Boolean(props.modelValue ?? props.descriptor.default ?? false),
  set: (value: boolean) => emit('update:modelValue', value)
});

const placeholder = computed(() => (
  props.descriptor.example ?? props.descriptor.description ?? props.descriptor.name
));
</script>

<template>
  <div class="mb-3">
    <template v-if="descriptor.type === 'boolean'">
      <CFormCheck
        :id="inputId"
        v-model="checked"
        :label="descriptor.description ?? descriptor.name"
      />
    </template>
    <template v-else>
      <CFormLabel :for="inputId">
        {{ descriptor.description ?? descriptor.name }}
        <span v-if="descriptor.required" class="text-danger">*</span>
      </CFormLabel>
      <CFormSelect
        v-if="descriptor.enum"
        :id="inputId"
        :model-value="text"
        :options="descriptor.enum"
        :required="descriptor.required"
        @update:model-value="emit('update:modelValue', $event)"
      />
      <CFormInput
        v-else
        :id="inputId"
        v-model="text"
        :type="descriptor.format === 'password' ? 'password' : 'text'"
        :placeholder="placeholder"
        :required="descriptor.required"
        :minlength="descriptor.minLength"
        :maxlength="descriptor.maxLength"
        :pattern="descriptor.pattern"
        :invalid="Boolean(invalid)"
      />
      <div v-if="invalid" class="text-danger small mt-1" role="alert">{{ invalid }}</div>
    </template>
  </div>
</template>
