<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';import { CButton } from '@coreui/vue';

import OasFormField from '@/components/OasFormField.vue';
import SearchableEnumInput from '@/components/SearchableEnumInput.vue';
import XCrudReferenceInput from '@/components/x-crud/XCrudReferenceInput.vue';
import { formatCellValue } from '@/components/x-crud/xCrudFormat';
import type { XCrudEntityConfig, XCrudMode } from '@/components/x-crud/xCrudTypes';
import type { FieldDescriptor } from '@/contracts/formSchema';
import { collectBody, validateAll } from '@/contracts/oasForm';

/**
 * XCrudForm — the 3 forms every entity gets (JUM-772): create (tab "New"),
 * update (card tab "Edit") and preview (card tab "Preview", readonly full
 * record). All fields come from the OAS descriptors; nothing is hardcoded.
 */
const props = defineProps<{
  config: XCrudEntityConfig;
  mode: XCrudMode;
  /** Descriptors for create/update; preview uses config.entity descriptors. */
  descriptors: FieldDescriptor[];
  record?: Record<string, unknown>;
  /** Reference restriction (e.g. admin sees only own organization). */
  referenceRestrictions?: Record<string, string[]>;
}>();

const emit = defineEmits<{
  submit: [body: Record<string, unknown>];
  cancel: [];
}>();

const values = reactive<Record<string, unknown>>({});
const formError = ref('');

watch(
  () => [props.record, props.mode],
  () => {
    Object.keys(values).forEach((key) => delete values[key]);
    if (props.record) {
      for (const d of props.descriptors) {
        if (props.record[d.name] !== undefined) values[d.name] = props.record[d.name];
      }
    }
    for (const d of props.descriptors) {
      if (values[d.name] === undefined && d.default !== undefined) values[d.name] = d.default;
    }
    formError.value = '';
  },
  { immediate: true, deep: true }
);

const isArrayField = (d: FieldDescriptor) => d.type === 'array';

const arrayValues = (d: FieldDescriptor): string[] => {
  const current = values[d.name];
  return Array.isArray(current) ? current.map(String) : [];
};

const toggleArrayOption = (d: FieldDescriptor, option: string, checked: boolean): void => {
  const current = new Set(arrayValues(d));
  if (checked) current.add(option);
  else current.delete(option);
  values[d.name] = [...current];
};

const submit = (): void => {
  const invalid = validateAll(props.descriptors, values);
  if (invalid) {
    formError.value = invalid;
    return;
  }
  formError.value = '';
  emit('submit', collectBody(props.descriptors, values));
};

/** Preview renders every scalar/array of the record, formatted per OAS. */
const previewEntries = (record: Record<string, unknown>) => Object.entries(record);
</script>

<template>
  <div class="xcrud-form">
    <!-- PREVIEW: readonly full record representation -->
    <template v-if="mode === 'preview' && record">
      <dl class="row mb-0">
        <template v-for="[key, value] in previewEntries(record)" :key="key">
          <dt class="col-sm-4 text-body-secondary">{{ key }}</dt>
          <dd class="col-sm-8">
            <template v-if="Array.isArray(value) && value.length && typeof value[0] === 'object'">
              <div v-for="(item, index) in value" :key="index" class="border rounded p-2 mb-1 small">
                <div v-for="(fieldValue, fieldKey) in item" :key="fieldKey">
                  <strong>{{ fieldKey }}:</strong> {{ fieldValue }}
                </div>
              </div>
            </template>
            <template v-else-if="Array.isArray(value)">
              <span v-for="(chip, index) in value" :key="index" class="badge text-bg-secondary me-1">
                {{ chip }}
              </span>
            </template>
            <template v-else>{{ formatCellValue({ name: key, type: typeof value, required: false }, value) }}</template>
          </dd>
        </template>
      </dl>
    </template>

    <!-- CREATE / UPDATE -->
    <template v-else>
      <div v-if="formError" class="alert alert-danger" role="alert">{{ formError }}</div>
      <template v-for="d in descriptors" :key="d.name">
        <!-- array-of-strings as checkbox group (options from the config) -->
        <div v-if="isArrayField(d) && config.arrayOptions?.[d.name]" class="mb-3">
          <label class="form-label">
            {{ d.description ?? d.name }}
            <span v-if="d.required" class="text-danger">*</span>
          </label>
          <div>
            <label
              v-for="option in config.arrayOptions[d.name]"
              :key="option"
              class="form-check form-check-inline"
            >
              <input
                class="form-check-input"
                type="checkbox"
                :checked="arrayValues(d).includes(option)"
                :aria-label="`${d.name}-${option}`"
                @change="toggleArrayOption(d, option, ($event.target as HTMLInputElement).checked)"
              >
              <span class="form-check-label">{{ option }}</span>
            </label>
          </div>
        </div>
        <!-- entity reference (x-references) -->
        <div v-else-if="d.xReferences?.operationId" class="mb-3">
          <label class="form-label" :for="`xref-${d.name}`">
            {{ d.description ?? d.name }}
            <span v-if="d.required" class="text-danger">*</span>
          </label>
          <XCrudReferenceInput
            :descriptor="d"
            :model-value="String(values[d.name] ?? '')"
            :restrict-to="referenceRestrictions?.[d.name]"
            @update:model-value="values[d.name] = $event"
          />
        </div>
        <!-- plain OAS field -->
        <OasFormField
          v-else-if="!isArrayField(d)"
          v-model="values[d.name]"
          :descriptor="d"
        />
      </template>
      <div class="d-flex gap-2">
        <CButton color="primary" type="button" @click="submit">
          {{ mode === 'create' ? 'Create' : 'Save' }}
        </CButton>
        <CButton color="secondary" variant="outline" type="button" @click="emit('cancel')">
          Cancel
        </CButton>
      </div>
    </template>
  </div>
</template>
