<script setup lang="ts">
import { computed } from 'vue';
import { CFormCheck, CFormInput, CFormLabel } from '@coreui/vue';

import SearchableEnumInput from '@/components/SearchableEnumInput.vue';
import type { FieldDescriptor } from '@/contracts/formSchema';

/**
 * Renders one OAS field descriptor (JUM-766 + JUM-768): type/format/required/
 * lengths/enum/pattern/default/example all come from the spec — this component
 * owns nothing static about the field. Enums render as a searchable dropdown
 * (native datalist: typing filters the options). maxlength always applies —
 * declared or derived from the mask — so over-typing is blocked at the input,
 * never "valid until it isn't".
 */
const props = defineProps<{
  descriptor: FieldDescriptor;
  modelValue: unknown;
  mask?: (raw: string) => string;
  maskCap?: number;
  invalid?: string | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: unknown];
}>();

const inputId = computed(() => `oas-field-${props.descriptor.name}`);

// Effective cap: declared maxLength wins; a mask derives its own length.
const maxLength = computed(() => props.descriptor.maxLength ?? props.maskCap);

const isNumericField = computed(() => Boolean(
  props.descriptor.pattern && /^\^\\[dsS]|^\^\\d/.test(props.descriptor.pattern)
));

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

const onKeypress = (event: KeyboardEvent) => {
  if (isNumericField.value && event.key.length === 1 && !/[\d+]/.test(event.key)) {
    event.preventDefault();
  }
};

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
      <template v-if="descriptor.enum">
        <SearchableEnumInput
          :id="inputId"
          :model-value="text"
          :options="descriptor.enum"
          :maxlength="maxLength"
          :aria-label="descriptor.name"
          :invalid="Boolean(invalid)"
          @update:model-value="text = $event"
        />
      </template>
      <CFormInput
        v-else
        :id="inputId"
        v-model="text"
        :type="descriptor.format === 'password' ? 'password' : 'text'"
        :placeholder="placeholder"
        :required="descriptor.required"
        :minlength="descriptor.minLength"
        :maxlength="maxLength"
        :pattern="descriptor.pattern"
        :invalid="Boolean(invalid)"
        @keypress="onKeypress"
      />
      <div v-if="invalid" class="text-danger small mt-1" role="alert">{{ invalid }}</div>
    </template>
  </div>
</template>
