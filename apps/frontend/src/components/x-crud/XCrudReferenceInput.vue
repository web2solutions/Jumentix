<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import SearchableEnumInput from '@/components/SearchableEnumInput.vue';
import { getSharedApiClient } from '@/contracts/apiClient';
import type { FieldDescriptor } from '@/contracts/formSchema';
import { useAuthStore } from '@/stores/auth';

/**
 * XCrudReferenceInput (JUM-772): searchable select for entity references
 * (`x-references` in the OAS). Options come from the referenced entity's list
 * operationId — the frontend learns the FK from the contract, not from code.
 */
const props = defineProps<{
  descriptor: FieldDescriptor;
  modelValue: string;
  restrictTo?: string[];
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const options = ref<Array<{ value: string; label: string }>>([]);
const loadError = ref('');

onMounted(async () => {
  const ref = props.descriptor.xReferences;
  if (!ref?.operationId) return;
  try {
    const auth = useAuthStore();
    const response = await getSharedApiClient().request<{ result?: Array<Record<string, unknown>> }>({
      operationId: ref.operationId,
      headers: { Authorization: auth.token }
    });
    const rows = response.result ?? [];
    const labelField = ref.labelField ?? 'name';
    options.value = rows.map((row) => ({
      value: String(row.id),
      label: String(row[labelField] ?? row.id)
    }));
  } catch {
    loadError.value = 'referências indisponíveis';
  }
});

const visibleOptions = computed(() => {
  const restriction = props.restrictTo;
  return restriction ? options.value.filter((o) => restriction.includes(o.value)) : options.value;
});
</script>

<template>
  <SearchableEnumInput
    :id="`xref-${descriptor.name}`"
    :model-value="modelValue"
    :options="visibleOptions"
    :aria-label="descriptor.name"
    :placeholder="loadError || 'digite para filtrar'"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
