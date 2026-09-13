<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import SearchableEnumInput from '@/components/SearchableEnumInput.vue';
import { getSharedApiClient } from '@/contracts/apiClient';
import type { FieldDescriptor } from '@/contracts/formSchema';
import { listCapabilities } from '@/contracts/listSchema';
import { t } from '@/i18n';
import { useAuthStore } from '@/stores/auth';

/**
 * XCrudReferenceInput (JUM-772): searchable select for entity references
 * (`x-references` in the OAS). Options come from the referenced entity's list
 * operationId — the frontend learns the FK from the contract, not from code.
 * The control shows the referenced label and emits the id (JUM-781).
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
  const reference = props.descriptor.xReferences;
  if (!reference?.operationId) return;
  try {
    const auth = useAuthStore();
    const capabilities = listCapabilities(reference.operationId);
    const response = await getSharedApiClient().request<{ result?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>({
      operationId: reference.operationId,
      query: capabilities ? { page: 1, size: capabilities.maxSize } : undefined,
      headers: { Authorization: auth.token }
    });
    const rows = Array.isArray(response) ? response : (response.result ?? []);
    const labelField = reference.labelField ?? 'name';
    options.value = rows.map((row) => ({
      value: String(row.id),
      label: String(row[labelField] ?? row.id)
    }));
  } catch {
    loadError.value = t('crud.referencesUnavailable');
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
    :placeholder="loadError || undefined"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
