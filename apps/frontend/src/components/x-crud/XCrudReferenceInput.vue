<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import SearchableEnumInput from '@/components/SearchableEnumInput.vue';
import { getSharedApiClient } from '@/contracts/apiClient';
import { entityPrimaryKey, listOperationForEntity, type FieldDescriptor } from '@/contracts/formSchema';
import { listCapabilities } from '@/contracts/listSchema';
import { t } from '@/i18n';
import { useAuthStore } from '@/stores/auth';

/**
 * XCrudReferenceInput (JUM-787): searchable select for `x-relation` FKs.
 * Candidates come from the target entity's `<Entity>ArrayOf` list operation.
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
  const relation = props.descriptor.relation;
  const operationId = relation?.entity ? listOperationForEntity(relation.entity) : undefined;
  if (!operationId) return;
  try {
    const auth = useAuthStore();
    const capabilities = listCapabilities(operationId);
    const response = await getSharedApiClient().request<{ result?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>({
      operationId,
      query: capabilities ? { page: 1, size: capabilities.maxSize } : undefined,
      headers: { Authorization: auth.token }
    });
    const rows = Array.isArray(response) ? response : (response.result ?? []);
    const labelField = relation?.display ?? 'name';
    const match = relation?.match || entityPrimaryKey(relation?.entity ?? '');
    options.value = rows.map((row) => ({
      value: String(row[match] ?? row.id),
      label: String(row[labelField] ?? row[match] ?? row.id)
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
