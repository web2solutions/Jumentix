<script setup lang="ts">
import { reactive, watch } from 'vue';
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CFormInput,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow
} from '@coreui/vue';

import OasFormField from '@/components/OasFormField.vue';
import SearchableEnumInput from '@/components/SearchableEnumInput.vue';
import { fieldDescriptors, type FieldDescriptor } from '@/contracts/formSchema';
import { fieldLabel } from '@/contracts/labels';
import { collectBody, validateAll } from '@/contracts/oasForm';
import { documentInputCap, filterDocumentData, validateDocumentData } from '@/contracts/validation';
import { useProfileStore, type UserDocument } from '@/stores/profile';
import { t } from '@/i18n';
import { useSectionNotify } from './useSectionNotify';

const props = defineProps<{ documents: UserDocument[] }>();

const profile = useProfileStore();
const { errorMessage, successMessage, run } = useSectionNotify();

// OAS-driven fields (JUM-766): RequestCreateDocument / RequestUpdateEmail shape.
const createDescriptors = fieldDescriptors('RequestCreateDocument');
const updateDescriptors = fieldDescriptors('RequestUpdateDocument').filter((d) => d.name !== 'id');

// The `data` field carries the OAS x-validation rules (CPF checksum, SSN).
const maskData = (values: Record<string, unknown>) => (raw: string) => (
  filterDocumentData(String(values.type ?? ''), String(values.countryIssue ?? ''), raw)
);

// Effective input cap per row (JUM-769): declared maxLength, else the cap
// derived from the x-validation rule (mask length or pattern upper bound).
const dataCap = (values: Record<string, unknown>, declared?: number) => (
  declared ?? documentInputCap(String(values.type ?? ''), String(values.countryIssue ?? ''))
);

const edits = reactive<Record<string, Record<string, unknown>>>({});
watch(
  () => props.documents,
  (documents) => {
    for (const item of documents ?? []) {
      edits[item.id] = { type: item.type, countryIssue: item.countryIssue, data: item.data };
    }
  },
  { immediate: true, deep: true }
);

const newValues = reactive<Record<string, unknown>>({ type: 'CPF', countryIssue: 'BR' });

const add = () => {
  const invalid = validateAll(createDescriptors, newValues)
    ?? validateDocumentData(
      String(newValues.type ?? ''),
      String(newValues.countryIssue ?? ''),
      String(newValues.data ?? '')
    );
  if (invalid) {
    errorMessage.value = invalid;
    return;
  }
  return run(async () => {
    await profile.addDocument(collectBody(createDescriptors, newValues) as {
      type: string;
      countryIssue: string;
      data: string;
    });
    newValues.data = '';
  }, t('profile.updated'));
};

const update = (id: string) => {
  const state = edits[id];
  const invalid = validateAll(updateDescriptors, state)
    ?? validateDocumentData(String(state.type ?? ''), String(state.countryIssue ?? ''), String(state.data ?? ''));
  if (invalid) {
    errorMessage.value = invalid;
    return;
  }
  return run(() => profile.updateDocument(id, collectBody(updateDescriptors, state)), t('profile.updated'));
};
const remove = (id: string) => run(() => profile.removeDocument(id), t('profile.updated'));

const cellControl = (descriptor: FieldDescriptor): 'select' | 'text' => (
  descriptor.enum ? 'select' : 'text'
);
</script>

<template>
  <CCard class="mb-4">
    <CCardHeader><strong>{{ t('profile.documents') }}</strong></CCardHeader>
    <CCardBody>
      <CAlert v-if="errorMessage" color="danger" role="alert">{{ errorMessage }}</CAlert>
      <CAlert v-if="successMessage" color="success" role="alert">{{ successMessage }}</CAlert>
      <CTable responsive align="middle" class="mb-3">
        <CTableHead>
          <CTableRow>
            <CTableHeaderCell v-for="d in updateDescriptors" :key="d.name">
              {{ fieldLabel(d) }}
            </CTableHeaderCell>
            <CTableHeaderCell class="text-end">{{ t('profile.actions') }}</CTableHeaderCell>
          </CTableRow>
        </CTableHead>
        <CTableBody>
          <CTableRow v-for="item in documents" :key="item.id">
            <CTableDataCell v-for="d in updateDescriptors" :key="d.name">
              <SearchableEnumInput
                v-if="cellControl(d) === 'select'"
                :id="`oas-cell-${item.id}-${d.name}`"
                :model-value="String(edits[item.id][d.name] ?? '')"
                :options="d.enum ?? []"
                :maxlength="d.maxLength"
                :aria-label="d.name"
                @update:model-value="edits[item.id][d.name] = $event"
              />
              <CFormInput
                v-else
                :model-value="String(edits[item.id][d.name] ?? '')"
                :aria-label="d.name === 'data' ? `Document ${item.data}` : d.name"
                :maxlength="d.name === 'data' ? dataCap(edits[item.id], d.maxLength) : d.maxLength"
                @update:model-value="d.name === 'data'
                  ? (edits[item.id].data = maskData(edits[item.id])($event))
                  : (edits[item.id][d.name] = $event)"
              />
            </CTableDataCell>
            <CTableDataCell class="text-end">
              <CButton size="sm" color="primary" class="me-2" @click="update(item.id)">{{ t('profile.save.row') }}</CButton>
              <CButton size="sm" color="danger" variant="outline" @click="remove(item.id)">{{ t('profile.delete') }}</CButton>
            </CTableDataCell>
          </CTableRow>
        </CTableBody>
      </CTable>
      <div class="d-flex gap-2 align-items-end">
        <OasFormField
          v-for="d in createDescriptors"
          :key="d.name"
          v-model="newValues[d.name]"
          :descriptor="d"
          :mask="d.name === 'data' ? maskData(newValues) : undefined"
          :mask-cap="d.name === 'data' ? dataCap(newValues) : undefined"
          class="mb-0"
        />
        <CButton color="success" class="mb-3" @click="add">{{ t('profile.add') }}</CButton>
      </div>
    </CCardBody>
  </CCard>
</template>
