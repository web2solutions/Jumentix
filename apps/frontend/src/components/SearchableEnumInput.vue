<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { CFormInput } from '@coreui/vue';

import { t } from '@/i18n';

/**
 * Searchable enum input (JUM-769): a text input bound to a native datalist
 * (typing filters the options, zero deps) plus a visible "▾" affordance so
 * the control reads as a dropdown, not a plain text field. Options come from
 * the OAS enum — never hardcoded (requirement 136).
 *
 * With `{ value, label }` options the input shows the **label** and emits the
 * **value** (JUM-781): an organization reference displays "ACME", never the
 * uuid, while the form body still carries the id.
 */
type Option = string | { value: string; label: string };

const props = defineProps<{
  id: string;
  modelValue: string;
  /** Plain values, or { value, label } pairs (labels render in the dropdown). */
  options: Option[];
  maxlength?: number;
  ariaLabel?: string;
  placeholder?: string;
  invalid?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const optionValue = (option: Option) => (typeof option === 'string' ? option : option.value);
const optionLabel = (option: Option) => (typeof option === 'string' ? option : option.label);

const labelFor = (value: string): string => {
  const match = props.options.find((option) => optionValue(option) === value);
  return match ? optionLabel(match) : value;
};

/** What the user sees: the label of the selected value, or their in-progress text. */
const text = ref(labelFor(props.modelValue));

watch(
  () => [props.modelValue, props.options] as const,
  () => {
    const selected = props.options.find((option) => optionValue(option) === props.modelValue);
    if (selected) {
      text.value = optionLabel(selected);
      return;
    }
    const typed = props.options.find((option) => (
      optionLabel(option) === props.modelValue || optionLabel(option) === text.value
    ));
    if (typed) {
      text.value = optionLabel(typed);
      const value = optionValue(typed);
      if (value !== props.modelValue) emit('update:modelValue', value);
      return;
    }
    text.value = labelFor(props.modelValue);
  }
);

const onInput = (raw: string): void => {
  text.value = raw;
  // A typed label (or a raw value) that matches an option resolves to its value;
  // anything else is passed through so plain enums keep free typing + validation.
  const byLabel = props.options.find((option) => optionLabel(option) === raw);
  const byValue = props.options.find((option) => optionValue(option) === raw);
  emit('update:modelValue', byLabel ? optionValue(byLabel) : byValue ? optionValue(byValue) : raw);
};

const placeholderText = computed(() => props.placeholder ?? t('crud.typeToFilter'));
</script>

<template>
  <div class="oas-enum-input">
    <CFormInput
      :id="id"
      :model-value="text"
      type="text"
      :list="`${id}-list`"
      :aria-label="ariaLabel"
      :placeholder="placeholderText"
      :maxlength="maxlength"
      :invalid="invalid"
      autocomplete="off"
      @update:model-value="onInput(String($event))"
    />
    <span class="oas-enum-caret" aria-hidden="true">▾</span>
    <datalist :id="`${id}-list`">
      <option
        v-for="option in options"
        :key="optionValue(option)"
        :value="optionLabel(option)"
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
