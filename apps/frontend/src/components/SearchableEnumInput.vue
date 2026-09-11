<script setup lang="ts">
import { CFormInput } from '@coreui/vue';

/**
 * Searchable enum input (JUM-769): a text input bound to a native datalist
 * (typing filters the options, zero deps) plus a visible "▾" affordance so
 * the control reads as a dropdown, not a plain text field. Options come from
 * the OAS enum — never hardcoded (requirement 136).
 */
defineProps<{
  id: string;
  modelValue: string;
  /** Plain values, or { value, label } pairs (labels render in the dropdown). */
  options: Array<string | { value: string; label: string }>;
  maxlength?: number;
  ariaLabel?: string;
  placeholder?: string;
  invalid?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const optionValue = (option: string | { value: string; label: string }) => (
  typeof option === 'string' ? option : option.value
);
const optionLabel = (option: string | { value: string; label: string }) => (
  typeof option === 'string' ? undefined : option.label
);
</script>

<template>
  <div class="oas-enum-input">
    <CFormInput
      :id="id"
      :model-value="modelValue"
      type="text"
      :list="`${id}-list`"
      :aria-label="ariaLabel"
      :placeholder="placeholder ?? 'digite para filtrar'"
      :maxlength="maxlength"
      :invalid="invalid"
      @update:model-value="emit('update:modelValue', String($event))"
    />
    <span class="oas-enum-caret" aria-hidden="true">▾</span>
    <datalist :id="`${id}-list`">
      <option
        v-for="option in options"
        :key="optionValue(option)"
        :value="optionValue(option)"
        :label="optionLabel(option)"
      />
    </datalist>
  </div>
</template>

<style scoped>
.oas-enum-input {
  position: relative;
}

.oas-enum-caret {
  position: absolute;
  right: 0.6rem;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: var(--cui-secondary-color, #6b7785);
  font-size: 0.85rem;
}
</style>
