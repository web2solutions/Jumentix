<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { CAvatar, CButton } from '@coreui/vue';

import OasFormField from '@/components/OasFormField.vue';
import XCrudArrayEditor from '@/components/x-crud/XCrudArrayEditor.vue';
import XCrudReferenceInput from '@/components/x-crud/XCrudReferenceInput.vue';
import { formatCellValue, shortId } from '@/components/x-crud/xCrudFormat';
import type { XCrudEntityConfig, XCrudMode } from '@/components/x-crud/xCrudTypes';
import {
  arrayItemDescriptors, fieldDescriptors, type FieldDescriptor
} from '@/contracts/formSchema';
import { collectBody, validateAll } from '@/contracts/oasForm';

/**
 * XCrudForm (JUM-772 redesign, X-SYNTH pattern): 2-column field grid with
 * OAS descriptions as helper text, avatar block, Save/Cancel footer; preview
 * renders a readonly 4-column field grid with the same cell formatting as
 * the table.
 */
const props = defineProps<{
  config: XCrudEntityConfig;
  mode: XCrudMode;
  descriptors: FieldDescriptor[];
  record?: Record<string, unknown>;
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

/** Item descriptors for array-of-objects fields (from the active schema). */
const itemDescriptorsFor = (d: FieldDescriptor): FieldDescriptor[] | undefined => {
  const schema = props.mode === 'create' ? props.config.schemas.create : props.config.schemas.update;
  return arrayItemDescriptors(schema, d.name);
};

const editableDescriptors = computed(() => (
  props.descriptors.filter((d) => d.name !== props.config.avatarField)
));

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

const previewEntries = computed(() => {
  if (!props.record) return [];
  return Object.entries(props.record).filter(([key]) => key !== 'password');
});

/** Preview labels come from the entity schema (description), not raw keys. */
const previewLabels = computed<Record<string, string>>(() => {
  try {
    const descriptors = fieldDescriptors(props.config.entity);
    return Object.fromEntries(descriptors.map((d) => [
      d.name,
      props.config.columnLabels?.[d.name] ?? d.description ?? d.name
    ]));
  } catch {
    return {};
  }
});
</script>

<template>
  <div class="xcrud-form">
    <!-- PREVIEW: readonly full record, 4-column field grid -->
    <template v-if="mode === 'preview' && record">
      <div class="row g-3">
        <template v-for="[key, value] in previewEntries" :key="key">
          <div class="col-12 col-md-3">
            <div class="small text-uppercase text-body-secondary">{{ previewLabels[key] ?? key }}</div>
            <div class="fw-medium">
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
              <template v-else-if="key === config.avatarField">
                <CAvatar :src="String(value ?? '')" size="lg" color="secondary" text-color="white">
                  <CIcon icon="cil-user" size="lg" />
                </CAvatar>
              </template>
              <template v-else-if="key === 'id' || key.endsWith('Id')">
                <span class="font-monospace small" :title="String(value ?? '')">{{ shortId(value) }}</span>
              </template>
              <template v-else>
                {{ formatCellValue({ name: key, type: typeof value, required: false }, value) }}
              </template>
            </div>
          </div>
        </template>
      </div>
    </template>

    <!-- CREATE / UPDATE: 2-column field grid with helper text -->
    <template v-else>
      <div v-if="formError" class="alert alert-danger" role="alert">{{ formError }}</div>

      <div v-if="config.avatarField" class="d-flex align-items-center gap-3 mb-3">
        <CAvatar
          :src="String(record?.[config.avatarField] ?? '')"
          size="lg"
          color="secondary"
          text-color="white"
        >
          <CIcon icon="cil-user" size="lg" />
        </CAvatar>
        <CButton color="secondary" variant="outline" size="sm" type="button">
          <CIcon icon="cil-cloud-upload" size="sm" />
          {{ mode === 'create' ? 'Upload Photo' : 'Change Photo' }}
        </CButton>
      </div>

      <div class="row g-3">
        <template v-for="d in editableDescriptors" :key="d.name">
          <!-- array-of-objects: full sub-resource editor (JUM-772) -->
          <div
            v-if="isArrayField(d) && itemDescriptorsFor(d)"
            class="col-12"
          >
            <XCrudArrayEditor
              :descriptor="d"
              :item-descriptors="itemDescriptorsFor(d) ?? []"
              :model-value="Array.isArray(values[d.name]) ? values[d.name] as Record<string, unknown>[] : []"
              @update:model-value="values[d.name] = $event"
            />
          </div>
          <!-- array-of-strings as checkbox group (options from the config) -->
          <div v-if="isArrayField(d) && config.arrayOptions?.[d.name]" class="col-12 col-md-6">
            <label class="form-label fw-semibold mb-1">
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
          <div v-else-if="d.xReferences?.operationId" class="col-12 col-md-6">
            <label class="form-label fw-semibold mb-1" :for="`xref-${d.name}`">
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
          <div v-else-if="!isArrayField(d)" class="col-12 col-md-6">
            <OasFormField v-model="values[d.name]" :descriptor="d" class="mb-0" />
          </div>
        </template>
      </div>

      <div class="d-flex gap-2 mt-3 pt-3 border-top">
        <CButton color="primary" type="button" @click="submit">
          <CIcon icon="cil-save" size="sm" /> {{ mode === 'create' ? 'Create' : 'Save' }}
        </CButton>
        <CButton color="secondary" variant="outline" type="button" @click="emit('cancel')">
          Cancel
        </CButton>
      </div>
    </template>
  </div>
</template>
